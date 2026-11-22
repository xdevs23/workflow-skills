import type {
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  PromptOrigin,
} from 'claude-code'

import type { Goal } from '../../types'
import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { returningStoreFailure } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { ProjectFailureKind, returningProjectFailure } from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import { isTypedByUser } from '../promptOrigin'
import { readEntryNumber } from '../todoEntry'
import { hasEntryInTodoFile } from '../todoFile'
import type { EntryNumber } from '../todoEntry'
import {
  GrantReach,
  WHOLE_PROJECT,
  deleteGoalGrant,
  saveGoalGrant,
  saveProjectGrant,
  saveRevocation,
} from './autonomyGrants'
import type { GrantScope } from './autonomyGrants'
import {
  AUTONOMY_COMMAND,
  AutonomyWord,
  GoalAutonomyWord,
  isAutonomyWord,
} from './autonomyNames'
import { loadGrantsIntoState } from './autonomyState'
import {
  AUTONOMY_ARGUMENT_HINT,
  AUTONOMY_DESCRIPTION,
  AUTONOMY_LOST_WITHOUT_COMMAND,
  AUTONOMY_NOT_TYPED_BY_USER,
  AUTONOMY_SUBJECT,
  describeAutonomyForPerson,
  describeAutonomyNotChanged,
  describeEntryNotInTodo,
  describeGrantsFailure,
  describeUnknownAutonomyWords,
} from './autonomyTexts'

enum ChangeKind {
  Revoke = 'revoke',
  GrantProject = 'grant-project',
  GrantEntry = 'grant-entry',
}

type AutonomyChange =
  | { kind: ChangeKind.Revoke | ChangeKind.GrantProject }
  | { kind: ChangeKind.GrantEntry; entry: EntryNumber }

enum ChangeOutcome {
  Saved = 'saved',
  NotSaved = 'not-saved',
  EntryNotInTodo = 'entry-not-in-todo',
}

type ChangeResult =
  | { outcome: ChangeOutcome.Saved }
  | { outcome: ChangeOutcome.NotSaved; failure: ProjectFailure }
  | { outcome: ChangeOutcome.EntryNotInTodo; entry: EntryNumber }

const SAVED: ChangeResult = { outcome: ChangeOutcome.Saved }

const AUTONOMY_WORD_CHANGES: Record<AutonomyWord, AutonomyChange> = {
  [AutonomyWord.Off]: { kind: ChangeKind.Revoke },
  [AutonomyWord.Always]: { kind: ChangeKind.GrantProject },
}

export function autonomyCommand($: EngineInterface): PluginCommand {
  return {
    spec: {
      name: AUTONOMY_COMMAND,
      description: AUTONOMY_DESCRIPTION,
      argumentHint: AUTONOMY_ARGUMENT_HINT,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: AUTONOMY_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: true,
    run: e => runAutonomyCommand($, e),
    subjectOf: () => AUTONOMY_SUBJECT,
  }
}

export async function runGoalAutonomyCommand(
  $: EngineInterface,
  command: { goal: Goal; word: GoalAutonomyWord; origin: PromptOrigin },
): Promise<CommandRunResult> {
  const { goal, word, origin } = command
  if (!isTypedByUser(origin)) {
    return { text: AUTONOMY_NOT_TYPED_BY_USER }
  }
  const sessionId = await $.session.id()
  const changedAt = await $.clock.now()
  const changed = await returningStoreFailure(
    async () => {
      await changeGoalGrant($, { sessionId, goal, changedAt }, word)

      return SAVED
    },
    (failed): ChangeResult => ({
      outcome: ChangeOutcome.NotSaved,
      failure: { kind: ProjectFailureKind.Store, failed },
    }),
  )

  return replyToChange($, changed)
}

async function runAutonomyCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const words = e.args.trim()
  if (words === '') {
    return replyWithAutonomy($, [])
  }
  const change = autonomyChangeOf(words)
  if (change === undefined) {
    return { text: describeUnknownAutonomyWords(words) }
  }
  if (!isTypedByUser(e.origin)) {
    return { text: AUTONOMY_NOT_TYPED_BY_USER }
  }
  const sessionId = await $.session.id()
  const changedAt = await $.clock.now()
  const changed = await returningProjectFailure(
    $,
    project => changeGrants($, { sessionId, project }, change, changedAt),
    (failure): ChangeResult => ({ outcome: ChangeOutcome.NotSaved, failure }),
  )

  return replyToChange($, changed)
}

function autonomyChangeOf(words: string): AutonomyChange | undefined {
  if (isAutonomyWord(words)) {
    return AUTONOMY_WORD_CHANGES[words]
  }
  const entry = readEntryNumber(words)

  return entry === undefined ? undefined : { kind: ChangeKind.GrantEntry, entry }
}

async function changeGrants(
  $: EngineInterface,
  scope: GrantScope,
  change: AutonomyChange,
  changedAt: number,
): Promise<ChangeResult> {
  switch (change.kind) {
    case ChangeKind.Revoke:
      await saveRevocation($, scope, changedAt)

      return SAVED
    case ChangeKind.GrantProject:
      await saveProjectGrant($, scope, { grant: WHOLE_PROJECT, grantedAt: changedAt })

      return SAVED
    case ChangeKind.GrantEntry:
      return grantEntry($, scope, change.entry, changedAt)
  }
}

async function grantEntry(
  $: EngineInterface,
  scope: GrantScope,
  entry: EntryNumber,
  grantedAt: number,
): Promise<ChangeResult> {
  if (!(await hasEntryInTodoFile($, scope.project, entry))) {
    return { outcome: ChangeOutcome.EntryNotInTodo, entry }
  }
  await saveProjectGrant($, scope, { grant: { reach: GrantReach.Entry, entry }, grantedAt })

  return SAVED
}

function changeGoalGrant(
  $: StoreEngine,
  change: { sessionId: string; goal: Goal; changedAt: number },
  word: GoalAutonomyWord,
): Promise<void> {
  const { sessionId, goal, changedAt } = change
  switch (word) {
    case GoalAutonomyWord.On:
      return saveGoalGrant($, { sessionId, goal, grantedAt: changedAt })
    case GoalAutonomyWord.Off:
      return deleteGoalGrant($, sessionId, goal)
  }
}

async function replyToChange(
  $: EngineInterface,
  changed: ChangeResult,
): Promise<CommandRunResult> {
  switch (changed.outcome) {
    case ChangeOutcome.Saved:
      return replyWithAutonomy($, [])
    case ChangeOutcome.NotSaved:
      return replyWithAutonomy($, [changed.failure])
    case ChangeOutcome.EntryNotInTodo:
      return { text: describeEntryNotInTodo(changed.entry) }
  }
}

async function replyWithAutonomy(
  $: EngineInterface,
  notChanged: readonly ProjectFailure[],
): Promise<CommandRunResult> {
  const { grants, failures } = await loadGrantsIntoState($)
  const text = describeAutonomyForPerson(grants)
  const reasons = [
    ...notChanged.map(describeAutonomyNotChanged),
    ...failures.map(describeGrantsFailure),
  ]

  return reasons.length === 0 ? { text } : replyWithFailures($, [...reasons, text])
}
