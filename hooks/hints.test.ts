import { describe, expect, test } from 'claude-code/testing'
import type { ClassicResultOf, On } from 'claude-code'

import { BLOCKED_HINT } from './blockedHint'
import { HINT_KINDS, kindsWithPhraseIn } from './hintKinds'
import { NO_TIME_LIMIT, endTurn, startSession, stopTurn, typePrompt } from './testSupport'
import { ASK_TOOL, QUESTION_SKILL } from './names'
import { WAITING_HINT } from './waitingHint'

const WAITING = 'Build 61 passed. My question about the build folders is Still Open.'

// A test with a global or sticky expression starts where the last one stopped, so one message would
// match on one turn and miss on the next.
test('every phrase of every kind is free of the global and sticky flags', () => {
  const phrases = HINT_KINDS.flatMap(kind => kind.phrases)

  expect(phrases.filter(phrase => phrase.global || phrase.sticky)).toEqual([])
})

test('the waiting hint names the question skill and the tool that asks the user', () => {
  expect(WAITING_HINT.text).toContain(QUESTION_SKILL)
  expect(WAITING_HINT.text).toContain(ASK_TOOL)
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
    'I still have open questions about the cache.',
    'The unit still has 3 more open questions.',
  ]
  for (const message of waiting) {
    test(`${JSON.stringify(message)} waits for an answer`, () => {
      expect(kindsWithPhraseIn(message)).toContain(WAITING_HINT)
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
    'I still have no open questions.',
    'The unit still has zero open questions.',
    'I still have 0 open questions, so I continue.',
    'I still have the logs, and the pane lists open questions.',
    'I still have the logs\n- The pane lists open questions',
    'Done. I still have to close the open questions in TODO.md myself.',
  ]
  for (const message of notWaiting) {
    test(`${JSON.stringify(message)} does not wait for an answer`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(WAITING_HINT)
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
    "Packaging passed. What's left for you:",
    'What’s left for you: the review of the schema.',
    'What is left for you is the review of the schema.',
    'The rollout is still waiting on your decision.',
    'The release is waiting for you.',
  ]
  for (const message of blocked) {
    test(`${JSON.stringify(message)} reports blocked or idle work`, () => {
      expect(kindsWithPhraseIn(message)).toContain(BLOCKED_HINT)
    })
  }

  const notBlocked = [
    'What’s left for you: nothing.',
    "What's left for you — none, everything is merged.",
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
    'What is left for your team is the review.',
    'I asked what was left for you to review.',
    'The upload is waiting on youtube.',
  ]
  for (const message of notBlocked) {
    test(`${JSON.stringify(message)} does not report blocked or idle work`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(BLOCKED_HINT)
    })
  }
})

describe('the end of a turn on a message with a hint phrase', () => {
  /** Replaces the classic Stop hook of the engine beneath the plugin, so it returns `result`. */
  function stopBeneath(on: On, result: ClassicResultOf['classic.Stop'] = {}): void {
    on('classic.Stop', () => result)
  }

  test(
    'the first end on a waiting message is blocked with the waiting hint',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)

      expect((await stopTurn($, { message: WAITING })).block).toBe(WAITING_HINT.text)
    },
  )

  test(
    'the first end on a blocked message is blocked with the blocked hint',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const message = 'Packaging is still blocked on the signing key.'

      expect((await stopTurn($, { message })).block).toBe(BLOCKED_HINT.text)
    },
  )

  test(
    'a message with phrases of both kinds is blocked with both hints',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const stopped = await stopTurn($, {
        message: 'Nothing has changed. Everything left waits on your review.',
      })

      expect(stopped.block).toBe(`${WAITING_HINT.text}\n\n${BLOCKED_HINT.text}`)
    },
  )

  test('the end that follows a block passes', NO_TIME_LIMIT, async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: WAITING, followsBlock: true })).block).toBeUndefined()
  })

  test('the end of a subagent passes', NO_TIME_LIMIT, async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: WAITING, agentId: 'agent-1' })).block).toBeUndefined()
  })

  test('a message without a hint phrase passes', NO_TIME_LIMIT, async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: 'Build 62 passed.' })).block).toBeUndefined()
  })

  test('an end without a message passes', NO_TIME_LIMIT, async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($)).block).toBeUndefined()
  })

  test('a block asked by a hook beneath comes before the hint', NO_TIME_LIMIT, async ($, on) => {
    stopBeneath(on, { block: 'Run the linter first.' })

    expect((await stopTurn($, { message: WAITING })).block).toBe(
      `Run the linter first.\n\n${WAITING_HINT.text}`,
    )
  })

  test(
    'a stop of the session asked by a hook beneath is returned unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on, { preventContinuation: true })

      expect(await stopTurn($, { message: WAITING })).toEqual({ preventContinuation: true })
    },
  )

  test(
    'the other fields returned by a hook beneath stay in the result',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on, { additionalContext: ['The build is green.'] })

      expect(await stopTurn($, { message: WAITING })).toEqual({
        additionalContext: ['The build is green.'],
        block: WAITING_HINT.text,
      })
    },
  )
})

describe('the prompt after a turn that ended on a message with a hint phrase', () => {
  test('the next prompt carries no hint', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await endTurn($, { answer: WAITING })
    await typePrompt($, 'go on')

    expect(session.prompts[0]?.context).toBeUndefined()
  })
})
