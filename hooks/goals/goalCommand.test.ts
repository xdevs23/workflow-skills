import { describe, expect, test } from 'claude-code/testing'
import type { PromptOrigin } from 'claude-code'

import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  startProcess,
  startSession,
  switchSession,
} from '../testSupport'
import { MarkRemover } from './board'
import { markRemovalRecordOf } from './boardRecord'
import { boardPrefixOf, sessionScope } from './boardScope'
import { GOALS_COMMAND, GOALS_PANE } from './goalNames'
import {
  FULL_STORE,
  MIGRATION_GUIDE,
  NOT_READ,
  ROTATION_CRASH,
  UNREADABLE_STORE,
  goalRecordsOf,
  goalsCommand,
  mountGoalsPane,
  notReadToastsOf,
  storedBoard,
  storedBoardWithMark,
} from './goalPaneTestSupport'

const NOT_TYPED =
  'The goals were not changed. Only a command typed by the user at the prompt adds, edits, ' +
  'unmarks or clears a goal.'

const EDIT_FORM = 'Write /goals edit <number> <text>, such as /goals edit 2 Ship the tablet layout.'

/** One origin of every kind other than the user typing at the prompt or through the bridge. */
const ORIGINS_NOT_TYPED: {
  [Kind in Exclude<PromptOrigin['kind'], 'composer' | 'bridge'>]: Extract<
    PromptOrigin,
    { kind: Kind }
  >
} = {
  sdk: { kind: 'sdk' },
  'task-notification': { kind: 'task-notification' },
  'scheduled-trigger': { kind: 'scheduled-trigger' },
  peer: { kind: 'peer' },
  'peer-send-message': { kind: 'peer-send-message' },
  'projects-relay': { kind: 'projects-relay' },
  channel: { kind: 'channel', server: 'chat-relay' },
  coordinator: { kind: 'coordinator' },
  observer: { kind: 'observer' },
  'observer-activity': { kind: 'observer-activity' },
  'auto-continuation': { kind: 'auto-continuation' },
  unclassified: { kind: 'unclassified' },
  'slack-ping': { kind: 'slack-ping' },
  plugin: { kind: 'plugin', name: 'another-plugin' },
}

