import { describe, expect, test } from 'claude-code/testing'
import type { ClassicResultOf, On } from 'claude-code'

import { ANNOUNCED_WORK_HINT } from './announcedWorkHint'
import { BLOCKED_HINT } from './blockedHint'
import { HELD_QUESTION_HINT } from './heldQuestionHint'
import { HINT_KINDS, kindsWithPhraseIn } from './hintKinds'
import { NO_TIME_LIMIT, endTurn, startSession, stopTurn, typePrompt } from './testSupport'
import { WAITING_HINT } from './waitingHint'

/** The paragraphs of the reason of a block before its closing paragraph. */
function reasonsIn(block: string | undefined): string[] {
  return (block ?? '').split('\n\n').slice(0, -1)
}

/** The closing paragraph of the reason of a block. */
function closingOf(block: string | undefined): string | undefined {
  return block?.split('\n\n').at(-1)
}

const WAITING = 'Build 61 passed. My question about the build folders is Still Open.'

// A test with a global or sticky expression starts where the last one stopped, so one message would
// match on one turn and miss on the next.
test('every phrase of every kind is free of the global and sticky flags', () => {
  const phrases = HINT_KINDS.flatMap(kind => kind.phrases)

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
    'I still have open questions about the cache.',
    'The unit still has 3 more open questions.',
    'My question about the cache is still in my message before the last one.',
    'I still have a question for you in my previous message, about the cache.',
    'I still have a question about the cache for you.',
    'My earlier message has a question about the cache.',
    'My message before the last one has a question about the cache.',
    'The questions about the cache are still there.',
    'My question about hooks/waitingHint.ts is still in my message before the last one.',
    'My question about v0.80.0 is still in my previous message.',
    'The question about the cache is\nin my previous message.',
    'The question about the cache is in my last reply.',
    'I asked about the cache in my previous messages.',
    'The question about the cache from two messages ago still stands.',
    'The question about the cache remains open.',
    'My question about the cache stays unanswered.',
    'My question’s still in my last reply, about the cache.',
    'My question about the cache has not been answered yet.',
    'Awaiting your answer on the cache.',
    'See my question above about the cache.',
    'Please see my earlier question about the cache.',
    'The question I asked earlier needs a decision.',
    'The decision on the cache size is still open.',
    'Still open: the question about the cache.',
    'Your approval is still pending.',
    'Point 2 is still open.',
    'Two points are still open: the cache size and the folder name.',
    'Still open: should the cache move to the new disk?',
    'The answer on the cache size is still pending.',
    'The choice of cache size is still open.',
    "You haven't answered one question yet: should the cache move?",
    'You have not yet answered the question about the cache.',
    'You didn’t answer the cache question.',
    'You have yet to answer the question about the cache.',
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
    'I asked a question about the cache. The build is still running.',
    'I asked a question. See my previous message.',
    'My previous message is about the cache. The pane lists no questions.',
    'I answered your question about the cache, and the build is still running.',
    'Your question about the flake is still reproducible on main, so I filed it.',
    'The questions file is still in the repo.',
    'The question hook is still registered.',
    'In your previous message you asked a question about the cache; it is fixed now.',
    'I still have questions about the cache design that I will research myself.',
    'The output still has question marks in place of umlauts.',
    'The test suite is still running in the background, so that result is still open.',
    'The deploy is still pending.',
    'Your PR is still open, CI is green.',
    'I answered your question; the PR is still open.',
    'The PR you asked for is still open.',
    'The decision record PR is still open.',
    'I answered your question about the cache. The deploy is still pending.',
    'The reviewer has not answered yet, so the build goes on.',
    'You answered the cache question, so the build goes on.',
  ]
  for (const message of notWaiting) {
    test(`${JSON.stringify(message)} does not wait for an answer`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(WAITING_HINT)
    })
  }
})

