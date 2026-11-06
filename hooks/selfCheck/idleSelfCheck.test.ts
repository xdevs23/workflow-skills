import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { PLUGIN } from '../names'
import {
  FIRST_SESSION,
  NO_TIME_LIMIT,
  SECOND_SESSION,
  endTurn,
  notesOfToolResult,
  promptsOfPlugin,
  reloadPlugin,
  startSession,
  startTurn,
  switchSession,
  typePrompt,
} from '../testSupport'
import type { Session } from '../testSupport'

const HOUR = 3_600_000

/** The time without a message from the user after which the self-check is sent, in milliseconds. */
const CHECK_INTERVAL = 4 * HOUR

const SELF_CHECK_TEXT =
  "If you're idle, check whether what you have done and presented is done, and whether the " +
  'premise behind it is right. You might have delivered incomplete or incorrect work. If the ' +
  'user finds the problem first, that is worse than double-checking now.'

const SENT_LINE = 'Self-check: the reminder to check the delivered work was sent to Claude'

function sentLinesOf(session: Session): string[] {
  return session.chatLines.filter(line => line === SENT_LINE)
}

/** The notes read by the model with the prompt of a scheduled task. */
async function notesOfScheduledPrompt($: Engine): Promise<readonly string[]> {
  const submitted = await $.prompt.submit({
    text: 'check the build',
    origin: { kind: 'scheduled-trigger' },
    wait: false,
  })

  return submitted.context ?? []
}

/** Starts a session in which the user typed a message whose turn has ended. */
async function startAfterTypedMessage($: Engine, on: On) {
  const session = await startSession($, on)
  await typePrompt($, 'build the export')
  await startTurn($)
  await endTurn($)

  return session
}

describe('the self-check while the session is idle', () => {
  test(
    'four hours after the message of the user, the self-check is sent as a prompt from the ' +
      'plugin, and again after every further four hours',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([])
      await session.clock.advance(1)

      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
      expect(session.prompts.at(-1)?.origin).toEqual({ kind: 'plugin', name: PLUGIN })
      await startTurn($)
      await endTurn($)
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT, SELF_CHECK_TEXT])
    },
  )

  test('a message of the user starts the four hours again', NO_TIME_LIMIT, async ($, on) => {
    const session = await startAfterTypedMessage($, on)
    await session.clock.advance(3 * HOUR)
    await typePrompt($, 'go on')
    await startTurn($)
    await endTurn($)
    await session.clock.advance(CHECK_INTERVAL - 1)
    expect(promptsOfPlugin(session)).toEqual([])

    await session.clock.advance(1)
    expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
  })

  test(
    'a message of the user that starts no turn moves the due time too',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await session.clock.advance(3 * HOUR)
      await typePrompt($, 'go on')
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
    },
  )

  test(
    'turns started by a scheduled task neither start the four hours again nor send the ' +
      'self-check before it is due',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await session.clock.advance(3 * HOUR)
      expect(await notesOfScheduledPrompt($)).toEqual([])
      await startTurn($)
      await endTurn($)
      await session.clock.advance(CHECK_INTERVAL - 3 * HOUR)

      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
    },
  )

  test(
    'a session in which the user typed nothing is not sent the self-check',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await startTurn($)
      await endTurn($)
      await session.clock.advance(2 * CHECK_INTERVAL)

      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test(
    'a self-check dropped by the engine is still due for the next prompt of a scheduled task, ' +
      'without a toast',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      session.droppedPrompt = 'a stop hook is active'
      await session.clock.advance(CHECK_INTERVAL)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])

      expect(await notesOfScheduledPrompt($)).toEqual([SELF_CHECK_TEXT])
      expect(session.toasts).toEqual([])
    },
  )

  test(
    'a self-check dropped by the engine is sent again at the next due time',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      session.droppedPrompt = 'a stop hook is active'
      await session.clock.advance(CHECK_INTERVAL)
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT, SELF_CHECK_TEXT])
    },
  )

  test(
    'a self-check that fails beneath the plugin shows the failure in a toast and is still due',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('prompt.submit', { origin: { kind: 'plugin' } }, () => {
        throw new Error('failed in a test hook')
      })
      const session = await startAfterTypedMessage($, on)
      await session.clock.advance(CHECK_INTERVAL)
      expect(session.toasts).toHaveLength(1)

      expect(await notesOfScheduledPrompt($)).toEqual([SELF_CHECK_TEXT])
    },
  )

  test(
    'a message of the user typed while the self-check is sent sets the next due time, also when ' +
      'the prompt of the self-check is dropped',
    NO_TIME_LIMIT,
    async ($, on) => {
      let isNextDropped = true
      on('prompt.submit', { origin: { kind: 'plugin' } }, async (hookEngine, e, next) => {
        if (!isNextDropped) {
          return next(e)
        }
        isNextDropped = false
        await typePrompt($, 'go on')

        return { drop: 'a stop hook is active' }
      })
      const session = await startAfterTypedMessage($, on)
      await startTurn($)
      await session.clock.advance(CHECK_INTERVAL + HOUR)
      await endTurn($)
      await session.clock.settle()
      expect(isNextDropped).toBe(false)
      expect(await notesOfScheduledPrompt($)).toEqual([])
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
    },
  )

  test(
    'a command contains nothing while the self-check is due, and the next prompt of a scheduled ' +
      'task contains the self-check',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await startTurn($)
      await session.clock.advance(CHECK_INTERVAL)
      const command = await $.prompt.submit({
        text: '/review',
        command: { name: 'review', args: '' },
        origin: { kind: 'scheduled-trigger' },
        wait: false,
      })

      expect(command.context).toBeUndefined()
      expect(await notesOfScheduledPrompt($)).toEqual([SELF_CHECK_TEXT])
    },
  )

  test(
    'a reload of the plugin, which cancels its timers, sends the self-check at the due time',
    NO_TIME_LIMIT,
    async ($, on) => {
      let isTimerCancelled = false
      on('clock.after', EVERY_EVENT, ($, e, next) =>
        isTimerCancelled ? { deny: 'the plugin reloaded' } : next(e),
      )
      const session = await startSession($, on)
      isTimerCancelled = true
      await typePrompt($, 'build the export')
      isTimerCancelled = false
      await reloadPlugin($)
      await session.clock.advance(CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
    },
  )
})