describe('the /goals command', () => {
  test(
    '/goals add adds a goal under the next number, also after the newest goal was cleared',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on)

      expect(await goalsCommand($, 'add Ship the tablet layout')).toBe('Added goal #1.')
      expect(await goalsCommand($, 'clear 1')).toBe('Cleared goal #1.')
      expect(await goalsCommand($, 'add   Ship the tablet layout  ')).toBe('Added goal #2.')
      const pane = await mountGoalsPane($, 'terminal')
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
      expect(await pane.find({ key: 'clear-1' })).toBeUndefined()
    },
  )

  test(
    '/goals clear clears a goal without asking, and clearing it again replies that the goal is ' +
      'not open',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })

      expect(await goalsCommand($, 'clear 2')).toBe('Cleared goal #2.')
      expect(await goalsCommand($, 'clear 2')).toBe(
        'Goal #2 is not open: it is cleared or was never added.',
      )
      expect(await goalsCommand($, 'clear 9')).toBe(
        'Goal #9 is not open: it is cleared or was never added.',
      )
    },
  )

  test(
    '/goals edit gives a goal its new text, and the goal keeps its number and TODO entries',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const edited = 'Fix the crash on rotation and publish v1.45.3 by Friday'

      expect(await goalsCommand($, `edit 2   ${edited} `)).toBe('Edited goal #2.')
      const pane = await mountGoalsPane($, 'terminal')
      expect(await pane.find({ type: 'Text', text: edited })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(
        await pane.find({ type: 'Text', text: '#41 - Rotation keeps the open form' }),
      ).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()
      expect(await goalsCommand($, 'add Ship the tablet layout')).toBe('Added goal #4.')
    },
  )

  test(
    '/goals edit with the text already on the goal, or of a goal not open, changes nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })

      expect(await goalsCommand($, `edit 2 ${ROTATION_CRASH.text}`)).toBe(
        'Goal #2 already has this text.',
      )
      for (const number of [3, 7]) {
        expect(await goalsCommand($, `edit ${number} Ship the tablet layout`)).toBe(
          `Goal #${number} is not open: it is cleared or was never added.`,
        )
      }
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    '/goals unmark removes the done mark of a goal, which stays open',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })

      expect(await goalsCommand($, 'unmark 2')).toBe('Removed the done mark from goal #2.')
      expect(await goalsCommand($, 'unmark 2')).toBe('Goal #2 is not marked as done.')
      expect(await goalsCommand($, 'unmark 1')).toBe('Goal #1 is not marked as done.')
      for (const number of [3, 7]) {
        expect(await goalsCommand($, `unmark ${number}`)).toBe(
          `Goal #${number} is not open: it is cleared or was never added.`,
        )
      }
      const removal = markRemovalRecordOf(sessionScope(FIRST_SESSION), {
        ...ROTATION_CRASH,
        markRemoval: { markedAt: 300, removedAt: 1000, removedBy: MarkRemover.User },
      })
      expect(goalRecordsOf(session)).toEqual(
        storedBoardWithMark().set(removal.key, removal.value),
      )
    },
  )

  test(
    'a command in another form explains the form and changes nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const goalsForm =
        'Write /goals, /goals add <text>, /goals edit <number> <text>, /goals unmark <number> ' +
        'or /goals clear <number>, such as /goals clear 2.'

      for (const args of ['add', 'add   ']) {
        expect(await goalsCommand($, args)).toBe(
          'Write /goals add <text>, such as /goals add Ship the tablet layout.',
        )
      }
      for (const args of [
        'clean 2',
        'clear',
        'clear 0',
        'clear two',
        'clear 2 3',
        'addition',
        'unmark',
        'unmark two',
      ]) {
        expect(await goalsCommand($, args)).toBe(goalsForm)
      }
      for (const args of ['edit', 'edit 2', 'edit 2   ', 'edit two Ship it', 'edit 0 Ship it']) {
        expect(await goalsCommand($, args)).toBe(EDIT_FORM)
      }
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  for (const origin of Object.values(ORIGINS_NOT_TYPED)) {
    test(
      `/goals add, edit, unmark and clear from the origin ${origin.kind} change nothing`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on, { stored: storedBoardWithMark() })

        expect(await goalsCommand($, 'add Ship the tablet layout', origin)).toBe(NOT_TYPED)
        expect(await goalsCommand($, 'edit 2 Ship the tablet layout', origin)).toBe(NOT_TYPED)
        expect(await goalsCommand($, 'unmark 2', origin)).toBe(NOT_TYPED)
        expect(await goalsCommand($, 'clear 2', origin)).toBe(NOT_TYPED)
        expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
      },
    )
  }

  test('/goals clear through the Remote Control bridge clears a goal', NO_TIME_LIMIT, async ($, on) => {
    await startSession($, on, { stored: storedBoard() })

    expect(await goalsCommand($, 'clear 2', { kind: 'bridge' })).toBe('Cleared goal #2.')
  })

  test(
    'where the pane cannot open, /goals lists the open goals with their done marks, their TODO ' +
      'entries and the commands',
    NO_TIME_LIMIT,
    async ($, on) => {
      // Registered before the session starts, so it runs before the hook that places every pane.
      on('ui.open', { id: GOALS_PANE }, () => ({
        value: { isPlaced: false, reason: 'no-surface' },
      }))
      await startSession($, on, { stored: storedBoardWithMark() })

      expect(await goalsCommand($, '')).toBe(
        [
          'The Goals pane could not open: no-surface.',
          `#1 ${MIGRATION_GUIDE.text}`,
          '  #38 - Guide covers the schema changes',
          '  #234 - Guide lists the removed flags',
          `#2 ${ROTATION_CRASH.text}`,
          '  Marked done by Claude: release/v1.45.3',
          '  #41 - Rotation keeps the open form',
          '',
          'Add with /goals add <text>. Edit with /goals edit <number> <text>. Remove a done mark ' +
            'with /goals unmark <number>. Clear with /goals clear <number>.',
        ].join('\n'),
      )
    },
  )

  test(
    '/goals replies that the board cannot be read, with the reason',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.keysRefusal = UNREADABLE_STORE
      const replied = await goalsCommand($, '')

      expect(replied).toStartWith(NOT_READ)
      expect(replied).toContain(UNREADABLE_STORE)
      expect(session.panes).toEqual([GOALS_PANE])
    },
  )

  test(
    'where the pane cannot open and the board cannot be read, /goals replies with both',
    NO_TIME_LIMIT,
    async ($, on) => {
      // Registered before the session starts, so it runs before the hook that places every pane.
      on('ui.open', { id: GOALS_PANE }, () => ({
        value: { isPlaced: false, reason: 'no-surface' },
      }))
      const session = await startSession($, on, { stored: storedBoard() })
      session.keysRefusal = UNREADABLE_STORE
      const replied = (await goalsCommand($, ''))?.split('\n')

      expect(replied?.[0]).toBe('The Goals pane could not open: no-surface.')
      expect(replied?.[1]).toStartWith(NOT_READ)
      expect(replied?.[1]).toContain(UNREADABLE_STORE)
    },
  )

  test(
    '/goals add replies with the refusal when the store does not save the goal',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.refusedWrites.push(FULL_STORE)
      const replied = await goalsCommand($, 'add Ship the tablet layout')

      expect(replied).toStartWith('The goal was not added. ')
      expect(replied).toContain(FULL_STORE)
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    '/goals edit replies with the refusal when the store does not save the text',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.refusedWrites.push(FULL_STORE)
      const replied = await goalsCommand($, 'edit 2 Ship the tablet layout')

      expect(replied).toStartWith('The goal was not edited. ')
      expect(replied).toContain(FULL_STORE)
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    '/goals unmark replies with the refusal when the store does not save the removal',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoardWithMark() })
      session.refusedWrites.push(FULL_STORE)
      const replied = await goalsCommand($, 'unmark 2')

      expect(replied).toStartWith('The done mark was not removed. ')
      expect(replied).toContain(FULL_STORE)
      expect(goalRecordsOf(session)).toEqual(storedBoardWithMark())
    },
  )

  test(
    '/goals replies with the refusal when the store does not save a clear',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.refusedWrites.push(FULL_STORE)
      const replied = await goalsCommand($, 'clear 2')

      expect(replied).toStartWith('The goal was not cleared. ')
      expect(replied).toContain(FULL_STORE)
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  test(
    'a hook of /goals that throws replies with the reason and how to go on',
    NO_TIME_LIMIT,
    async ($, on) => {
      // Registered before the session starts, so it runs before the hook that places every pane.
      on('ui.open', { id: GOALS_PANE }, () => {
        throw new Error('the surface went away')
      })
      await startSession($, on, { stored: storedBoard() })
      const replied = await goalsCommand($, '')

      expect(replied).toStartWith('The goals could not be used: ')
      expect(replied).toContain('go on without the goals')
    },
  )

  test(
    'a refused registration of /goals shows a toast, and the board loads and the start goes on',
    NO_TIME_LIMIT,
    async ($, on) => {
      let isStartPassedOn = false
      // Registered before the session starts, so they run before the hooks of the test session.
      on('command.register', { name: GOALS_COMMAND }, () => ({
        deny: 'a built-in command has this name',
      }))
      on('session.start', { isInteractive: true }, ($, e, next) => {
        isStartPassedOn = true

        return next(e)
      })
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toStartWith('/goals could not be registered')
      expect(session.toasts[0]).toContain('a built-in command has this name')
      expect(isStartPassedOn).toBe(true)
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
    },
  )

  test(
    'in a session without a person at the prompt, /goals is registered and the board is read',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard(), isInteractive: false })

      expect(session.registered).toContain(GOALS_COMMAND)
      expect(await goalsCommand($, 'clear 2')).toBe('Cleared goal #2.')
    },
  )
})

