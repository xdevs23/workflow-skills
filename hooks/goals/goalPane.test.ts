import { describe, expect } from 'claude-code/testing'

import { PLUGIN } from '../names'
import { test } from '../testDeclaration'
import { FIRST_SESSION, startSession } from '../testSupport'
import { clearanceRecordOf } from './boardRecord'
import { boardPrefixOf, sessionScope } from './boardScope'
import { GOALS_PANE } from './goalNames'
import {
  FULL_STORE,
  MIGRATION_GUIDE,
  NO_FOCUS_IN_KIT,
  ROTATION_CRASH,
  STORE_LISTING,
  UNREADABLE_STORE,
  clearElsewhere,
  goalRecordsOf,
  goalsCommand,
  mountGoalsPane,
  notReadToastsOf,
  storedBoard,
  storedBoardWithMark,
} from './goalPaneTestSupport'

describe('the Goals pane', () => {
  test(
    '/goals opens the pane on every open goal with its TODO entries, without a reply',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })

      expect(await goalsCommand($, '')).toBeUndefined()
      expect(session.panes).toEqual([GOALS_PANE])
      const pane = await mountGoalsPane($, 'terminal')
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      for (const todo of ['#41 - Rotation keeps the open form', '#234 - Guide lists the removed']) {
        expect(await pane.find({ type: 'Text', text: todo })).toBeDefined()
      }
      expect(await pane.find({ type: 'Text', text: STORE_LISTING.text })).toBeUndefined()
      expect(await pane.find({ key: 'clear-3' })).toBeUndefined()
    },
  )

  test(
    'a goal entered in the field gets the next number, and the pane draws a new field',
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await expect(
        pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' }),
      ).rejects.toThrow(NO_FOCUS_IN_KIT)

      expect(await pane.find({ type: 'Text', text: 'Ship the tablet layout' })).toBeDefined()
      expect(await pane.find({ key: 'clear-4' })).toBeDefined()
      expect(await pane.find({ key: 'new-goal-4' })).toBeUndefined()
      expect(await pane.find({ key: 'new-goal-5' })).toBeDefined()
    },
  )

  test('an entry of white space alone adds nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.input({ key: 'new-goal-4', text: '   ' })

    expect(goalRecordsOf(session)).toEqual(storedBoard())
    expect(session.toasts).toEqual([])
  })

  test('an entry made while another goal is saved adds nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    const added = pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' })
    const repeated = pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' })

    await expect(added).rejects.toThrow(NO_FOCUS_IN_KIT)
    await repeated
    expect(goalRecordsOf(session).size).toBe(storedBoard().size + 1)
    expect(await pane.find({ key: 'clear-5' })).toBeUndefined()
  })

  test(
    'Clear asks once, Keep cancels the question, and Yes, clear clears the goal',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })

      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeUndefined()
      await pane.press({ key: 'keep-2' })
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeUndefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()

      await pane.press({ key: 'clear-2' })
      await pane.press({ key: 'clear-1' })
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 1?' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())

      await pane.press({ key: 'confirm-clear-1' })
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 1?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      const clearance = clearanceRecordOf(sessionScope(FIRST_SESSION), MIGRATION_GUIDE, 1000)
      expect(goalRecordsOf(session)).toEqual(storedBoard().set(clearance.key, clearance.value))
    },
  )

  test('a second Yes, clear pressed while the clear is saved does nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: 'clear-2' })
    await Promise.all([
      pane.press({ key: 'confirm-clear-2' }),
      pane.press({ key: 'confirm-clear-2' }),
    ])

    expect(session.toasts).toEqual([])
    expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
  })

  test(
    'a question to clear another goal, asked while a clear is saved, stays open',
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      await Promise.all([pane.press({ key: 'confirm-clear-2' }), pane.press({ key: 'clear-1' })])

      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 1?' })).toBeDefined()
    },
  )

  test(
    'Clear pressed on a goal cleared by another process shows a toast, and the goal leaves',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'clear-2' })

      expect(session.toasts).toEqual(['Goal 2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeUndefined()
    },
  )

  test(
    'Yes, clear pressed on a goal cleared by another process shows a toast, and the goal leaves',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'confirm-clear-2' })

      expect(session.toasts).toEqual(['Goal 2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'Clear pressed while the board cannot be read shows the failure, and the goals stay drawn',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      session.keysRefusal = UNREADABLE_STORE
      await pane.press({ key: 'clear-2' })

      expect(notReadToastsOf(session)).toHaveLength(1)
      expect(notReadToastsOf(session)[0]).toContain(UNREADABLE_STORE)
      expect(session.logs).toContain(session.toasts[0])
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test(
    'a board that cannot be read after a refused clear stays drawn as it was last read',
    async ($, on) => {
      const damagedKey = `${boardPrefixOf(sessionScope(FIRST_SESSION))}damaged`
      let isDamageHidden = false
      // Registered before the session starts, so it runs before the store of the test: the read of
      // the clear does not find the damaged record, and the read after it does.
      on('store.get', { key: damagedKey }, ($, e, next) => {
        if (!isDamageHidden) {
          return next(e)
        }
        isDamageHidden = false

        return { value: undefined }
      })
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      clearElsewhere(session, ROTATION_CRASH)
      session.store.set(damagedKey, { text: 'no version' })
      isDamageHidden = true
      await pane.press({ key: 'confirm-clear-2' })

      expect(session.toasts).toContain('Goal 2 is no longer open.')
      expect(notReadToastsOf(session)).toHaveLength(1)
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test(
    'when the store does not save a goal, the pane draws the same field again, and the toast ' +
      'shows the refusal',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      session.refusedWrites.push(FULL_STORE)
      await pane.input({ key: 'new-goal-4', text: 'Prepare the map tiles for v1.46.0' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The goal was not added. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(session.logs).toContain(session.toasts[0])
      expect(await pane.find({ key: 'new-goal-4' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    'a clear the store does not save leaves the goal and its question open, and the toast shows ' +
      'the refusal',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      session.refusedWrites.push(FULL_STORE)
      await pane.press({ key: 'confirm-clear-2' })

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('The goal was not cleared. ')
      expect(session.toasts[0]).toContain(FULL_STORE)
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeDefined()
      await pane.press({ key: 'confirm-clear-2' })
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'an error other than a failure of the store fails the press of Clear, and does not show a ' +
      'toast',
    async ($, on) => {
      on('state.set', { plugin: PLUGIN, key: 'goalInPane' }, () => ({
        deny: 'the state of the plugin is held by another write',
      }))
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')

      await expect(pane.press({ key: 'clear-2' })).rejects.toThrow(
        'the state of the plugin is held by another write',
      )
      expect(session.toasts).toEqual([])
      expect(await pane.find({ type: 'Text', text: 'Clear Goal 2?' })).toBeUndefined()
    },
  )

  test(
    'on a surface without input fields the pane draws a dim line that points to a terminal in ' +
      'place of the field and Edit, draws Unmark, and Clear still works',
    async ($, on) => {
      await startSession($, on, { stored: storedBoardWithMark() })
      const pane = await mountGoalsPane($, 'mobile')

      expect(await pane.find({ key: 'new-goal-4' })).toBeUndefined()
      const line = await pane.find({
        type: 'Text',
        text: 'Add and edit goals in the Goals pane in a terminal.',
      })
      expect(line?.props).toEqual({ dimColor: true })
      expect(await pane.find({ key: 'edit-1' })).toBeUndefined()
      expect(await pane.find({ key: 'unmark-2' })).toBeDefined()
      await pane.press({ key: 'clear-1' })
      await pane.press({ key: 'confirm-clear-1' })
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    },
  )
})
