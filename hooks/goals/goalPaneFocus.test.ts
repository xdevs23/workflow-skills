import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Goal } from '../../types'
import { PLUGIN } from '../names'
import { test } from '../testDeclaration'
import { FIRST_SESSION, startSession } from '../testSupport'
import type { Session } from '../testSupport'
import { goalRecordOf, priorityRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import { PaneElement, movedElementKeyOf, newGoalFieldKeyOf, rowElementKeyOf } from './goalKeys'
import type { KeyedByGoal } from './goalKeys'
import { GOALS_PANE, MARK_GOAL_DONE_TOOL } from './goalNames'
import {
  MIGRATION_GUIDE,
  NO_FOCUS_IN_KIT,
  ROTATION_CRASH,
  editFieldIn,
  goalRecordsOf,
  mountGoalsPane,
  storedBoard,
  storedBoardWithMark,
  typeIntoEditField,
} from './goalPaneTestSupport'
import type { GoalsPane } from './goalPaneTestSupport'

// Claude Code sets the focus of a pane to a position, so after a goal moved under the focus, the
// focus was on the dropdown of another goal, which opened its list, and the next pick went to that
// goal. The kit does not move the focus itself, and fails each move of the focus asked by the
// plugin before any hook of the test sees it, which skips the rest of the hook that asked. So the
// tests read the key of a move from the record of the followed goal, which the plugin writes
// before it asks for the move, and check the element drawn under that key.

const SCOPE = sessionScope(FIRST_SESSION)

const PATCH_NOTES: Goal = {
  id: 'goal-patch-notes',
  number: 4,
  text: 'Write the patch notes',
  addedAt: 400,
  todos: [],
}

const RELEASE_POST: Goal = {
  id: 'goal-release-post',
  number: 5,
  text: 'Post the release',
  addedAt: 500,
  todos: [],
}

/** The records of `storedBoard` with goals 4 and 5 open too, each without a priority. */
function storedBoardWithFourOpen(): Map<string, unknown> {
  const records = [PATCH_NOTES, RELEASE_POST].map(goal => goalRecordOf(SCOPE, goal))

  return new Map([...storedBoard(), ...records.map(record => [record.key, record.value] as const)])
}

/** The session of a test, and the key ids of the moves of the focus recorded by the plugin. */
type FocusSession = { session: Session; keyIds: string[] }

/**
 * Starts the session on the board `stored`, with the engine beneath the plugin moving the focus for
 * every `ui.focus` raised by the test and the Goals pane given the keyboard unless `hasKeyboard` is
 * false, and collects the key ids of the moves of the focus, in the order the plugin records them.
 */
async function startWithPane(
  $: Engine,
  on: On,
  stored: Map<string, unknown>,
  hasKeyboard = true,
): Promise<FocusSession> {
  const keyIds: string[] = []
  on('ui.focus', () => ({}))
  on('ui.panes', () => ({
    value: [
      { id: GOALS_PANE, title: 'Goals', isShown: true, isFocused: hasKeyboard, isPlaced: true },
    ],
  }))
  on('state.set', { plugin: PLUGIN, key: 'followedGoal' }, ($, e, next) => {
    if (e.value?.keyId !== undefined) {
      keyIds.push(e.value.keyId)
    }

    return next(e)
  })

  return { session: await startSession($, on, { stored }), keyIds }
}

/** Moves the focus of the Goals pane onto the element with the key `key`, as a Tab press does. */
async function focusInPane($: Engine, key: string): Promise<void> {
  await $.ui.focus({
    component: 'Pane',
    requestId: GOALS_PANE,
    plugin: PLUGIN,
    element: key,
    origin: { kind: 'person' },
  })
}

/** The key of the element of the row of `goal` moved to by the last move of the focus. */
function lastMoveKeyOf(goal: Goal, keyIds: readonly string[]): string {
  const keyId = keyIds.at(-1)
  if (keyId === undefined) {
    throw new Error('The plugin did not record a move of the focus.')
  }

  return movedElementKeyOf(goal, keyId)
}

/** A button of the Goals pane: its key and its label. */
type DrawnButton = { key: string | undefined; label: string }

/** The buttons of `pane`, in the order the pane draws them. */
async function buttonsOf(pane: Pick<GoalsPane, 'findAll'>): Promise<DrawnButton[]> {
  const buttons = await pane.findAll({ type: 'Button' })

  return buttons.map(button => ({ key: button.key, label: button.text }))
}

/** The button `element` of the row of `goal`, under its own key, labeled `label`. */
function buttonOf(goal: Goal, element: KeyedByGoal, label: string): DrawnButton {
  return { key: rowElementKeyOf(goal, element), label }
}

/** Picks the priority `value` in the picker of `goal` in `pane`. */
async function pickPriority(pane: GoalsPane, goal: Goal, value: string): Promise<void> {
  await pane.select({ key: rowElementKeyOf(goal, PaneElement.Priority), value })
}

describe('the focus of the Goals pane follows the goal whose row has the focus', () => {
  test('a priority picked for a goal moves the focus to Edit, where its row is drawn now', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Priority))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(await buttonsOf(pane)).toEqual([
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Edit' },
      buttonOf(ROTATION_CRASH, PaneElement.Clear, 'Clear'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test('on a surface without input fields the focus moves to Clear', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'mobile')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Clear))
    const marked = await $.tool.call({ tool: MARK_GOAL_DONE_TOOL, goal: 1, evidence: 'guide.md' })

    expect(marked.deny).toBeUndefined()
    expect(await buttonsOf(pane)).toEqual([
      buttonOf(MIGRATION_GUIDE, PaneElement.Unmark, 'Unmark'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Clear' },
    ])
  })

  test('the focus moves to Unmark in the row of a goal marked done', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoardWithMark())
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Priority))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(await buttonsOf(pane)).toEqual([
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Unmark' },
      buttonOf(ROTATION_CRASH, PaneElement.Edit, 'Edit'),
      buttonOf(ROTATION_CRASH, PaneElement.Clear, 'Clear'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test('the focus moves to Done in the row of a goal being edited', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    const edit = rowElementKeyOf(ROTATION_CRASH, PaneElement.Edit)
    await expect(pane.press({ key: edit })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.CancelEditing))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(await buttonsOf(pane)).toEqual([
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Done' },
      buttonOf(ROTATION_CRASH, PaneElement.CancelEditing, 'Cancel'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test('the focus moves to Cancel in the row of a goal being unmarked', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoardWithMark())
    const pane = await mountGoalsPane($, 'terminal')
    const unmark = rowElementKeyOf(ROTATION_CRASH, PaneElement.Unmark)
    await expect(pane.press({ key: unmark })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.CancelUnmarking))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(await buttonsOf(pane)).toEqual([
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Cancel' },
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test('during the question to clear a goal the focus moves to Keep, never to the yes', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: rowElementKeyOf(ROTATION_CRASH, PaneElement.Clear) })
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.YesClear))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(await buttonsOf(pane)).toEqual([
      buttonOf(ROTATION_CRASH, PaneElement.YesClear, 'Yes, clear'),
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Keep' },
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test(
    'the field that edits a goal is drawn again with the typed text under a new key, and the ' +
      'focus does not move to a button',
    async ($, on) => {
      const { keyIds } = await startWithPane($, on, storedBoard())
      const pane = await mountGoalsPane($, 'terminal')
      const edit = rowElementKeyOf(ROTATION_CRASH, PaneElement.Edit)
      await expect(pane.press({ key: edit })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const before = await editFieldIn(pane, ROTATION_CRASH.number)
      await focusInPane($, before?.key ?? 'no field drawn')
      await typeIntoEditField(pane, ROTATION_CRASH.number, 'Fix the crash on rotation', 'change')
      await pickPriority(pane, ROTATION_CRASH, '0')

      const after = await editFieldIn(pane, ROTATION_CRASH.number)
      expect(after?.key).not.toBe(before?.key)
      expect(after?.props.value).toBe('Fix the crash on rotation')
      expect(keyIds).toEqual([])
    },
  )

  test('a text saved with Enter moves the focus to Edit, in place of the field', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    const edit = rowElementKeyOf(ROTATION_CRASH, PaneElement.Edit)
    await expect(pane.press({ key: edit })).rejects.toThrow(NO_FOCUS_IN_KIT)
    const field = await editFieldIn(pane, ROTATION_CRASH.number)
    await focusInPane($, field?.key ?? 'no field drawn')
    await typeIntoEditField(pane, ROTATION_CRASH.number, 'Fix the crash on rotation')

    expect(await buttonsOf(pane)).toEqual([
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
      { key: lastMoveKeyOf(ROTATION_CRASH, keyIds), label: 'Edit' },
      buttonOf(ROTATION_CRASH, PaneElement.Clear, 'Clear'),
    ])
  })

  test('the field for the reason to unmark a goal is drawn under the key of the move', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoardWithMark())
    const pane = await mountGoalsPane($, 'terminal')
    const unmark = rowElementKeyOf(ROTATION_CRASH, PaneElement.Unmark)
    await expect(pane.press({ key: unmark })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.UnmarkReason))
    await pickPriority(pane, ROTATION_CRASH, '0')

    const moved = await pane.find({ key: lastMoveKeyOf(ROTATION_CRASH, keyIds) })
    expect(moved?.type).toBe('Input')
    expect(await pane.find({ key: rowElementKeyOf(ROTATION_CRASH, PaneElement.UnmarkReason) }))
      .toBeUndefined()
  })

  test('a goal moved again after the focus moved with it is followed again', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Priority))
    await pickPriority(pane, ROTATION_CRASH, '0')
    const first = lastMoveKeyOf(ROTATION_CRASH, keyIds)
    await focusInPane($, first)
    await pickPriority(pane, ROTATION_CRASH, 'none')

    const second = lastMoveKeyOf(ROTATION_CRASH, keyIds)
    expect(second).not.toBe(first)
    expect(await buttonsOf(pane)).toEqual([
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
      { key: second, label: 'Edit' },
      buttonOf(ROTATION_CRASH, PaneElement.Clear, 'Clear'),
    ])
  })

  test('a change that leaves the row of the followed goal in its place does not ask for a move', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(MIGRATION_GUIDE, PaneElement.Priority))
    await pickPriority(pane, MIGRATION_GUIDE, '0')

    expect(keyIds).toEqual([])
    expect(await buttonsOf(pane)).toEqual([
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
      buttonOf(ROTATION_CRASH, PaneElement.Edit, 'Edit'),
      buttonOf(ROTATION_CRASH, PaneElement.Clear, 'Clear'),
    ])
  })

  test(
    'a goal marked done by the model while another goal is edited leaves the typed text in the ' +
      'field, and the focus does not move to a button',
    async ($, on) => {
      const { keyIds } = await startWithPane($, on, storedBoard())
      const pane = await mountGoalsPane($, 'terminal')
      const edit = rowElementKeyOf(ROTATION_CRASH, PaneElement.Edit)
      await expect(pane.press({ key: edit })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const before = await editFieldIn(pane, ROTATION_CRASH.number)
      await focusInPane($, before?.key ?? 'no field drawn')
      await typeIntoEditField(pane, ROTATION_CRASH.number, 'Fix the crash', 'change')
      const marked = await $.tool.call({ tool: MARK_GOAL_DONE_TOOL, goal: 1, evidence: 'guide.md' })

      expect(marked.deny).toBeUndefined()
      const after = await editFieldIn(pane, ROTATION_CRASH.number)
      expect(after?.key).not.toBe(before?.key)
      expect(after?.props.value).toBe('Fix the crash')
      expect(keyIds).toEqual([])
    },
  )

  test(
    'among goals without a priority, P0 picked for the last goal and removed again changes only ' +
      'that goal, and the focus moves within its row',
    async ($, on) => {
      const { session, keyIds } = await startWithPane($, on, storedBoardWithFourOpen())
      const pane = await mountGoalsPane($, 'terminal')
      await focusInPane($, rowElementKeyOf(RELEASE_POST, PaneElement.Priority))
      await pickPriority(pane, RELEASE_POST, '0')

      const picked = priorityRecordOf(SCOPE, {
        ...RELEASE_POST,
        prioritySetting: { value: 0, setAt: 1000 },
      })
      expect(goalRecordsOf(session)).toEqual(
        storedBoardWithFourOpen().set(picked.key, picked.value),
      )
      expect((await buttonsOf(pane)).slice(0, 2)).toEqual([
        { key: lastMoveKeyOf(RELEASE_POST, keyIds), label: 'Edit' },
        buttonOf(RELEASE_POST, PaneElement.Clear, 'Clear'),
      ])

      await focusInPane($, lastMoveKeyOf(RELEASE_POST, keyIds))
      await pickPriority(pane, RELEASE_POST, 'none')

      const removed = priorityRecordOf(SCOPE, { ...RELEASE_POST, prioritySetting: { setAt: 1000 } })
      expect(goalRecordsOf(session)).toEqual(
        storedBoardWithFourOpen().set(removed.key, removed.value),
      )
      expect((await buttonsOf(pane)).slice(-2)).toEqual([
        { key: lastMoveKeyOf(RELEASE_POST, keyIds), label: 'Edit' },
        buttonOf(RELEASE_POST, PaneElement.Clear, 'Clear'),
      ])
    },
  )

  test('a goal changed once the focus is on the field that adds a goal does not ask for a move', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Priority))
    await focusInPane($, newGoalFieldKeyOf(4))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(keyIds).toEqual([])
  })

  test('a goal cleared while its row has the focus does not ask for a move', async ($, on) => {
    const { keyIds } = await startWithPane($, on, storedBoard())
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: rowElementKeyOf(ROTATION_CRASH, PaneElement.Clear) })
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.YesClear))
    await pane.press({ key: rowElementKeyOf(ROTATION_CRASH, PaneElement.YesClear) })

    expect(keyIds).toEqual([])
    expect(await buttonsOf(pane)).toEqual([
      buttonOf(MIGRATION_GUIDE, PaneElement.Edit, 'Edit'),
      buttonOf(MIGRATION_GUIDE, PaneElement.Clear, 'Clear'),
    ])
  })

  test('a goal changed while the Goals pane does not have the keyboard does not ask for a move', async (
    $,
    on,
  ) => {
    const { keyIds } = await startWithPane($, on, storedBoard(), false)
    const pane = await mountGoalsPane($, 'terminal')
    await focusInPane($, rowElementKeyOf(ROTATION_CRASH, PaneElement.Priority))
    await pickPriority(pane, ROTATION_CRASH, '0')

    expect(keyIds).toEqual([])
  })
})