describe('a hint phrase in quoted text', () => {
  const quoting = [
    'The phrase "still open" now needs a question in the same sentence.',
    'The phrase “waiting for you” is on the list.',
    'The table gains `My question about the cache is still open.` as a case.',
    'The table gains this case:\n```ts\nMy question about the cache is still open.\n```',
    'The table gains this case:\n~~~\nPackaging is blocked on the signing key.\n~~~',
    'You wrote:\n> My question about the cache is still open.\nThe hint fired on it.',
    'You wrote:\n  > Next: rebase onto main.\nThe hint fired on it.',
    'The phrase "nothing has changed" counts for the blocked hint.',
  ]
  for (const message of quoting) {
    test(`${JSON.stringify(message)} mentions the phrase without saying it`, () => {
      expect(kindsWithPhraseIn(message)).toEqual([])
    })
  }

  const saying = [
    'My question about "cache size" is still open.',
    'The 12" panel works. My question about the cache is still open, see "notes".',
    "He said 'my question about the cache is still open' earlier.",
    'The cache:\n```\nMy question about the cache is still open.',
  ]
  for (const message of saying) {
    test(`${JSON.stringify(message)} says the phrase`, () => {
      expect(kindsWithPhraseIn(message)).toContain(WAITING_HINT)
    })
  }

  const joining = ['Nothing "new" has changed.', 'Packaging is `still` blocked on the key.']
  for (const message of joining) {
    test(`${JSON.stringify(message)} does not join the words around the quote`, () => {
      expect(kindsWithPhraseIn(message)).toEqual([])
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

describe('the phrases of a message that announces work while the turn ends', () => {
  const announcing = [
    "Build 61 passed.\n\nNext\n- While the build runs, I'm working out why the cache is slow.",
    '**Next**\n- Fix the flake.',
    '## Next steps\n1. Rebase onto main.',
    'Next up:\n- the parser.',
    'Next: rebase the branch.',
    '**Next:** rebase the branch.',
    '- **Next:** rebase the branch.',
    '*Next*\n- Rebase the branch.',
    'Up next\n- the parser.',
    "## What's next\n- the parser.",
    "Next, I'll rebase the branch onto main.",
    'Build 61 passed. Next I will read the build log.',
    "Next up, I'll rebase.",
    "Now I'll rebase the branch.",
    "I'll now rebase the branch.",
    "I'm working on the flaky test.",
    'While the build runs, I am looking into the slow cache.',
    "I'm now investigating why the test hangs.",
    'I’m currently tracing the failing request.',
    "I'm also digging into the cache.",
    "I'm reading the build log.",
    "I'm checking the cache size.",
    "I'm figuring out the slow step.",
    "I'm analysing the profile.",
    "I'm fixing the flake.",
    "We're investigating the hang.",
    'Let me look into the cache.',
    'What I am doing next\n- the parser.',
    "## What I'm doing next\n- the parser.",
    "Here is what I'll do next: rebase.",
    'The build passed, and I am not stopping.',
    "I'm not stopping here.",
    'I am starting unit #202.',
    "I'm now starting the rebase.",
  ]
  for (const message of announcing) {
    test(`${JSON.stringify(message)} announces work`, () => {
      expect(kindsWithPhraseIn(message)).toContain(ANNOUNCED_WORK_HINT)
    })
  }

  const notAnnouncing = [
    'The next build starts at noon.',
    'Next week the cache moves to the new disk.',
    'Next week: the cache moves to the new disk.',
    'The fix is in the next commit.',
    'The app is built with Next.js.',
    'I read the build log and fixed the flake.',
    'I checked the cache: it is warm.',
    "I'm done with the parser.",
    'The reviewer is checking the change.',
    "I'm not looking into the cache any more.",
    "If I'm reading the log right, the cache is cold.",
    "I'm reading your message as a request to drop the flag.",
    "I'm working on the assumption that main is green.",
    "I'm checking in on the cache.",
    "Whatever comes next, I'll wait for the build.",
    'Let me know if the cache should move.',
    "I'm not stopping the build.",
    "I'm starting to think the cache is cold.",
    'You decide what I do next.',
  ]
  for (const message of notAnnouncing) {
    test(`${JSON.stringify(message)} does not announce work`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(ANNOUNCED_WORK_HINT)
    })
  }
})

describe('the phrases of a message that announces a question in place of asking it', () => {
  const holding = [
    'Should I deploy main to the board? I have one more question after that.',
    'I have one question: should the cache move?',
    'I have a question for you about the cache.',
    'I still have two more questions.',
    "I've got another question.",
    'We have a follow-up question on the cache.',
    'More questions after this one.',
    'There are other questions to follow.',
    "I'll ask the next one once you answer.",
    'I will ask the remaining questions later.',
    "I'll ask another question after the build.",
  ]
  for (const message of holding) {
    test(`${JSON.stringify(message)} announces a question`, () => {
      expect(kindsWithPhraseIn(message)).toContain(HELD_QUESTION_HINT)
    })
  }

  const notHolding = [
    'Should the cache move to the new disk?',
    'I have no questions.',
    'I still have 0 open questions, so I continue.',
    'I still have questions about the cache design that I will research myself.',
    'I answered your question about the cache.',
    'I will ask the reviewer to check the cache.',
    "I'll ask the other agent for its findings.",
    'The question hook is still registered.',
  ]
  for (const message of notHolding) {
    test(`${JSON.stringify(message)} does not announce a question`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(HELD_QUESTION_HINT)
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

      const stopped = await stopTurn($, { message: WAITING })

      expect(reasonsIn(stopped.block)).toEqual([WAITING_HINT.text])
    },
  )

  test(
    'the first end on a blocked message is blocked with the blocked hint',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const message = 'Packaging is still blocked on the signing key.'

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([BLOCKED_HINT.text])
    },
  )

  test(
    'the first end on a message that announces work is blocked with the announced work hint',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const message = "Next\n- While the build runs, I'm working out why the cache is slow."

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([ANNOUNCED_WORK_HINT.text])
    },
  )

  test(
    'a message with phrases of every kind is blocked with every hint, in the order of the kinds',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const stopped = await stopTurn($, {
        message: 'Nothing has changed. Everything left waits on your review.\n\nNext\n- Rebase.',
      })

      expect(reasonsIn(stopped.block)).toEqual([
        WAITING_HINT.text,
        BLOCKED_HINT.text,
        ANNOUNCED_WORK_HINT.text,
      ])
    },
  )

  test(
    'a message with phrases of the waiting and the blocked kind is blocked with both hints',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const stopped = await stopTurn($, {
        message: 'Nothing has changed. Everything left waits on your review.',
      })

      expect(reasonsIn(stopped.block)).toEqual([WAITING_HINT.text, BLOCKED_HINT.text])
    },
  )

  test(
    'every block ends with the same closing paragraph, which is no text of a hint kind',
    NO_TIME_LIMIT,
    async ($, on) => {
      stopBeneath(on)
      const closings = [
        closingOf((await stopTurn($, { message: WAITING })).block),
        closingOf((await stopTurn($, { message: 'Packaging is still blocked on the key.' })).block),
      ]

      expect(closings[0]).toBeDefined()
      expect(closings[1]).toBe(closings[0])
      expect(HINT_KINDS.map(kind => kind.text)).not.toContain(closings[0])
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

    expect(reasonsIn((await stopTurn($, { message: WAITING })).block)).toEqual([
      'Run the linter first.',
      WAITING_HINT.text,
    ])
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

      const stopped = await stopTurn($, { message: WAITING })

      expect(stopped.additionalContext).toEqual(['The build is green.'])
      expect(reasonsIn(stopped.block)).toEqual([WAITING_HINT.text])
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