describe('the self-check during a turn', () => {
  test(
    'a self-check due during a turn is left out of tool results and sent as a prompt when the ' +
      'turn ends',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await startTurn($)
      await session.clock.advance(CHECK_INTERVAL)
      expect(await notesOfToolResult($)).toEqual([])
      expect(promptsOfPlugin(session)).toEqual([])
      await endTurn($)
      await session.clock.settle()

      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
      expect(sentLinesOf(session)).toEqual([])
    },
  )

  test(
    'a self-check due when a scheduled task sends its prompt is added to that prompt once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await startTurn($)
      await session.clock.advance(CHECK_INTERVAL)

      expect(await notesOfScheduledPrompt($)).toEqual([SELF_CHECK_TEXT])
      expect(await notesOfScheduledPrompt($)).toEqual([])
      expect(sentLinesOf(session)).toEqual([SENT_LINE])
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])
    },
  )

  test(
    'a turn that runs through several due times is followed by the self-check once, and the ' +
      'next one comes at the following due time after the message of the user',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startAfterTypedMessage($, on)
      await startTurn($)
      await session.clock.advance(2.5 * CHECK_INTERVAL)
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
      await session.clock.advance(0.5 * CHECK_INTERVAL - 1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])

      await session.clock.advance(1)
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT, SELF_CHECK_TEXT])
    },
  )
})

describe('the self-check across sessions', () => {
  test(
    'a switch to another session sends nothing, also after a turn, a tool call and a scheduled ' +
      'prompt there, and the session switched back to is sent its self-check',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isStateKept: true })
      await typePrompt($, 'build the export')
      await startTurn($)
      await endTurn($)
      await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
      await startTurn($)
      await session.clock.advance(CHECK_INTERVAL)
      expect(await notesOfToolResult($)).toEqual([])
      expect(await notesOfScheduledPrompt($)).toEqual([])
      await endTurn($)
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([])

      await switchSession($, session, { id: FIRST_SESSION, reason: 'resume' })
      await session.clock.settle()
      expect(promptsOfPlugin(session)).toEqual([SELF_CHECK_TEXT])
    },
  )
})
