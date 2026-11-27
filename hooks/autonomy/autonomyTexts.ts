import { describeStoreFailure } from '../goals/boardStore'
import { nameGoal } from '../goals/goalPaneTexts'
import { GOAL_REFERENCE_PLACEHOLDER } from '../goals/goalReference'
import type { HookSubject } from '../hookFailure'
import { AND_LIST, OR_LIST } from '../listFormat'
import { describeUnreadableRecord } from '../storeFailures'
import { describeProjectFailure } from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import type { TextWithLine } from '../sendToModel'
import type { EntryNumber } from '../todoEntry'
import { GrantReach, GrantsFailureKind } from './autonomyGrants'
import type { Grant, GrantsFailure } from './autonomyGrants'
import {
  AUTONOMOUS_IMPLEMENTATION_SKILL,
  AUTONOMY_COMMAND,
  AUTONOMY_WORDS,
  AutonomyWord,
  HYGIENE_SKILL,
  WRITING_CODE_SKILL,
} from './autonomyNames'

const ENTRY_PLACEHOLDER = '#<entry>'

export const AUTONOMY_DESCRIPTION =
  'Show where autonomous implementation applies, grant it for this project, for an entry of ' +
  'TODO.md with the entries under it or for a goal of this session, or remove every grant'

export const AUTONOMY_ARGUMENT_HINT =
  `[${[...AUTONOMY_WORDS, ENTRY_PLACEHOLDER, GOAL_REFERENCE_PLACEHOLDER].join('|')}]`

export const AUTONOMY_SUBJECT: HookSubject = {
  name: 'autonomy',
  checkBeforeRetry:
    `Run /${AUTONOMY_COMMAND} to see where autonomous implementation applies before you try ` +
    'again.',
}

export const AUTONOMY_LOST_WITHOUT_COMMAND =
  'In this session, you cannot grant autonomous implementation for this project, for an entry ' +
  'of TODO.md or for a goal, and cannot remove the grants already made.'

export const AUTONOMY_NOT_TYPED_BY_USER =
  `Autonomous implementation was not changed. Only /${AUTONOMY_COMMAND} typed by the user ` +
  'changes where it applies.'

export function describeUnknownAutonomyWords(words: string): string {
  const accepted = OR_LIST.format([
    ...AUTONOMY_WORDS,
    'the number that names an entry of TODO.md, such as #161.2',
    'G and the number of an open goal of this session, such as G18',
    'nothing',
  ])

  return `/${AUTONOMY_COMMAND} needs ${accepted}, so "${words}" changes nothing.`
}

export function describeEntryNotInTodo(entry: EntryNumber): string {
  return (
    `Entry ${entry} is not in TODO.md of this project, so /${AUTONOMY_COMMAND} changed ` +
    'nothing.'
  )
}

export function describeGoalNotOpen(goalNumber: number): string {
  return (
    `${nameGoal(goalNumber)} is not an open goal of this session, so /${AUTONOMY_COMMAND} ` +
    'changed nothing.'
  )
}

export function describeAutonomyNotChanged(failure: ProjectFailure): string {
  return `Autonomous implementation was not changed. ${describeProjectFailure(failure)}`
}

export function describeGrantsFailure(failure: GrantsFailure): string {
  switch (failure.kind) {
    case GrantsFailureKind.Project:
      return (
        'The grants for autonomous implementation could not be read, so it applies to nothing ' +
        `until they are read. ${describeProjectFailure(failure.failure)}`
      )
    case GrantsFailureKind.Unreadable:
      return describeUnreadableRecord(failure.key)
    case GrantsFailureKind.BoardNotRead:
      return (
        'The goals of this session could not be read, so autonomous implementation applies to no ' +
        `goal until they are read. ${describeStoreFailure(failure.failed)}`
      )
  }
}

export function describeAutonomyNoteNotSent(reason: string): string {
  return (
    `Claude was not told where autonomous implementation applies: ${reason}. Claude is told with ` +
    'the next tool result or message.'
  )
}

export function describeAutonomyForPerson(grants: readonly Grant[]): string {
  return grants.length === 0
    ? 'Autonomous implementation applies to nothing. Grant it with ' +
        `/${AUTONOMY_COMMAND} ${AutonomyWord.Always}, /${AUTONOMY_COMMAND} ${ENTRY_PLACEHOLDER} ` +
        `or /${AUTONOMY_COMMAND} ${GOAL_REFERENCE_PLACEHOLDER}.`
    : `Autonomous implementation applies to ${listGrants(grants)}. Run ` +
        `/${AUTONOMY_COMMAND} ${AutonomyWord.Off} to remove every grant.`
}

export const AUTONOMY_MODE =
  [
    `Under ${AUTONOMOUS_IMPLEMENTATION_SKILL}, you keep the same standards, such as ` +
      `those of ${WRITING_CODE_SKILL} and ${HYGIENE_SKILL}, ask no questions, leave no decision ` +
      'and no point open for the user or for later, finish everything end to end, and get the ' +
      'task done properly, with the highest quality.',
    `${AUTONOMOUS_IMPLEMENTATION_SKILL} applies only to the work listed by the latest note on ` +
      'it in the conversation, and to nothing while the conversation has no such note. A grant ' +
      'for one piece of work does not extend to anything else.',
    `Only the user changes where it applies, with /${AUTONOMY_COMMAND}.`,
  ].join(' ')

export function describeAutonomyNote(grants: readonly Grant[]): TextWithLine {
  const replaced = 'This note replaces every earlier note on where it applies.'

  return grants.length === 0
    ? {
        text: `${AUTONOMOUS_IMPLEMENTATION_SKILL} applies to nothing. ${replaced}`,
        line: 'Claude read that autonomous implementation applies to nothing.',
      }
    : {
        text:
          `${AUTONOMOUS_IMPLEMENTATION_SKILL} applies only to ${listGrants(grants)}. ${replaced}`,
        line: `Claude read that autonomous implementation applies to ${listGrants(grants)}.`,
      }
}

function listGrants(grants: readonly Grant[]): string {
  return AND_LIST.format(grants.map(nameGrant))
}

function nameGrant(grant: Grant): string {
  switch (grant.reach) {
    case GrantReach.Project:
      return 'the whole project'
    case GrantReach.Entry:
      return `entry ${grant.entry} of TODO.md with the entries under it`
    case GrantReach.Goal:
      return `goal ${grant.goal} of this session`
  }
}
