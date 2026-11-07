import { describe, expect } from 'claude-code/testing'

import { cardKeyedIn } from '../cardFieldsTestSupport'
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
  editElsewhere,
  editFieldIn,
  goalRecordsOf,
  mountGoalsPane,
  storedBoard,
  storedBoardWithMark,
  typeIntoEditField,
} from './goalPaneTestSupport'
import { nameGoal } from './goalTexts'

const BLANK_TEXT_WARNING = 'A goal needs a text. Type one, or press Cancel.'
const TEXT_ELSEWHERE = 'Fix the crash on rotation, then publish v1.45.3'
const EDITED_ELSEWHERE =
  `Goal 2 was edited elsewhere to "${TEXT_ELSEWHERE}". Press Done again to save the text in the ` +
  'field instead.'

describe('editing a goal in the Goals pane', () => {
  test(
    'Edit draws the text as a field with Done and Cancel, and Enter saves the new text in place',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const edited = 'Fix the crash on rotation and publish v1.45.3 by Friday'
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect((await editFieldIn(pane, 2))?.props.submitLabel).toBe('done')
      expect(await pane.find({ key: 'done-edit-2' })).toBeDefined()
      expect(await pane.find({ key: 'cancel-edit-2' })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeUndefined()
      expect(await pane.find({ key: 'edit-1' })).toBeDefined()
      await typeIntoEditField(pane, 2, edited)

      expect(await editFieldIn(pane, 2)).toBeUndefined()
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

  test(
    'the field of an edited goal is drawn under its box, named as the goal, and the warning on a ' +
      'blank text after it',
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const box = { type: 'Box', props: { key: 'goal-2' } }
      const fieldOfGoal = async () => ({
        type: 'Input',
        props: { key: (await editFieldIn(pane, 2))?.key, label: nameGoal(2) },
      })

      expect(cardKeyedIn(await pane.drawn(), 'goal-2').holder).toMatchObject({
        props: { flexDirection: 'column' },
        children: [box, await fieldOfGoal()],
      })
      await typeIntoEditField(pane, 2, '  ', 'change')
      await pane.press({ key: 'done-edit-2' })

      expect(cardKeyedIn(await pane.drawn(), 'goal-2').holder).toMatchObject({
        children: [box, await fieldOfGoal(), { type: 'Text', props: { color: 'warning' } }],
      })
    },
  )

  test('Done saves the text typed into the field, and a blank one gets the warning', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    const edited = 'Fix the crash on rotation and publish v1.45.3 by Friday'
    await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await typeIntoEditField(pane, 2, '  ', 'change')
    await pane.press({ key: 'done-edit-2' })

    expect(await pane.find({ type: 'Text', text: BLANK_TEXT_WARNING })).toBeDefined()
    expect(goalRecordsOf(session)).toEqual(storedBoard())
    await typeIntoEditField(pane, 2, edited, 'change')
    await pane.press({ key: 'done-edit-2' })

    expect(await editFieldIn(pane, 2)).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: edited })).toBeDefined()
    const textRecord = textRecordOf(
      sessionScope(FIRST_SESSION),
      { ...ROTATION_CRASH, text: edited },
      1000,
    )
    expect(goalRecordsOf(session)).toEqual(storedBoard().set(textRecord.key, textRecord.value))
  })

  test('Done on a field left as drawn saves nothing, and closes the field', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    session.refusedWrites.push(FULL_STORE)
    await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.press({ key: 'done-edit-2' })

    expect(session.refusedWrites).toEqual([FULL_STORE])
    expect(await editFieldIn(pane, 2)).toBeUndefined()
    expect(session.toasts).toEqual([])
  })

  test(
    'Done on a field left as drawn, after a text was saved elsewhere, keeps that text, and Done ' +
      'again saves the text in the field',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      editElsewhere(session, ROTATION_CRASH, TEXT_ELSEWHERE)
      const savedElsewhere = new Map(goalRecordsOf(session))
      await pane.press({ key: 'done-edit-2' })

      expect(session.toasts).toEqual([EDITED_ELSEWHERE])
      expect(goalRecordsOf(session)).toEqual(savedElsewhere)
      expect((await editFieldIn(pane, 2))?.props.value).toBe(ROTATION_CRASH.text)
      await pane.press({ key: 'done-edit-2' })

      expect(await editFieldIn(pane, 2)).toBeUndefined()
      const textRecord = textRecordOf(sessionScope(FIRST_SESSION), ROTATION_CRASH, 1000)
      expect(goalRecordsOf(session)).toEqual(savedElsewhere.set(textRecord.key, textRecord.value))
    },
  )

  test(
    'Enter of the text left as drawn, after a text was saved elsewhere, keeps that text',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      editElsewhere(session, ROTATION_CRASH, TEXT_ELSEWHERE)
      const savedElsewhere = new Map(goalRecordsOf(session))
      await typeIntoEditField(pane, 2, ROTATION_CRASH.text)

      expect(session.toasts).toEqual([EDITED_ELSEWHERE])
      expect(goalRecordsOf(session)).toEqual(savedElsewhere)
      expect((await editFieldIn(pane, 2))?.props.value).toBe(ROTATION_CRASH.text)
    },
  )

  test('an edit of a marked goal removes its done mark', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoardWithMark() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await typeIntoEditField(pane, 2, 'Publish the patch release v1.45.4')

    expect(await pane.find({ type: 'Text', text: MARK_TEXT })).toBeUndefined()
    expect(await pane.find({ key: 'unmark-2' })).toBeUndefined()
    expect(session.toasts).toEqual([])
  })

  test('Clear pressed on another goal while a goal is edited ends the edit', async ($, on) => {
    await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await expect(pane.press({ key: 'edit-1' })).rejects.toThrow(NO_FOCUS_IN_KIT)
    await pane.press({ key: 'clear-2' })

    expect(await editFieldIn(pane, 1)).toBeUndefined()
    expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeDefined()
  })

  test(
    'a blank text is not saved, the field stays open with the warning, and Cancel closes it',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      await typeIntoEditField(pane, 2, '  ')

      expect(await pane.find({ type: 'Text', text: BLANK_TEXT_WARNING })).toBeDefined()
      expect(await editFieldIn(pane, 2)).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())
      await pane.press({ key: 'cancel-edit-2' })
      expect(await pane.find({ type: 'Text', text: BLANK_TEXT_WARNING })).toBeUndefined()
      expect(await editFieldIn(pane, 2)).toBeUndefined()
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
    await typeIntoEditField(pane, 2, ROTATION_CRASH.text)

    expect(session.refusedWrites).toEqual([FULL_STORE])
    expect(await editFieldIn(pane, 2)).toBeUndefined()
    expect(session.toasts).toEqual([])
  })

  // The engine empties the field an Enter was pressed in once the Enter was handled, so a field
  // that stayed open under the same key showed no text while Done still saved the text entered.
  test(
    'a text not saved by the store draws the field anew with that text, and Done then saves it',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const entered = 'Ship the tablet layout'
      await expect(pane.press({ key: 'edit-2' })).rejects.toThrow(NO_FOCUS_IN_KIT)
      const firstDrawing = (await editFieldIn(pane, 2))?.key
      session.refusedWrites.push(FULL_STORE)
      await typeIntoEditField(pane, 2, entered)

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The goal was not edited. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      const redrawn = await editFieldIn(pane, 2)
      expect(redrawn?.key).not.toBe(firstDrawing)
      expect(redrawn?.props.value).toBe(entered)
      expect(goalRecordsOf(session)).toEqual(storedBoard())
      await pane.press({ key: 'done-edit-2' })

      expect(await editFieldIn(pane, 2)).toBeUndefined()
      const textRecord = textRecordOf(
        sessionScope(FIRST_SESSION),
        { ...ROTATION_CRASH, text: entered },
        1000,
      )
      expect(goalRecordsOf(session)).toEqual(storedBoard().set(textRecord.key, textRecord.value))
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
      await typeIntoEditField(pane, 1, 'Ship the tablet layout')
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'edit-2' })

      expect(session.toasts).toEqual(['Goal 1 is no longer open.', 'Goal 2 is no longer open.'])
      expect(await editFieldIn(pane, 1)).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    },
  )
})
