import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import { FIRST_SESSION, startSession } from '../testSupport'
import { textRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import {
  FULL_STORE,
  MARK_TEXT,
  MIGRATION_GUIDE,
  NO_FOCUS_IN_KIT,
  ROTATION_CRASH,
  clearElsewhere,
  goalRecordsOf,
  mountGoalsPane,
  storedBoard,
  storedBoardWithMark,
} from './goalPaneTestSupport'

const BLANK_TEXT_WARNING = 'A goal needs a text. Type one, or press Cancel.'

describe('editing a goal in the Goals pane', () => {
  test(
    'Edit draws the text as a field with Cancel, and Enter saves the new text in place',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const edited = 'Fix the crash on rotation and publish v1.45.3 by Friday'
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect(await pane.find({ key: 'edit-goal-2' })).toBeDefined()
      expect(await pane.find({ key: 'cancel-edit-2' })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeUndefined()
      expect(await pane.find({ key: 'edit-1' })).toBeDefined()
      await pane.input({ key: 'edit-goal-2', text: edited })

      expect(await pane.find({ key: 'edit-goal-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: edited })).toBeDefined()
      expect(
        await pane.find({ type: 'Text', text: '#41 - Rotation keeps the open form' }),
      ).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
      const textRecord = textRecordOf(
        sessionScope(FIRST_SESSION),
        { ...ROTATION_CRASH, text: edited },
        1000,
      )
      expect(goalRecordsOf(session)).toEqual(
        storedBoard().set(textRecord.key, textRecord.value),
      )
    },
  )

  test('an edit of a marked goal removes its done mark', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoardWithMark() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.input({ key: 'edit-goal-2', text: 'Publish the patch release v1.45.4' })

    expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
    expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
    expect(session.toasts).toEqual([])
  })

  test('Clear pressed on another goal while a goal is edited ends the edit', async ($, on) => {
    await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.press({ key: 'clear-2' })

    expect(await pane.find({ key: 'edit-goal-1' })).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeDefined()
  })

  test(
    'a blank text is not saved, the field stays open with the warning, and Cancel closes it',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await pane.input({ key: 'edit-goal-2', text: '  ' })

      expect(await pane.find({ type: 'Text', text: BLANK_TEXT_WARNING })).toBeDefined()
      expect(await pane.find({ key: 'edit-goal-2' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())
      await pane.press({ key: 'cancel-edit-2' })
      expect(await pane.find({ type: 'Text', text: BLANK_TEXT_WARNING })).toBeUndefined()
      expect(await pane.find({ key: 'edit-goal-2' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test('the text already on the goal saves nothing, and closes the field', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    session.refusedWrites.push(FULL_STORE)
    await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.input({ key: 'edit-goal-2', text: ROTATION_CRASH.text })

    expect(session.refusedWrites).toEqual([FULL_STORE])
    expect(await pane.find({ key: 'edit-goal-2' })).toBeUndefined()
    expect(session.toasts).toEqual([])
  })

  test(
    'a text not saved by the store leaves the field open, and the toast shows the refusal',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      session.refusedWrites.push(FULL_STORE)
      await pane.input({ key: 'edit-goal-2', text: 'Ship the tablet layout' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The goal was not edited. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(await pane.find({ key: 'edit-goal-2' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    'Edit pressed, or a text entered, for a goal cleared by another process shows a toast, and ' +
      'the goal leaves',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      clearElsewhere(session, MIGRATION_GUIDE)
      await pane.input({ key: 'edit-goal-1', text: 'Ship the tablet layout' })
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'edit-2' })

      expect(session.toasts).toEqual(['Goal 1 is no longer open.', 'Goal 2 is no longer open.'])
      expect(await pane.find({ key: 'edit-goal-1' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    },
  )
})
