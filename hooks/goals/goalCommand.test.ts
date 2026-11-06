import { describe, expect, test } from 'claude-code/testing'

import { describeHookFailure } from '../hookFailure'
import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  startProcess,
  startSession,
  switchSession,
} from '../testSupport'
import { boardPrefixOf, sessionScope } from './boardScope'
import { GOALS_COMMAND, GOALS_PANE } from './goalNames'
import {
  MIGRATION_GUIDE,
  NOT_READ,
  ROTATION_CRASH,
  UNREADABLE_STORE,
  addInPane,
  goalsCommand,
  mountGoalsPane,
  notReadToastsOf,
  storedBoard,
  storedBoardWithMark,
} from './goalPaneTestSupport'
import { GOALS_SUBJECT } from './goalTexts'

describe('the /goals command', () => {
  test(
    'where the pane cannot open, /goals lists the open goals with their done marks and the TODO ' +
      'entries attached to them',
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
          `Goal 1: ${MIGRATION_GUIDE.text}`,
          '  #38 - Guide covers the schema changes',
          '  #234 - Guide lists the removed flags',
          `Goal 2: ${ROTATION_CRASH.text}`,
          '  Marked done by Claude: release/v1.45.3',
          '  #41 - Rotation keeps the open form',
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

  // A hook of the test kit that holds a wait runs under the same time limit as the hook of the
  // plugin, so which of the two runs out of time first differs from run to run. The text for a hook
  // that ran out of time is therefore tested without a session.
  test('the reply of /goals that ran out of time leaves out whether a change was saved', () => {
    expect(describeHookFailure(GOALS_SUBJECT, { kind: 'timeout', budget: 10_000 })).toBe(
      'The goals did not finish in time.\nThe debug log has this too.',
    )
    expect(
      describeHookFailure(GOALS_SUBJECT, {
        kind: 'timeout',
        message: 'the store is locked',
        budget: 10_000,
      }),
    ).toBe(
      'The goals did not finish in time.\nThe last failure before that: the store is locked\n' +
        'The debug log has this too.',
    )
  })

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
      const pane = await mountGoalsPane($, 'terminal')

      expect(session.registered).toContain(GOALS_COMMAND)
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
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
      await addInPane(pane, 1, 'Ship the tablet layout')
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
      await pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' })
      session.id = FIRST_SESSION

      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: 'Ship the tablet layout' })).toBeUndefined()
    },
  )
})
