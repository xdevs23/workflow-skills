import { describe, expect, test } from 'claude-code/testing'
import type { On, PromptSubmitInput } from 'claude-code'

import { BLOCKED_HINT } from './blockedHint'
import { HINT_KINDS, kindIdsWithPhraseIn } from './hintKinds'
import { NO_TIME_LIMIT, endTurn, recordPrompts, typePrompt } from './testSupport'
import { WAITING_HINT } from './waitingHint'

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

// A test with a global or sticky expression starts where the last one stopped, so one message would
// match on one turn and miss on the next.
test('every phrase of every kind is free of the global and sticky flags', () => {
  const phrases = Object.values(HINT_KINDS).flatMap(kind => kind.phrases)

  expect(phrases.filter(phrase => phrase.global || phrase.sticky)).toEqual([])
})

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
    'I still have one open question from earlier, about the cache size.',
    'The unit still has two open questions.',
  ]
  for (const message of waiting) {
    test(`${JSON.stringify(message)} waits for an answer`, () => {
      expect(kindIdsWithPhraseIn(message)).toContain('waiting')
    })
  }

  const notWaiting = [
    'Should the build folders be kept between runs?',
    'Build 61 passed. The build folders are open for writing.',
    'I answered your question about the cache.',
    'I will wait for you to merge it.',
    'The upload is waiting on youtube.',
    'Thanks for your answer on the cache. The build is still running.',
    'The band shows 2 open questions.',
    'I still have the logs. The pane lists open questions.',
  ]
  for (const message of notWaiting) {
    test(`${JSON.stringify(message)} does not wait for an answer`, () => {
      expect(kindIdsWithPhraseIn(message)).not.toContain('waiting')
    })
  }
})

describe('the phrases of a message that reports blocked or idle work', () => {
  const blocked = [
    'The release of the parser is Still Blocked.',
    'Packaging is blocked on the signing key.',
    'The releases are blocked on the signing key.',
    'Packaging stays blocked on the signing key.',
    'Packaging remains blocked on the signing key.',
    "The migration can't continue without the dump.",
    'The migration can’t continue without the dump.',
    'The build cannot continue without the key.',
    'The build can not continue without the key.',
    'The flaky test needs you to pick a fix.',
    'There is nothing to do until the mirror syncs.',
    'No workflows are running.',
    'Build 70 passed, and no workflows running.',
    'The mirror sync ended, so nothing is running now.',
    'Nothing has changed since the last check.',
    'Still no change on the mirror.',
    'Build 70 passed. No change on the mirror.',
    'Mirror check: no change since the last check.',
    'Mirror status\nNo change since the last check.',
    'Nothing new came in from the mirror.',
    'Everything left is blocked by the mirror.',
    'Everything left waits on your review of the schema.',
  ]
  for (const message of blocked) {
    test(`${JSON.stringify(message)} reports blocked or idle work`, () => {
      expect(kindIdsWithPhraseIn(message)).toContain('blocked')
    })
  }

  const notBlocked = [
    "I can't find the dump, so I rebuilt it from the schema.",
    'The schema needs your review.',
    'Build 71 made no changes to the cache.',
    'The parser was unblocked on Monday.',
    'Three workflows are running.',
    'The flake has nothing to do with the cache.',
    'This has nothing to do with the cache.',
    'That has nothing to do with the cache.',
    'This has nothing to do with the build.',
    'The refactor makes no change to the public API.',
    'The refactor has no change in behaviour.',
    'The fix is in the lexer, with no change needed in the parser.',
    'No change to the public API.',
    'Rebased. No change in behaviour.',
    'The test hung because the worker blocked on the channel.',
    'Nothing is running on port 8080, so I started the server.',
    'Rebased; nothing has changed in the diff.',
  ]
  for (const message of notBlocked) {
    test(`${JSON.stringify(message)} does not report blocked or idle work`, () => {
      expect(kindIdsWithPhraseIn(message)).not.toContain('blocked')
    })
  }
})

describe('the hint after a message that reports blocked or idle work', () => {
  test(
    'a blocked message adds the blocked hint to the next prompt',
    NO_TIME_LIMIT,
    async ($, on) => {
      const { prompts } = startEngine(on)
      await endTurn($, { answer: 'Packaging is still blocked on the signing key.' })
      await typePrompt($, 'go on')

      expect(prompts[0]?.context).toEqual([BLOCKED_HINT.text])
    },
  )
})

describe('the hints after a message with phrases of both kinds', () => {
  test(
    'a message with phrases of both kinds adds each hint once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const { prompts } = startEngine(on)
      await endTurn($, { answer: 'Nothing has changed. Everything left waits on your review.' })
      await typePrompt($, 'go on')

      expect(prompts[0]?.context).toEqual([WAITING_HINT.text, BLOCKED_HINT.text])
    },
  )
})

describe('the hint after a message that waits for an answer', () => {
  test('a waiting message adds the hint to the next prompt only', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await typePrompt($, 'go on')
    await typePrompt($, 'go on')

    expect(prompts.map(prompt => prompt.context)).toEqual([[WAITING_HINT.text], undefined])
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

  test('a later turn without a waiting phrase clears the hint', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await endTurn($, { answer: 'Build 62 passed.' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a later turn that ends on an error clears the hint', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await endTurn($, { answer: 'The API is overloaded.', reason: 'error' })
    await typePrompt($, 'go on')

    expect(prompts[0]?.context).toBeUndefined()
  })

  test('a prompt started by a scheduled check contains the hint', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await $.prompt.submit({ text: 'go on', origin: { kind: 'scheduled-trigger' }, wait: false })

    expect(prompts[0]?.context).toEqual([WAITING_HINT.text])
  })

  test('the prompt after a slash command contains the hint', NO_TIME_LIMIT, async ($, on) => {
    const { prompts } = startEngine(on)
    await endTurn($, { answer: WAITING })
    await $.prompt.submit({
      text: '/model',
      origin: { kind: 'composer' },
      command: { name: 'model', args: '' },
      wait: false,
    })
    await typePrompt($, 'go on')

    expect(prompts.map(prompt => prompt.context)).toEqual([undefined, [WAITING_HINT.text]])
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