describe('the goals of each session', () => {
  test(
    'a board that cannot be read at the start shows one toast and a note in the pane with the ' +
      'reason, and /goals reads it again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const damagedKey = `${boardPrefixOf(sessionScope(FIRST_SESSION))}damaged`
      const stored = storedBoard().set(damagedKey, { text: 'no version' })
      const session = await startSession($, on, { stored })
      const pane = await mountGoalsPane($, 'terminal')

      expect(notReadToastsOf(session)).toHaveLength(1)
      expect(notReadToastsOf(session)[0]).toContain(damagedKey)
      const note = await pane.find({ type: 'Text', text: NOT_READ })
      expect(note?.text).toBe(notReadToastsOf(session)[0])
      session.store.delete(damagedKey)
      expect(await goalsCommand($, '')).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
    },
  )

  test(
    'a process started with --resume on a board that cannot be read shows one toast',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const damagedKey = `${boardPrefixOf(sessionScope(FIRST_SESSION))}damaged`
      session.store.set(damagedKey, { text: 'no version' })
      await startProcess($, session, { id: FIRST_SESSION, source: 'resume' })

      expect(session.toasts).toHaveLength(1)
      expect(notReadToastsOf(session)).toHaveLength(1)
    },
  )

  test(
    'a switch to another session shows the board of that session',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })

      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
      expect(await goalsCommand($, 'add Ship the tablet layout')).toBe('Added goal #1.')
      expect(await pane.find({ type: 'Text', text: 'Ship the tablet layout' })).toBeDefined()
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Ship the tablet layout' })).toBeUndefined()
    },
  )

  test('/clear shows the board of the new session', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })

    expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    expect(await pane.find({ key: 'new-goal-1' })).toBeDefined()
  })

  test('a fork shows the board of the forked session', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    session.id = SECOND_SESSION
    session.stateHolder += 1
    await $.classic.SessionStart({ source: 'fork', session_id: SECOND_SESSION })

    expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    expect(await pane.find({ key: 'new-goal-1' })).toBeDefined()
  })

  test(
    'a board read after a switch to another session does not go into the state',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard(), isStateKept: true })
      const pane = await mountGoalsPane($, 'terminal')
      session.beforeNextWrite = () => {
        session.id = SECOND_SESSION
      }
      await goalsCommand($, 'add Ship the tablet layout')
      session.id = FIRST_SESSION

      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Ship the tablet layout' })).toBeUndefined()
    },
  )
})
