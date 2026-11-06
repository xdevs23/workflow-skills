import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Goal } from '../../types'
import { PLUGIN } from '../names'
import {
  FIRST_SESSION,
  GOALS_NOT_EXHAUSTIVE,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  endTurn,
  readFile,
  startSession,
  startTurn,
  switchSession,
  typePrompt,
} from '../testSupport'
import type { Session } from '../testSupport'
import { goalRecordOf, todoRecordOf } from './boardRecord'
import { boardPrefixOf, sessionScope } from './boardScope'
import { GOALS_COMMAND, LIST_GOALS_TOOL, MARK_GOAL_DONE_TOOL } from './goalNames'

const OFFLINE_MODE: Goal = {
  id: 'goal-offline-mode',
  number: 1,
  text: 'Ship the offline mode',
  addedAt: 100,
  todos: [{ number: '61', title: 'Drafts sync once the connection returns', attachedAt: 110 }],
}

const DARK_THEME: Goal = {
  id: 'goal-dark-theme',
  number: 2,
  text: 'Add the dark theme',
  addedAt: 200,
  todos: [],
}

/** The idle minutes after which the open goals are sent again, in milliseconds. */
const IDLE_TIME = 30 * 60_000

const SUBAGENT = 'agent-1'

const NOT_REMINDED = 'The goals could not be read, so Claude was not reminded of them. '

const UNREADABLE_STORE = 'the store file is not readable'

/** A text on goals as the model reads it while a goal is open, followed by the sentence on them. */
function withSentence(note: string): string {
  return `${note}\n\n${GOALS_NOT_EXHAUSTIVE}`
}

/** The records of a board of FIRST_SESSION with the goals #1 and #2 open. */
function storedBoard(): Map<string, unknown> {
  const scope = sessionScope(FIRST_SESSION)
  const records = [OFFLINE_MODE, DARK_THEME].flatMap(goal => [
    goalRecordOf(scope, goal),
    ...goal.todos.map(todo => todoRecordOf(scope, goal, todo)),
  ])

  return new Map(records.map(record => [record.key, record.value]))
}

/** Runs /goals with `args`, typed by the user at the prompt. */
async function goalsCommand($: Engine, args: string): Promise<void> {
  await $.command.run({
    command: GOALS_COMMAND,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
}

/** The notes the model reads in the result returned by the Read tool. */
async function notesOfToolResult($: Engine, agentId?: string): Promise<readonly string[]> {
  return (await readFile($, agentId)).context ?? []
}

/** The notes the model reads after the prompt typed by the user. */
async function notesOfPrompt($: Engine, text = 'go on'): Promise<readonly string[]> {
  return (await typePrompt($, text)).context ?? []
}

function compact($: Engine, agentId?: string) {
  return $.classic.SessionStart({
    source: 'compact',
    ...(agentId === undefined ? {} : { agent_id: agentId }),
  })
}

/** The prompts the plugin sent on its own, such as the open goals after the idle minutes. */
function promptsOfPlugin(session: Session): string[] {
  return session.prompts.filter(prompt => prompt.origin.kind === 'plugin').map(({ text }) => text)
}

/** The transcript lines about the goals, which the model does not read. */
function goalLinesOf(session: Session): string[] {
  return session.chatLines.filter(line => line.startsWith('Goals: '))
}

function notRemindedToastsOf(session: Session): string[] {
  return session.toasts.filter(toast => toast.startsWith(NOT_REMINDED))
}

describe('the open goals after a compaction', () => {
  test(
    'a compaction adds the open goals and the changes before it to the context, and the ' +
      'changes are not sent again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 2')
      await goalsCommand($, 'add Write the release notes')

      expect((await compact($)).additionalContext).toEqual([
        withSentence(
          [
            '# Open goals',
            '1. Ship the offline mode',
            '   #61 - Drafts sync once the connection returns',
            '3. Write the release notes',
            '',
            'The user cleared goal #2. The user added goal #3: Write the release notes.',
          ].join('\n'),
        ),
      ])
      expect(await notesOfToolResult($)).toEqual([])
      expect(goalLinesOf(session)).toEqual([
        'Goals: the 2 open goals were sent to Claude, with goal 2 cleared and goal 3 added',
      ])
    },
  )

  test(
    'a compaction after the last open goal was cleared adds the note on the clear alone',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')
      await goalsCommand($, 'clear 2')

      expect((await compact($)).additionalContext).toEqual([
        'The user cleared goal #1. The user cleared goal #2. No goal is open now.',
      ])
      expect(await notesOfToolResult($)).toEqual([])
      expect(goalLinesOf(session)).toEqual([
        'Goals: goal 1 cleared and goal 2 cleared, sent to Claude',
      ])
    },
  )

  test('a compaction on a board without open goals adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)

    expect((await compact($)).additionalContext).toBeUndefined()
    expect(goalLinesOf(session)).toEqual([])
  })

  test('a compaction in a subagent adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })

    expect((await compact($, SUBAGENT)).additionalContext).toBeUndefined()
    expect(goalLinesOf(session)).toEqual([])
  })

  test('a compaction with one open goal names it in the transcript', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await goalsCommand($, 'clear 2')
    await notesOfToolResult($)
    await compact($)

    expect(goalLinesOf(session)).toEqual([
      'Goals: goal 2 cleared, sent to Claude',
      'Goals: the open goal was sent to Claude',
    ])
  })

  test(
    'a compaction whose read of the board fails shows the reason in a toast and adds nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.keysRefusal = UNREADABLE_STORE

      expect((await compact($)).additionalContext).toBeUndefined()
      expect(notRemindedToastsOf(session)).toHaveLength(1)
      expect(notRemindedToastsOf(session)[0]).toContain(UNREADABLE_STORE)
      expect(session.logs).toContain(notRemindedToastsOf(session)[0])
    },
  )
})

