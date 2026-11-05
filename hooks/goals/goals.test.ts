import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { PromptOrigin, RenderPropsOf } from 'claude-code'

import type { Goal } from '../../types'
import { PLUGIN } from '../names'
import { RecordKind, recordPrefixOf } from '../pluginStore'
import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  startProcess,
  startSession,
  switchSession,
} from '../testSupport'
import type { Session } from '../testSupport'
import { clearanceRecordOf, goalRecordOf, todoRecordOf } from './boardRecord'
import { boardPrefixOf, sessionScope } from './boardScope'
import { GOALS_COMMAND, GOALS_PANE } from './goalNames'

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Goals',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

const MIGRATION_GUIDE: Goal = {
  id: 'goal-migration-guide',
  number: 1,
  text: 'Write the migration guide',
  addedAt: 100,
  todos: [
    { number: '38', title: 'Guide covers the schema changes', attachedAt: 110 },
    { number: '234', title: 'Guide lists the removed flags', attachedAt: 120 },
  ],
}

const ROTATION_CRASH: Goal = {
  id: 'goal-rotation-crash',
  number: 2,
  text: 'Fix the crash on rotation and publish the patch release',
  addedAt: 200,
  todos: [{ number: '41', title: 'Rotation keeps the open form', attachedAt: 210 }],
}

const STORE_LISTING: Goal = {
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
 * added by the pane, so such an entry rejects with this error in a test.
 */
const NO_FOCUS_IN_KIT = 'no implementation for ui.focus'

const FULL_STORE = 'the store is over 4 MiB'
const UNREADABLE_STORE = 'the store file is not readable'
const NOT_READ = 'The goals of this session could not be read. '
const NOT_TYPED =
  'The goals were not changed. Only a command typed by the user at the prompt adds or clears a goal.'

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

/** The records of a board of FIRST_SESSION with #1 and #2 open and #3 cleared. */
function storedBoard(): Map<string, unknown> {
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
function goalRecordsOf(session: Session): Map<string, unknown> {
  return new Map([...session.store].filter(([key]) => key.startsWith(GOAL_RECORD_PREFIX)))
}

/** Stores the clearance of `goal` as another process of the session does. */
function clearElsewhere(session: Session, goal: Goal): void {
  const clearance = clearanceRecordOf(sessionScope(FIRST_SESSION), goal, 500)
  session.store.set(clearance.key, clearance.value)
}

function mountGoalsPane<Surface extends 'terminal' | 'mobile'>($: Engine, surface: Surface) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId: GOALS_PANE,
    props: PANE_PROPS,
  })
}

