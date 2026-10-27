import { describe, expect, test } from 'claude-code/testing'
import type { On, PromptSubmitInput } from 'claude-code'

import { NO_TIME_LIMIT, endTurn, recordPrompts, typePrompt } from './testSupport'
import { NUDGE } from './waitingNudge'
import { isWaitingForAnswer } from './waitingPhrases'

const WAITING = 'Build 61 passed. My question about the build folders is Still Open.'

/** What the engine beneath the plugin saw, and the id of the session it reports. */
type Beneath = { prompts: PromptSubmitInput[]; sessionId: string }

/** Replaces the engine beneath the plugin with hooks that answer as the engine does. */
function startEngine(on: On): Beneath {
  const beneath = { prompts: recordPrompts(on), sessionId: 'session-1' }
  on('session.id', () => ({ value: beneath.sessionId }))
  on('turn.complete', () => ({ text: '' }))

  return beneath
}

describe('the phrases of a message that waits for an answer', () => {
  const waiting = [
    'One question is waiting for you, number 3, about the cache.',
    'Nothing has changed. Still waiting for your answer on the build folders.',
    'Nothing has changed. Your answer on the build folders is still missing.',
    'Your answer on the build\nfolders is still missing.',
    'My question about the cache is still\nopen.',
    'Still waiting on you: should I fix the flake?',
    'Item 1 waits for your word.',
    'Once you answer, I will rewrite that part.',
    "Once you've answered, the unit starts.",
    'The rule needs your approval before tests are added.',
    'The lint question remains unanswered and is still pending.',
  ]
  for (const message of waiting) {
    test(`${JSON.stringify(message)} waits for an answer`, () => {
      expect(isWaitingForAnswer(message)).toBe(true)
    })
  }

  const notWaiting = [
    'Should the build folders be kept between runs?',
    'Build 61 passed. The build folders are open for writing.',
    'I answered your question about the cache.',
    'I will wait for you to merge it.',
    'The upload is waiting on youtube.',
    'Thanks for your answer on the cache. The build is still running.',
  ]
  for (const message of notWaiting) {
    test(`${JSON.stringify(message)} does not wait for an answer`, () => {
      expect(isWaitingForAnswer(message)).toBe(false)
    })
  }
})

describe('the nudge after a message that waits for an answer', () => {
  test('a waiting message adds the nudge to the next prompt only', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await typePrompt($, 'go on')
    await typePrompt($, 'go on')

    expect(prompts.map(prompt => prompt.context)).toEqual([[NUDGE], undefined])
  })

  test('a message without a waiting phrase adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: 'Build 61 passed. The build folders are open for writing.' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a message of a subagent adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING, agentId: 'agent-1' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('an interrupted turn adds nothing', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING, reason: 'aborted' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a later turn without a waiting phrase clears the nudge', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await endTurn($, { answer: 'Build 62 passed.' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a later turn that ends on an error clears the nudge', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await endTurn($, { answer: 'The API is overloaded.', reason: 'error' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a prompt started by a scheduled check receives the nudge', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await $.prompt.submit({ text: 'go on', origin: { kind: 'scheduled-trigger' }, wait: false })

    expect(prompts[0]?.context).toEqual([NUDGE])
  })

  test('the prompt after a slash command receives the nudge', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await $.prompt.submit({
      text: '/model',
      origin: { kind: 'composer' },
      command: { name: 'model', args: '' },
      wait: false,
    })
    await typePrompt($, 'go on')

    expect(prompts.map(prompt => prompt.context)).toEqual([undefined, [NUDGE]])
  })

  test(
    'a waiting message of one session adds nothing to a prompt of the session /clear switched to',
    NO_TIME_LIMIT,
    async ($, on) => {
      const beneath = startEngine(on)
      await endTurn($, { answer: WAITING })
      beneath.sessionId = 'session-2'
      await typePrompt($, 'go on')

      expect(beneath.prompts[0]?.context).toBeUndefined()
    },
  )
})
