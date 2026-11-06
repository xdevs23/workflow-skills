import { describe, expect, test } from 'claude-code/testing'

import { FIRST_SESSION, NO_TIME_LIMIT, startSession } from '../testSupport'
import { MarkRemover } from './board'
import { doneMarkRecordOf, markRemovalRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import {
  FULL_STORE,
  MARK_TEXT,
  ROTATION_CRASH,
  clearElsewhere,
  goalRecordsOf,
  mountGoalsPane,
  storedBoardWithMark,
} from './goalPaneTestSupport'

describe('done marks in the Goals pane', () => {
  test(
    'a goal marked as done shows its evidence, and Unmark removes the mark while the goal stays',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(await pane.find({ key: 'unmark-1' })).toBeUndefined()
      await pane.press({ key: 'unmark-2' })

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
      const removal = markRemovalRecordOf(sessionScope(FIRST_SESSION), {
        ...ROTATION_CRASH,
        markRemoval: { markedAt: 300, removedAt: 1000, removedBy: MarkRemover.User },
      })
      expect(goalRecordsOf(session)).toEqual(
        storedBoardWithMark().set(removal.key, removal.value),
      )
      expect(session.toasts).toEqual([])
    },
  )

  test(
    'Unmark pressed after the model gave a new evidence removes nothing, and a toast shows ' +
      'the mark that was shown',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      const newMark = doneMarkRecordOf(sessionScope(FIRST_SESSION), {
        ...ROTATION_CRASH,
        doneMark: { evidence: 'release/v1.45.4', markedAt: 600 },
      })
      session.store.set(newMark.key, newMark.value)
      await pane.press({ key: 'unmark-2' })

      expect(session.toasts).toEqual(['Goal #2 is no longer marked done with release/v1.45.3.'])
      expect(
        await pane.find({ type: 'Text', text: 'Marked done by Claude: release/v1.45.4' }),
      ).toBeDefined()
      expect(goalRecordsOf(session).get(newMark.key)).toEqual(newMark.value)
    },
  )

  test(
    'Unmark pressed on a goal cleared by another process shows a toast, and the goal leaves',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'unmark-2' })

      expect(session.toasts).toEqual(['Goal #2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'a removal not saved by the store draws the mark again, and the toast shows the refusal',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      session.refusedWrites.push(FULL_STORE)
      await pane.press({ key: 'unmark-2' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The done mark was not removed. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
    },
  )

  test(
    'while a marked goal waits for a yes to clear it, its mark shows without Unmark',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })

      expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeDefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
    },
  )
})
