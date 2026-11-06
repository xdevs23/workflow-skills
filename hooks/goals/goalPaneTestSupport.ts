import type { Engine } from 'claude-code/testing'
import type { PromptOrigin, RenderPropsOf } from 'claude-code'

import type { Goal } from '../../types'
import { PLUGIN } from '../names'
import { RecordKind, recordPrefixOf } from '../pluginStore'
import { FIRST_SESSION } from '../testSupport'
import type { Session } from '../testSupport'
import { clearanceRecordOf, doneMarkRecordOf, goalRecordOf, todoRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import { GOALS_COMMAND, GOALS_PANE } from './goalNames'

// The board, the pane and the command shared by the tests of the Goals pane and of /goals.

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Goals',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

export const MIGRATION_GUIDE: Goal = {
  id: 'goal-migration-guide',
  number: 1,
  text: 'Write the migration guide',
  addedAt: 100,
  todos: [
    { number: '38', title: 'Guide covers the schema changes', attachedAt: 110 },
    { number: '234', title: 'Guide lists the removed flags', attachedAt: 120 },
  ],
}

export const ROTATION_CRASH: Goal = {
  id: 'goal-rotation-crash',
  number: 2,
  text: 'Fix the crash on rotation and publish the patch release',
  addedAt: 200,
  todos: [{ number: '41', title: 'Rotation keeps the open form', attachedAt: 210 }],
}

export const STORE_LISTING: Goal = {
  id: 'goal-store-listing',
  number: 3,
  text: 'Write the store listing',
  addedAt: 300,
  todos: [],
}

const GOAL_RECORD_PREFIX = recordPrefixOf(RecordKind.Goal)

/**
 * The error of the test kit for each `$.ui.focus` call made by a plugin. The kit fails that call
 * also with a `ui.focus` hook of the test or of an inline plugin in place, where the engine answers
 * a move it does not make with a deny. The pane moves the focus to the new field after every goal
 * added by the pane, and to the field of a goal after a press of its Edit, so such an entry or
 * press rejects with this error in a test.
 */
export const NO_FOCUS_IN_KIT = 'no implementation for ui.focus'

export const FULL_STORE = 'the store is over 4 MiB'

export const UNREADABLE_STORE = 'the store file is not readable'

export const NOT_READ = 'The goals of this session could not be read. '

/** The records of a board of FIRST_SESSION with #1 and #2 open and #3 cleared. */
export function storedBoard(): Map<string, unknown> {
  const scope = sessionScope(FIRST_SESSION)
  const records = [
    ...[MIGRATION_GUIDE, ROTATION_CRASH, STORE_LISTING].flatMap(goal => [
      goalRecordOf(scope, goal),
      ...goal.todos.map(todo => todoRecordOf(scope, goal, todo)),
    ]),
    clearanceRecordOf(scope, STORE_LISTING, 400),
  ]

  return new Map(records.map(record => [record.key, record.value]))
}

/** The records of goals in the store of the session, leaving out the other records. */
export function goalRecordsOf(session: Session): Map<string, unknown> {
  return new Map([...session.store].filter(([key]) => key.startsWith(GOAL_RECORD_PREFIX)))
}

export const DONE_MARK = { evidence: 'release/v1.45.3', markedAt: 300 }

export const MARK_TEXT = 'Marked done by Claude: release/v1.45.3'

/** The records of `storedBoard` with goal #2 marked as done by the model. */
export function storedBoardWithMark(): Map<string, unknown> {
  const mark = doneMarkRecordOf(sessionScope(FIRST_SESSION), {
    ...ROTATION_CRASH,
    doneMark: DONE_MARK,
  })

  return storedBoard().set(mark.key, mark.value)
}

/** Stores the clearance of `goal` as another process of the session does. */
export function clearElsewhere(session: Session, goal: Goal): void {
  const clearance = clearanceRecordOf(sessionScope(FIRST_SESSION), goal, 500)
  session.store.set(clearance.key, clearance.value)
}

export function mountGoalsPane<Surface extends 'terminal' | 'mobile'>(
  $: Engine,
  surface: Surface,
) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId: GOALS_PANE,
    props: PANE_PROPS,
  })
}

export async function goalsCommand(
  $: Engine,
  args: string,
  origin: PromptOrigin = { kind: 'composer' },
): Promise<string | undefined> {
  const ran = await $.command.run({
    command: GOALS_COMMAND,
    args,
    origin,
    presentation: { isFullscreen: true, columns: 120 },
  })

  return ran.text
}

export function notReadToastsOf(session: Session): string[] {
  return session.toasts.filter(toast => toast.startsWith(NOT_READ))
}