describe('the goals added or cleared since the model saw the board', () => {
  test('a goal added during a turn is sent with the next tool result once', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await goalsCommand($, 'add Write the release notes')

    expect(await notesOfToolResult($)).toEqual([
      withSentence('The user added goal #3: Write the release notes.'),
    ])
    expect(goalLinesOf(session)).toEqual(['Goals: goal 3 added, sent to Claude'])
    expect(await notesOfToolResult($)).toEqual([])
    expect(await notesOfPrompt($)).toEqual([])
    expect(goalLinesOf(session)).toHaveLength(1)
  })

  test('a goal cleared while idle is sent with the next prompt once', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await goalsCommand($, 'clear 2')

    expect(await notesOfPrompt($)).toEqual([withSentence('The user cleared goal #2.')])
    expect(goalLinesOf(session)).toEqual(['Goals: goal 2 cleared, sent to Claude'])
    expect(await notesOfPrompt($)).toEqual([])
    expect(await notesOfToolResult($)).toEqual([])
  })

  test('a goal edited during a turn is sent with its new text once', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await goalsCommand($, 'edit 2 Add the dark theme by Friday')

    expect(await notesOfToolResult($)).toEqual([
      withSentence('The user edited goal #2: Add the dark theme by Friday.'),
    ])
    expect(goalLinesOf(session)).toEqual(['Goals: goal 2 edited, sent to Claude'])
    expect(await notesOfToolResult($)).toEqual([])
    expect(await notesOfPrompt($)).toEqual([])
  })

  test('a done mark removed by the user reaches the next tool result once', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await $.tool.call({ tool: MARK_GOAL_DONE_TOOL, goal: 2, evidence: 'release/v4.1.0' })
    await goalsCommand($, 'unmark 2')

    expect(await notesOfToolResult($)).toEqual([
      withSentence('The user removed your done mark from goal #2.'),
    ])
    expect(goalLinesOf(session)).toEqual(['Goals: goal 2 unmarked, sent to Claude'])
    expect(await notesOfToolResult($)).toEqual([])
    expect(await notesOfPrompt($)).toEqual([])
  })

  test(
    'tool results that finish at the same moment give the note to one of them',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'add Write the release notes')
      const results = await Promise.all([readFile($), readFile($), readFile($)])

      expect(results.flatMap(result => result.context ?? [])).toEqual([
        withSentence('The user added goal #3: Write the release notes.'),
      ])
    },
  )

  test(
    'a prompt that does not enter leaves the note for the next prompt',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('prompt.submit', { text: 'refused prompt' }, () => ({ drop: 'refused by a test hook' }))
      const session = await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')

      expect((await typePrompt($, 'refused prompt')).drop).toBe('refused by a test hook')
      expect(goalLinesOf(session)).toEqual([])
      expect(await notesOfPrompt($)).toEqual([withSentence('The user cleared goal #1.')])
      expect(goalLinesOf(session)).toEqual(['Goals: goal 1 cleared, sent to Claude'])
    },
  )

  test(
    'a tool result from a subagent has no note, and the next tool result in the main ' +
      'conversation does',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')

      expect(await notesOfToolResult($, SUBAGENT)).toEqual([])
      expect(goalLinesOf(session)).toEqual([])
      expect(await notesOfToolResult($)).toEqual([withSentence('The user cleared goal #1.')])
    },
  )

  test(
    'clearing the last open goal adds a note that no goal is open, and then nothing follows',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')
      await goalsCommand($, 'clear 2')

      expect(await notesOfToolResult($)).toEqual([
        'The user cleared goal #1. The user cleared goal #2. No goal is open now.',
      ])
      expect((await compact($)).additionalContext).toBeUndefined()
      expect(await notesOfToolResult($)).toEqual([])
    },
  )

  test(
    'the goals on the board when the session starts or is resumed are not sent as changes',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })

      expect(await notesOfToolResult($)).toEqual([])
      await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })
      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      expect(await notesOfToolResult($)).toEqual([])
    },
  )

  test(
    'a tool call denied by a hook has no note, and the next tool result does',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('tool.call', { tool: 'Bash' }, () => ({ deny: 'refused by a test hook' }))
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')

      expect((await $.tool.call({ tool: 'Bash', command: 'ls' })).context).toBeUndefined()
      expect(await notesOfToolResult($)).toEqual([withSentence('The user cleared goal #1.')])
    },
  )

  test(
    'the result of a goal tool contains the note, and the sentence on the goals once',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')
      const listed = await $.tool.call({ tool: LIST_GOALS_TOOL })

      expect(listed.result).toBe(
        withSentence('#2: Add the dark theme\n\nCleared by the user:\n#1: Ship the offline mode'),
      )
      expect(listed.context).toEqual(['The user cleared goal #1.'])
    },
  )

  test(
    'a slash command has no note, and the next prompt sent to the model does',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')
      const command = await $.prompt.submit({
        text: '/review',
        command: { name: 'review', args: '' },
        origin: { kind: 'composer' },
        wait: false,
      })

      expect(command.context).toBeUndefined()
      expect(await notesOfPrompt($)).toEqual([withSentence('The user cleared goal #1.')])
    },
  )

  test(
    'a prompt that fails beneath the plugin leaves the note for the next prompt',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('prompt.submit', { text: 'failing prompt' }, () => {
        throw new Error('failed in a test hook')
      })
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')

      await expect(typePrompt($, 'failing prompt')).rejects.toThrow()
      expect(await notesOfPrompt($)).toEqual([withSentence('The user cleared goal #1.')])
    },
  )

  test(
    'a prompt that does not enter takes back its note and keeps a change sent since',
    NO_TIME_LIMIT,
    async ($, on) => {
      let readDuringPrompt: Promise<readonly string[]> | undefined
      on('prompt.submit', { text: 'refused prompt' }, async () => {
        await goalsCommand($, 'clear 2')
        readDuringPrompt = notesOfToolResult($)
        await readDuringPrompt

        return { drop: 'refused by a test hook' }
      })
      await startSession($, on, { stored: storedBoard() })
      await goalsCommand($, 'clear 1')
      await typePrompt($, 'refused prompt')

      expect(await readDuringPrompt).toEqual(['The user cleared goal #2. No goal is open now.'])
      expect(await notesOfPrompt($)).toEqual(['The user cleared goal #1. No goal is open now.'])
    },
  )

  test('a goal added after /clear is sent to the model', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })
    await goalsCommand($, 'add Write the release notes')

    expect(await notesOfPrompt($)).toEqual([
      withSentence('The user added goal #1: Write the release notes.'),
    ])
  })
})