async function goalsCommand(
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

function notReadToastsOf(session: Session): string[] {
  return session.toasts.filter(toast => toast.startsWith(NOT_READ))
}

describe('the Goals pane', () => {
  test(
    '/goals opens the pane on every open goal with its TODO entries, without a reply',
    NO_TIME_LIMIT,
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
    NO_TIME_LIMIT,
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

  test('an entry of white space alone adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.input({ key: 'new-goal-4', text: '   ' })

    expect(goalRecordsOf(session)).toEqual(storedBoard())
    expect(session.toasts).toEqual([])
  })

  test(
    'an entry made while another goal is saved adds nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const added = pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' })
      const repeated = pane.input({ key: 'new-goal-4', text: 'Ship the tablet layout' })

      await expect(added).rejects.toThrow(NO_FOCUS_IN_KIT)
      await repeated
      expect(goalRecordsOf(session).size).toBe(storedBoard().size + 1)
      expect(await pane.find({ key: 'clear-5' })).toBeUndefined()
    },
  )

  test(
    'Clear asks once, Keep cancels the question, and Yes, clear clears the goal',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })

      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeDefined()
      expect(await pane.find({ key: 'clear-2' })).toBeUndefined()
      await pane.press({ key: 'keep-2' })
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeUndefined()
      expect(await pane.find({ key: 'clear-2' })).toBeDefined()

      await pane.press({ key: 'clear-2' })
      await pane.press({ key: 'clear-1' })
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear goal #1?' })).toBeDefined()
      expect(goalRecordsOf(session)).toEqual(storedBoard())

      await pane.press({ key: 'confirm-clear-1' })
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear goal #1?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
      expect(await goalsCommand($, 'clear 1')).toBe(
        'Goal #1 is not open: it is cleared or was never added.',
      )
    },
  )

  test(
    'a second Yes, clear pressed while the clear is saved does nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      await Promise.all([
        pane.press({ key: 'confirm-clear-2' }),
        pane.press({ key: 'confirm-clear-2' }),
      ])

      expect(session.toasts).toEqual([])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'a question to clear another goal, asked while a clear is saved, stays open',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      await Promise.all([pane.press({ key: 'confirm-clear-2' }), pane.press({ key: 'clear-1' })])

      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear goal #1?' })).toBeDefined()
    },
  )

  test(
    'Clear pressed on a goal cleared by another process shows a toast, and the goal leaves',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'clear-2' })

      expect(session.toasts).toEqual(['Goal #2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeUndefined()
    },
  )

  test(
    'Yes, clear pressed on a goal cleared by another process shows a toast, and the goal leaves',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'clear-2' })
      clearElsewhere(session, ROTATION_CRASH)
      await pane.press({ key: 'confirm-clear-2' })

      expect(session.toasts).toEqual(['Goal #2 is no longer open.'])
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'Clear pressed while the board cannot be read shows the failure, and the goals stay drawn',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      session.keysRefusal = UNREADABLE_STORE
      await pane.press({ key: 'clear-2' })

      expect(notReadToastsOf(session)).toHaveLength(1)
      expect(notReadToastsOf(session)[0]).toContain(UNREADABLE_STORE)
      expect(session.logs).toContain(session.toasts[0])
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeUndefined()
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test(
    'a board that cannot be read after a refused clear stays drawn as it was last read',
    NO_TIME_LIMIT,
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

      expect(session.toasts).toContain('Goal #2 is no longer open.')
      expect(notReadToastsOf(session)).toHaveLength(1)
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeDefined()
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeDefined()
    },
  )

  test(
    'when the store does not save a goal, the pane draws the same field again, and the toast ' +
      'shows the refusal',
    NO_TIME_LIMIT,
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
    NO_TIME_LIMIT,
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
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeDefined()
      await pane.press({ key: 'confirm-clear-2' })
      expect(await pane.find({ type: 'Text', text: ROTATION_CRASH.text })).toBeUndefined()
    },
  )

  test(
    'an error other than a failure of the store fails the press of Clear, and does not show a ' +
      'toast',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('state.set', { plugin: PLUGIN, key: 'goalToClear' }, () => ({
        deny: 'the state of the plugin is held by another write',
      }))
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')

      await expect(pane.press({ key: 'clear-2' })).rejects.toThrow(
        'the state of the plugin is held by another write',
      )
      expect(session.toasts).toEqual([])
      expect(await pane.find({ type: 'Text', text: 'Clear goal #2?' })).toBeUndefined()
    },
  )

  test(
    'on a surface without input fields the pane shows the commands, and Clear still works',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'mobile')

      expect(
        await pane.find({ type: 'Text', text: 'Add with /goals add <text>. List with /goals.' }),
      ).toBeDefined()
      await pane.press({ key: 'clear-1' })
      await pane.press({ key: 'confirm-clear-1' })
      expect(await pane.find({ type: 'Text', text: MIGRATION_GUIDE.text })).toBeUndefined()
    },
  )
})

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
    'a command in another form explains the form and changes nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const goalsForm =
        'Write /goals, /goals add <text> or /goals clear <number>, such as /goals clear 2.'

      for (const args of ['add', 'add   ']) {
        expect(await goalsCommand($, args)).toBe(
          'Write /goals add <text>, such as /goals add Ship the tablet layout.',
        )
      }
      for (const args of ['clean 2', 'clear', 'clear 0', 'clear two', 'clear 2 3', 'addition']) {
        expect(await goalsCommand($, args)).toBe(goalsForm)
      }
      expect(goalRecordsOf(session)).toEqual(storedBoard())
    },
  )

  for (const origin of Object.values(ORIGINS_NOT_TYPED)) {
    test(
      `/goals add and /goals clear from the origin ${origin.kind} change nothing`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on, { stored: storedBoard() })

        expect(await goalsCommand($, 'add Ship the tablet layout', origin)).toBe(NOT_TYPED)
        expect(await goalsCommand($, 'clear 2', origin)).toBe(NOT_TYPED)
        expect(goalRecordsOf(session)).toEqual(storedBoard())
      },
    )
  }

  test('/goals clear through the Remote Control bridge clears a goal', NO_TIME_LIMIT, async ($, on) => {
    await startSession($, on, { stored: storedBoard() })

    expect(await goalsCommand($, 'clear 2', { kind: 'bridge' })).toBe('Cleared goal #2.')
  })

  test(
    'where the pane cannot open, /goals lists the open goals with their TODO entries and the ' +
      'commands',
    NO_TIME_LIMIT,
    async ($, on) => {
      // Registered before the session starts, so it runs before the hook that places every pane.
      on('ui.open', { id: GOALS_PANE }, () => ({
        value: { isPlaced: false, reason: 'no-surface' },
      }))
      await startSession($, on, { stored: storedBoard() })

      expect(await goalsCommand($, '')).toBe(
        [
          'The Goals pane could not open: no-surface.',
          `#1 ${MIGRATION_GUIDE.text}`,
          '  #38 - Guide covers the schema changes',
          '  #234 - Guide lists the removed flags',
          `#2 ${ROTATION_CRASH.text}`,
          '  #41 - Rotation keeps the open form',
          '',
          'Add with /goals add <text>. Clear with /goals clear <number>.',
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
