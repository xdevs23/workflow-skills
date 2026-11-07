import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import { FIRST_SESSION, startSession } from '../testSupport'
import { doneMarkRecordOf, markRemovalRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import { MARK_GOAL_DONE_TOOL, UNMARK_GOAL_DONE_TOOL } from './goalNames'
import {
  FULL_STORE,
  MARK_TEXT,
  NO_FOCUS_IN_KIT,
  ROTATION_CRASH,
  clearElsewhere,
  goalRecordsOf,
  mountGoalsPane,
  storedBoardWithMark,
} from './goalPaneTestSupport'
import { MarkRemover } from './doneMark'

const REASON = 'The release notes still name v1.45.2'

/**
 * The records of `storedBoardWithMark` with the mark of goal 2 removed by the user at 1000, with
 * the reason in `given`, if any.
 */
function storedBoardUnmarked(given: { reason?: string } = {}): Map<string, unknown> {
  const removal = markRemovalRecordOf(sessionScope(FIRST_SESSION), {
    ...ROTATION_CRASH,
    markRemoval: { markedAt: 300, removedAt: 1000, removedBy: MarkRemover.User, ...given },
  })

  return storedBoardWithMark().set(removal.key, removal.value)
}

describe('done marks in the Goals pane', () => {
  test(
    'Unmark draws a field for the reason with Cancel, and Enter removes the mark with the ' +
      'reason, and the goal is still drawn',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(await pane.find({ key: 'unmark-1' })).toBeUndefined()
      await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect(await pane.find({ key: 'unmark-reason-2' })).toBeDefined()
      expect(await pane.find({ key: 'cancel-unmark-2' })).toBeDefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
      expect(await pane.find({ key: 'clear-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
      await pane.input({ key: 'unmark-reason-2', text: `  ${REASON}  ` })

      expect(await pane.find({ key: 'unmark-reason-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoardUnmarked({ reason: REASON }))
      expect(session.toasts).toEqual([])
    },
  )

  test('an empty reason removes the mark without a reason', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoardWithMark() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.input({ key: 'unmark-reason-2', text: '   ' })

    expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
    expect(goalRecordsOf(session)).toEqual(storedBoardUnmarked())
  })

  test('Cancel closes the field for the reason and removes nothing', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoardWithMark() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.press({ key: 'cancel-unmark-2' })

    expect(await pane.find({ key: 'unmark-reason-2' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
    expect(await pane.find({ key: 'unmark-2' })).toBeDefined()
    expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
  })

  test(
    'a done mark removed by the model while the field for the reason is drawn closes the field',
    async ($, on) => {
      await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await $.tool.call({ tool: UNMARK_GOAL_DONE_TOOL, goal: 2 })

      expect(await pane.find({ key: 'unmark-reason-2' })).toBeUndefined()
      expect(await pane.find({ key: 'cancel-unmark-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
    },
  )

  test(
    'a done mark replaced by the model while the field for the reason is drawn closes the field',
    async ($, on) => {
      await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await $.tool.call({ tool: UNMARK_GOAL_DONE_TOOL, goal: 2 })
      await $.tool.call({ tool: MARK_GOAL_DONE_TOOL, goal: 2, evidence: 'v3.2.1' })

      expect(await pane.find({ key: 'unmark-reason-2' })).toBeUndefined()
      expect(await pane.find({ key: 'cancel-unmark-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'v3.2.1' })).toBeDefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeDefined()
    },
  )

  test(
    'on a surface without input fields, Unmark removes the mark at once, without a reason',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'mobile')
      await pane.press({ key: 'unmark-2' })

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
      expect(goalRecordsOf(session)).toEqual(storedBoardUnmarked())
    },
  )

  test(
    'a reason entered after the model gave a new evidence removes nothing, and a toast shows ' +
      'the mark that was shown',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      const newMark = doneMarkRecordOf(sessionScope(FIRST_SESSION), {
        ...ROTATION_CRASH,
        doneMark: { evidence: 'release/v1.45.4', markedAt: 600 },
      })
      await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      session.store.set(newMark.key, newMark.value)
      await pane.input({ key: 'unmark-reason-2', text: REASON })

      expect(session.toasts).toEqual(['Goal 2 is no longer marked done with release/v1.45.3.'])
      expect(await pane.find({ key: 'unmark-reason-2' })).toBeUndefined()
      expect(
        await pane.find({ type: 'Text', text: 'Marked done by Claude: release/v1.45.4' }),
      ).toBeDefined()
      expect(goalRecordsOf(session).get(newMark.key)).toEqual(newMark.value)
    },
  )

  test(
    'Unmark pressed on a goal cleared by another process shows a toast, and the goal leaves',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'unmark-2' })

      expect(session.toasts).toEqual(['Goal 2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'a removal not saved by the store draws the mark and the field again, and the toast shows ' +
      'the refusal',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'unmark-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      session.refusedWrites.push(FULL_STORE)
      await pane.input({ key: 'unmark-reason-2', text: REASON })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The done mark was not removed. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(await pane.find({ key: 'unmark-reason-2' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
    },
  )

  test(
    'while a marked goal waits for a yes to clear it, its mark shows without Unmark',
    async ($, on) => {
      await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
    },
  )
})