describe('a board that could not be read at the start', () => {
  test(
    'shows only the toast from the start, and the first read that works sends the open goals once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const damagedKey = `${boardPrefixOf(sessionScope(FIRST_SESSION))}damaged`
      const stored = storedBoard().set(damagedKey, { text: 'no version' })
      const session = await startSession($, on, { stored })

      expect(await notesOfToolResult($)).toEqual([])
      expect(notRemindedToastsOf(session)).toEqual([])
      session.store.delete(damagedKey)
      await goalsCommand($, 'add Write the release notes')
      expect(await notesOfToolResult($)).toEqual([
        withSentence(
          [
            '# Open goals',
            '1. Ship the offline mode',
            '   #61 - Drafts sync once the connection returns',
            '2. Add the dark theme',
            '3. Write the release notes',
          ].join('\n'),
        ),
      ])
      expect(goalLinesOf(session)).toEqual(['Goals: the 3 open goals were sent to Claude'])
      expect(await notesOfToolResult($)).toEqual([])
    },
  )
})

describe('the open goals after the idle minutes', () => {
  const REMINDER_OF_FIRST_GOAL =
    'Goal #1 is not satisfied yet: Ship the offline mode. Attached: #61 (Drafts sync once the ' +
    'connection returns).'
  const REMINDER = [
    REMINDER_OF_FIRST_GOAL,
    'Goal #2 is not satisfied yet: Add the dark theme.',
    GOALS_NOT_EXHAUSTIVE,
  ].join('\n\n')

  test(
    'the open goals are sent as a prompt from the plugin 30 idle minutes after a turn, once ' +
      'until another turn starts',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME - 1)
      expect(promptsOfPlugin(session)).toEqual([])
      await session.clock.advance(1)

      expect(promptsOfPlugin(session)).toEqual([REMINDER])
      expect(session.prompts.at(-1)?.origin).toEqual({ kind: 'plugin', name: PLUGIN })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)
      expect(promptsOfPlugin(session)).toEqual([REMINDER])

      await typePrompt($, 'go on')
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)
      expect(promptsOfPlugin(session)).toEqual([REMINDER, REMINDER])
    },
  )

  test(
    'a turn that starts within the idle minutes sends nothing, and its end waits again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(12 * 60_000)
      await startTurn($)
      await session.clock.advance(IDLE_TIME)
      expect(promptsOfPlugin(session)).toEqual([])

      await endTurn($)
      await session.clock.advance(IDLE_TIME)
      expect(promptsOfPlugin(session)).toEqual([REMINDER])
    },
  )

  test(
    'a turn of a subagent neither ends the idle minutes nor starts them',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await startTurn($, SUBAGENT)
      await $.turn.complete({
        answer: '',
        durationMs: 5,
        isAborted: false,
        turnId: 'subagent-turn',
        reason: 'answer',
        agentId: SUBAGENT,
      })
      await session.clock.advance(IDLE_TIME)

      expect(promptsOfPlugin(session)).toEqual([REMINDER])
    },
  )

  test('a turn the user interrupted is followed by the open goals too', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    await startTurn($)
    await endTurn($, { reason: 'aborted' })
    await session.clock.advance(IDLE_TIME)

    expect(promptsOfPlugin(session)).toEqual([REMINDER])
  })

  test(
    'a session without a person at the prompt is sent the open goals too',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard(), isInteractive: false })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)

      expect(promptsOfPlugin(session)).toEqual([REMINDER])
    },
  )

  test(
    'the reminder carries the changes the model has not seen, and they are not sent again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await goalsCommand($, 'clear 2')
      await session.clock.advance(IDLE_TIME)

      expect(promptsOfPlugin(session)).toEqual([
        [REMINDER_OF_FIRST_GOAL, 'The user cleared goal #2.', GOALS_NOT_EXHAUSTIVE].join('\n\n'),
      ])
      expect(await notesOfToolResult($)).toEqual([])
    },
  )

  test('a board without open goals sends nothing', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await startTurn($)
    await endTurn($)
    await session.clock.advance(IDLE_TIME)

    expect(promptsOfPlugin(session)).toEqual([])
  })

  test(
    'a switch to another session sends no prompt after the idle minutes',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'clear' })
      await session.clock.advance(IDLE_TIME)

      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test(
    'a reminder that the engine drops shows no toast, and the next idle minutes send it again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      session.droppedPrompt = 'a stop hook is active'
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)

      expect(promptsOfPlugin(session)).toEqual([REMINDER])
      expect(session.toasts).toEqual([])
      await session.clock.advance(IDLE_TIME)
      expect(promptsOfPlugin(session)).toEqual([REMINDER, REMINDER])
    },
  )

  test(
    'a reminder that fails beneath the plugin shows the failure in a toast, and the next idle ' +
      'minutes send it again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const submitted: string[] = []
      let isFailing = true
      on('prompt.submit', { origin: { kind: 'plugin' } }, (_, e) => {
        if (isFailing) {
          isFailing = false
          throw new Error('failed in a test hook')
        }
        submitted.push(e.text)

        return { text: e.text }
      })
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)

      expect(submitted).toEqual([])
      expect(session.toasts).toHaveLength(1)
      await session.clock.advance(IDLE_TIME)
      expect(submitted).toEqual([REMINDER])
      expect(session.toasts).toHaveLength(1)
    },
  )

  test(
    'a turn of the user that runs while the reminder is submitted counts as the turn of the ' +
      'reminder, and the end of the next turn waits again',
    NO_TIME_LIMIT,
    async ($, on) => {
      const submitted: string[] = []
      on('prompt.submit', { origin: { kind: 'plugin' } }, async (_, e) => {
        if (submitted.length === 0) {
          await startTurn($)
          await endTurn($)
        }
        submitted.push(e.text)

        return { text: e.text }
      })
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)
      await startTurn($)
      await endTurn($)
      await session.clock.advance(IDLE_TIME)

      expect(submitted).toEqual([REMINDER, REMINDER])
    },
  )

  test(
    'a turn that starts while the board is read for the reminder sends nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      let startsTurn = false
      const recordKey = goalRecordOf(sessionScope(FIRST_SESSION), OFFLINE_MODE).key
      on('store.get', { key: recordKey }, async (_, e, next) => {
        if (startsTurn) {
          startsTurn = false
          await startTurn($)
        }

        return next(e)
      })
      const session = await startSession($, on, { stored: storedBoard() })
      await startTurn($)
      await endTurn($)
      startsTurn = true
      await session.clock.advance(IDLE_TIME)

      expect(startsTurn).toBe(false)
      expect(promptsOfPlugin(session)).toEqual([])
    },
  )
})
