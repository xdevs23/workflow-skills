import type { Goal } from '../../types'
import { Outcome, openGoalsByIdOf } from '../goals/board'
import type { Read } from '../goals/board'
import { sessionScope } from '../goals/boardScope'
import { loadBoardIn } from '../goals/boardStore'
import type { Failed } from '../goals/boardStore'
import {
  RecordKind,
  deleteRecord,
  isRecord,
  listKeys,
  readEntriesIn,
  recordKeyOf,
  recordPrefixOf,
  writeRecord,
} from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import type { ProjectFailure } from '../projectFolder'
import { readProjectRecords, saveProjectRecord } from '../projectRecords'
import { readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'

export enum GrantReach {
  Project = 'project',
  Entry = 'entry',
  Goal = 'goal',
}

export type ProjectGrant =
  | { reach: GrantReach.Project }
  | { reach: GrantReach.Entry; entry: EntryNumber }

type GoalGrant = { reach: GrantReach.Goal; goal: number }

export type Grant = ProjectGrant | GoalGrant

export const WHOLE_PROJECT: ProjectGrant = { reach: GrantReach.Project }

export type GrantScope = { sessionId: string; project: string }

export enum GrantsFailureKind {
  Project = 'project',
  Unreadable = 'unreadable',
  BoardNotRead = 'board-not-read',
}

export type GrantsFailure =
  | { kind: GrantsFailureKind.Project; failure: ProjectFailure }
  | { kind: GrantsFailureKind.Unreadable; key: string }
  | { kind: GrantsFailureKind.BoardNotRead; failed: Failed }

export type ReadGrants = { grants: Grant[]; failures: GrantsFailure[] }

type Granted<T> = { grant: T; grantedAt: number }

export function saveProjectGrant(
  $: StoreEngine,
  scope: GrantScope,
  granted: Granted<ProjectGrant>,
): Promise<void> {
  const { grant, grantedAt } = granted

  return saveProjectRecord($, {
    kind: RecordKind.ProjectAutonomy,
    ...scope,
    value: { ...grant, grantedAt },
  })
}

export function saveRevocation(
  $: StoreEngine,
  scope: GrantScope,
  revokedAt: number,
): Promise<void> {
  return saveProjectRecord($, {
    kind: RecordKind.AutonomyRevocation,
    ...scope,
    value: { revokedAt },
  })
}

export function saveGoalGrant(
  $: StoreEngine,
  granted: { sessionId: string; goal: Goal; grantedAt: number },
): Promise<void> {
  const { sessionId, goal, grantedAt } = granted

  return writeRecord($, { key: goalGrantKeyOf(sessionId, goal), value: { grantedAt } })
}

export function deleteGoalGrant($: StoreEngine, sessionId: string, goal: Goal): Promise<void> {
  return deleteRecord($, goalGrantKeyOf(sessionId, goal))
}

export async function readGrants($: StoreEngine, scope: GrantScope): Promise<ReadGrants> {
  const { sessionId, project } = scope
  const keys = await listKeys($)
  const [projectGrants, revocations, goalGrants, board] = await Promise.all([
    readProjectRecords($, {
      kind: RecordKind.ProjectAutonomy,
      project,
      keysListedBefore: keys,
      parse: parseProjectGrant,
    }),
    readProjectRecords($, {
      kind: RecordKind.AutonomyRevocation,
      project,
      keysListedBefore: keys,
      parse: parseRevocation,
    }),
    readGoalGrantRecords($, sessionId, keys),
    loadBoardIn($, sessionScope(sessionId), keys),
  ])
  const revokedAt = Math.max(0, ...revocations.records.map(({ value }) => value))
  const grantedSinceRevocation = <T>(granted: readonly Granted<T>[]): T[] =>
    granted.filter(({ grantedAt }) => grantedAt > revokedAt).map(({ grant }) => grant)
  const goals = grantsOfOpenGoals(board, grantedSinceRevocation(goalGrants.records))
  const unreadableKeys = [
    ...projectGrants.unreadableKeys,
    ...revocations.unreadableKeys,
    ...goalGrants.unreadableKeys,
  ]

  return {
    grants: distinctGrants([
      ...grantedSinceRevocation(projectGrants.records.map(({ value }) => value)),
      ...goals.grants,
    ]),
    failures: [
      ...unreadableKeys.map((key): GrantsFailure => ({ kind: GrantsFailureKind.Unreadable, key })),
      ...goals.failures,
    ],
  }
}

export function isSameGrants(one: readonly Grant[], other: readonly Grant[]): boolean {
  const keysOfOther = new Set(other.map(identityOf))

  return one.length === other.length && one.every(grant => keysOfOther.has(identityOf(grant)))
}

function distinctGrants(grants: readonly Grant[]): Grant[] {
  return [...new Map(grants.map(grant => [identityOf(grant), grant])).values()]
}

function identityOf(grant: Grant): string {
  switch (grant.reach) {
    case GrantReach.Project:
      return grant.reach
    case GrantReach.Entry:
      return `${grant.reach}:${grant.entry}`
    case GrantReach.Goal:
      return `${grant.reach}:${grant.goal}`
  }
}

function grantsOfOpenGoals(
  board: Read | Failed,
  goalIds: readonly string[],
): { grants: GoalGrant[]; failures: GrantsFailure[] } {
  switch (board.outcome) {
    case Outcome.Failed:
      return { grants: [], failures: [{ kind: GrantsFailureKind.BoardNotRead, failed: board }] }
    case Outcome.Read: {
      const openGoals = openGoalsByIdOf(board.board)
      const grants = goalIds.flatMap((id): GoalGrant[] => {
        const goal = openGoals.get(id)

        return goal === undefined ? [] : [{ reach: GrantReach.Goal, goal: goal.number }]
      })

      return { grants, failures: [] }
    }
  }
}

function goalGrantKeyOf(sessionId: string, goal: Goal): string {
  return recordKeyOf(RecordKind.GoalAutonomy, sessionId, goal.id)
}

async function readGoalGrantRecords(
  $: StoreEngine,
  sessionId: string,
  keys: readonly string[],
): Promise<{ records: Granted<string>[]; unreadableKeys: string[] }> {
  const records: Granted<string>[] = []
  const unreadableKeys: string[] = []
  const prefix = recordPrefixOf(RecordKind.GoalAutonomy, sessionId)
  for (const { key, value } of await readEntriesIn($, prefix, keys)) {
    const grantedAt = parseGrantedAt(value)
    if (grantedAt === undefined) {
      unreadableKeys.push(key)
    } else {
      records.push({ grant: key.slice(prefix.length), grantedAt })
    }
  }

  return { records, unreadableKeys }
}

function parseProjectGrant(value: unknown): Granted<ProjectGrant> | undefined {
  const grantedAt = parseGrantedAt(value)
  if (!isRecord(value) || grantedAt === undefined) {
    return undefined
  }
  const { reach } = value
  const entry = readEntryNumber(value.entry)
  if (reach === GrantReach.Project) {
    return { grant: { reach }, grantedAt }
  }

  return reach === GrantReach.Entry && entry !== undefined
    ? { grant: { reach, entry }, grantedAt }
    : undefined
}

function parseGrantedAt(value: unknown): number | undefined {
  return isRecord(value) && typeof value.grantedAt === 'number' ? value.grantedAt : undefined
}

function parseRevocation(value: unknown): number | undefined {
  return isRecord(value) && typeof value.revokedAt === 'number' ? value.revokedAt : undefined
}
