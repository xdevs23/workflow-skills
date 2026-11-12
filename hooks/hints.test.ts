import { describe, expect } from 'claude-code/testing'
import type { ClassicResultOf, On } from 'claude-code'

import { ANNOUNCED_WORK_HINT } from './announcedWorkHint'
import { BLOCKED_HINT } from './blockedHint'
import { COST_FRAMING } from './costFraming'
import { HANDED_DECISION } from './handedDecision'
import { HELD_QUESTION_HINT } from './heldQuestionHint'
import { PHRASE_KINDS, WHOLE_MESSAGE_KINDS, hintOf, kindsWithPhraseIn } from './hintKinds'
import { NOTHING_NEEDS_ACTION_HINT } from './nothingNeedsActionHint'
import { IDLE_REPLY_HINT } from './idleReplyHint'
import { refusalsIn } from './refusals'
import { test } from './testDeclaration'
import { FIRST_SESSION, endTurn, startSession, stopTurn, typePrompt } from './testSupport'
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

const EVERY_KIND = [...WHOLE_MESSAGE_KINDS, ...PHRASE_KINDS]

// A test with a global or sticky expression starts where the last one stopped, so one message would
// match on one turn and miss on the next.
test('every phrase of every kind is free of the global and sticky flags', () => {
  const phrases = EVERY_KIND.flatMap(kind => kind.phrases)

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
    "I'll keep the branch as it is until you answer.",
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
    'The cache decision (#21) is still open.',
    'Decision #21 is still open.',
    'The cache decision (21) is still open.',
    'The cache decision(#21) is still open.',
    'The cache decisions (#21, #22) are still open.',
    'Decisions #21 and #22 are still open.',
    'Points 2 and 3 are still open.',
    'Two points are still open: the cache size and the folder name.',
    'Still open: should the cache move to the new disk?',
    'The answer on the cache size is still pending.',
    'The choice of cache size is still open.',
    "You haven't answered one question yet: should the cache move?",
    'You have not yet answered the question about the cache.',
    'You didn’t answer the cache question.',
    'You have yet to answer the question about the cache.',
    'Open from earlier: I removed the icon line. If you would rather keep it, I can restore it.',
    'Still open from before: the cache size.',
    'Pending from my previous message: the folder name.',
    'Open from earlier\n- the cache size',
    'Open from before — the cache size.',
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
    'The PR for the cache decision (#21) is still open.',
    'The issue about the cache decision is still open.',
    'I answered your question about the cache. The deploy is still pending.',
    'The reviewer has not answered yet, so the build goes on.',
    'The built-in tool shows a panel, but it blocks the turn until you answer it.',
    'The dialog holds the session until you answer.',
    'You answered the cache question, so the build goes on.',
    'The file handle was open from before the restart.',
    'The port is still open from the earlier run.',
    'The port is still open from earlier runs.',
    'Two pull requests are still open from earlier today.',
    'The task is still pending from the last turn.',
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

describe('the phrases of a message that reports that nothing needs action', () => {
  const idle = [
    'Nothing needs action.',
    'Both builds still run. Nothing needs attention.',
    'Nothing requires doing until the build ends.',
    'No action is needed.',
    'No action required.',
    'Nothing to act on.',
    'Nothing actionable came in.',
    'Nothing calls for action.',
    'Nothing needs to be done.',
    'No further action needed.',
    'No action is necessary.',
    'Done and pushed. No action required on your side.',
    'Nothing needs doing until the build ends.',
    'Both builds are green and the queue is empty, so nothing needed action.',
    'Nothing needed attention.',
    'Nothing needed your attention.',
    'Nothing else needed action.',
    'Nothing had needed any action.',
    'No action has been needed.',
    'No actions were needed.',
    'No action was called for.',
    'Nothing called for action.',
    'No action was needed.',
  ]
  for (const message of idle) {
    test(`${JSON.stringify(message)} reports that nothing needs action`, () => {
      expect(kindsWithPhraseIn(message)).toContain(NOTHING_NEEDS_ACTION_HINT)
    })
  }

  const notIdle = [
    'The failing test needs action.',
    'The cache needs attention.',
    'No action items were filed.',
    'The deploy took no action on the cache.',
    'Nothing needs attention in the parser, but the build fails.',
    'Nothing needs doing for the docs. The parser needs a fix.',
    'No action is needed on the cache. The parser fails.',
    'Nothing needed attention in the parser, but the build failed.',
    'No action was needed for the docs. The parser needed a fix.',
    'Nothing needed action until the build failed.',
    'Nothing needed action except the failed build.',
    'Nothing needed attention before the rebase. After it, the parser needed a fix.',
    'No action was needed until then.',
    'Nothing required doing while the build ran.',
  ]
  for (const message of notIdle) {
    test(`${JSON.stringify(message)} does not report that nothing needs action`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(NOTHING_NEEDS_ACTION_HINT)
    })
  }
})

describe('a message made only of idle replies', () => {
  const idle = [
    'Everything clear.',
    'Everything is clear.',
    'Fine.',
    'Nothing to do.',
    'Nothing new.',
    'All clear.',
    'All good!',
    "Everything's fine.",
    'Everything is healthy.',
    'No change.',
    'No changes.',
    'Still nothing new.',
    'Standing by.',
    'Idle.',
    'Nothing to report.',
    'No change. Nothing to do.',
    '  all clear  ',
    'Everything’s fine.',
    'Nothing has changed.',
    'Nothing left to do.',
    'All is well.',
    'All set.',
    'All clear, nothing to do.',
    'Nothing new; standing by.',
    'All clear — nothing to do.',
    'Fine - nothing new.',
    'All good and nothing new.',
    'All clear, and nothing to do.',
    'All clear... nothing to do.',
    'All clear…',
  ]
  for (const message of idle) {
    test(`${JSON.stringify(message)} is an idle reply`, () => {
      expect(kindsWithPhraseIn(message)).toContain(IDLE_REPLY_HINT)
    })
  }

  const notIdle = [
    'Fine. The build passed and the deploy is live.',
    'Nothing new on the mirror, so I started the cache fix.',
    'All clear on the parser. The lexer still fails one test.',
    'The tests are fine.',
    'No change to the public API.',
    'Everything is clear now: the cache was stale, and the fix is on main.',
    'Nothing to do for the docs.',
    `${'Fine '.repeat(40)}but the build fails.`,
  ]
  for (const message of notIdle) {
    test(`${JSON.stringify(message)} is not an idle reply`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(IDLE_REPLY_HINT)
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
    'While the build runs, I am looking into the slow cache.',
    "I'm now investigating why the test hangs.",
    'I’m currently tracing the failing request.',
    "I'm also digging into the cache.",
    "We're investigating the hang.",
    'Let me look into the cache.',
    'What I am doing next\n- the parser.',
    "## What I'm doing next\n- the parser.",
    "Here is what I'll do next: rebase.",
    'The build passed, and I am not stopping.',
    "I'm not stopping here.",
    'I am starting unit #202.',
    "I'm now starting the rebase.",
    "While the build runs, I'm going on with the parser work, without blocking on anything.",
    'I am continuing with the rebase.',
    "We're proceeding with the migration.",
    'Then I pick the fix, start the implementation run, and start the build again right after.',
  ]
  /** One row for each work verb: the verb in a plan, and the verb as work underway. */
  const workVerbs = [
    ['Then I check the log.', "I'm checking the cache size."],
    ['Then I read the build log.', "I'm reading the build log."],
    ['Then I investigate the hang.', "I'm investigating the slow query."],
    ['Then I trace the failing request.', "I'm tracing the slow query."],
    ['Then I analyze the profile.', "I'm analysing the profile."],
    ['Then I research the cache options.', "I'm researching the cache options."],
    ['Then I measure the start-up time.', "I'm measuring the start-up time."],
    ['Then I look into the slow cache.', "I'm looking into the slow query."],
    ['Then I dig into the slow query.', "I'm digging into the slow query."],
    ['Then I work on the flaky test.', "I'm working on the flaky test."],
    ['Then I work out why the cache is slow.', "I'm working out why the query is slow."],
    ['Then I figure out the slow step.', "I'm figuring out the slow step."],
    ['Then I find out why the test hangs.', "I'm finding out why the test hangs."],
    ['Then I try the other fix.', "I'm trying the other fix."],
    ['Then I fix the flake.', "I'm fixing the flake."],
    ['Then I write the migration.', "I'm writing the migration."],
    ['Then I draft the release notes.', "I'm drafting the release notes."],
    ['Then I implement the parser.', "I'm implementing the parser."],
    ['Then I build the release.', "I'm building the release."],
    ['Then I test the migration.', "I'm testing the migration."],
    ['Then I verify the fix.', "I'm verifying the fix."],
    ['Then I review the diff.', "I'm reviewing the diff."],
    ['Then I rebase the branch.', "I'm rebasing the branch."],
    ['Then I merge the branch.', "I'm merging the branch."],
    ['Then I commit the fix.', "I'm committing the fix."],
    ['Then I push the branch.', "I'm pushing the branch."],
    ['Then I deploy the release.', "I'm deploying the release."],
    ['Then I open the pull request.', "I'm opening the pull request."],
    ['Then I pick the fix onto the branch.', "I'm picking the fix onto the branch."],
    ['Then I cherry-pick the fix.', "I'm cherry-picking the fix."],
    ['Then I start the run.', "I'm starting the run."],
    ['Then I stop the nightly build.', "To start it, I'm stopping the nightly build."],
    ['Then I restart the build.', "I'm restarting the build."],
    ['Then I retry the upload.', "I'm retrying the upload."],
    ['Then I resume the run.', "I'm resuming the run."],
    ['Then I run the full suite.', "I'm running the full suite."],
    ['Then I launch the implementation run.', "I'm launching the implementation run."],
    ['Then I kick off the build.', "I'm kicking off the build."],
    ['Then I continue with the rebase.', "I'm continuing with the migration."],
    ['Then I proceed with the migration.', "I'm proceeding with the rebase."],
    ['Then I go on with the parser.', "I'm going on with the migration."],
    ['Then I carry on with the migration.', "I'm carrying on with the parser."],
    ['Then I move on with the migration.', "I'm moving on with the parser."],
    ['Then I move on to the migration.', "I'm moving on to the parser."],
    ['Then I go ahead with the migration.', "I'm going ahead with the parser."],
    ['Then I press ahead with the migration.', "I'm pressing ahead with the parser."],
  ]
  /** One message for each lead of a plan, each way of saying the future, each "next" before "is"
   * and each start of a sentence. */
  const leads = [
    'Then we start the run.',
    'Next, I merge the branch.',
    'After that I start the build again.',
    'Afterwards, I merge the branch.',
    'Build 61 passed, and then I merge the branch.',
    'First I rebase the branch.',
    'Finally, I push the branch.',
    "Then I'll rebase the branch.",
    'Then I will rebase the branch.',
    'Then I am going to rebase the branch.',
    "After that, we're about to merge the branch.",
    "To start it, I'll stop the nightly build.",
    "I'm going to rebase the branch.",
    "I'm about to merge the branch.",
    'We will deploy the release.',
    'Next is the parser rewrite.',
    'Next are the migration tests.',
    'Next comes the parser.',
    'The phone build worked. Next up is the parser.',
    'Up next is the parser.',
    'Next step is the parser.',
    'Next steps are the parser and the lexer.',
    'The next step is the parser.',
    'My next step is the parser.',
    'Our next steps are the parser and the lexer.',
    '- Next is the parser.',
    '**Next is** the parser.',
    '### Next is the parser',
    'Build 61 passed; next is the parser.',
    'Build 61 passed, then I start the run.',
    'Build 61 passed: next is the parser.',
    'Build 61 passed! Next is the parser.',
    'Build 61 passed — next is the parser.',
    'Build 61 passed - next is the parser.',
    'Build 61 passed and next is the parser.',
    'Next in line: the parser.',
    'Next in line is the parser.',
    '**Next in line:** the parser.',
    'The phone build worked. Next in line is the parser.',
    "Next in line, I'll rebase the branch.",
    'Next in line:\n- the parser.',
    'Next-in-line: the parser.',
  ]
  for (const message of [...announcing, ...workVerbs.flat(), ...leads]) {
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
    "Whatever comes next, I'll wait for the build.",
    'Let me know if the cache should move.',
    "I'm not stopping the build.",
    'You decide what I do next.',
    "I'm going on leave tomorrow.",
    "I'm moving on from the old parser.",
    'Then I picked the fix and the build passed.',
    'Then I started the run, and it finished at noon.',
    'Whatever is next is up to you.',
    'The next build is at noon.',
    "Then I'll wait for your answer.",
    "Then I'll be done.",
    "Then I'll let you know.",
    "I'll wait for the build.",
    "I'm going to wait for your answer.",
    "If you want, I'll rebase the branch.",
    'Once the build passes, then I merge the branch.',
    'Next in line is up to you.',
    'She was next in line for the review.',
    'Whatever is next in line is up to you.',
    'Who is next in line for the review?',
  ]
  /** One message for each saying that follows a work verb or "next is" and names no work. */
  const sayings = [
    "If I'm reading the log right, the cache is cold.",
    "I'm reading your message as a request to drop the flag.",
    "I'm working on the assumption that main is green.",
    "I'm checking in on the cache.",
    "I'm starting to think the cache is cold.",
    'Then I start to see why.',
    "I'm stopping here.",
    'Then I stop here.',
    "I'm stopping there.",
    "I'm stopping now.",
    "I'm stopping for today.",
    'Then I stop at the first failure.',
    "I'm stopping to ask which one you want.",
    "I'm stopping after this message.",
    "I'm stopping because the key is missing.",
    "I'm stopping since the key is missing.",
    "I'm stopping so you can decide.",
    "I'm stopping until you answer.",
    "I'm stopping before the deploy step.",
    "I'm stopping early today.",
    "I'm stopping short of the deploy.",
    "I'm stopping with the parser half done.",
    "I'll stop by the channel later.",
    'Build failed twice, I\'m stopping.',
    "I'm running out of context.",
    "I'm running low on context.",
    "I'm running short of context.",
    "I'm running late with the review.",
    "I'm running behind on the review.",
    "I'm running on a VM.",
    "I'm running as a subagent.",
    "I'm running into a permission error.",
    "I'm running in a sandbox.",
    "I'm running at half speed.",
    "I'll run with your naming.",
    "I'm running under a time limit.",
    "I'm running a bit behind.",
    "I'm running a little behind.",
    'Let me run this by you first.',
    "I'm picking up on your point about the cache.",
    'Then I pick up where the last run ended.',
    "I'm picking between the two names.",
    "I'm picking from the two drafts you liked.",
    "I'm picking option 2.",
    "I'll pick one of the two names.",
    'Next is up to you.',
    'Next is your call.',
    'Next steps are yours.',
    'Next is not decided yet.',
    '**Next is** up to you.',
    "Then I'll check back later.",
    "I'm trying to keep this short.",
    "I'll try to be brief.",
    "I'm building on your idea.",
    'Let me start with the summary.',
    'Let me run through the options:',
  ]
  for (const message of [...notAnnouncing, ...sayings]) {
    test(`${JSON.stringify(message)} does not announce work`, () => {
      expect(kindsWithPhraseIn(message)).not.toContain(ANNOUNCED_WORK_HINT)
    })
  }
})

describe('the phrases of a message that ends on a choice left to the user', () => {
  const handing = [
    'Track both repositories, or switch the kernel check off. Which way?',
    'Option A keeps the cache, option B drops it. Which one?',
    'There are two ways to fix it. Which option?\n',
    'Two ways are open. which way?',
    'Two ways are open. Which way ？',
    'Two ways are open. **Which way?**',
    'Two ways are open. _Which one?_',
    'Two ways are open. Which way?!',
  ]
  for (const message of handing) {
    test(`${JSON.stringify(message)} leaves a choice to the user`, () => {
      expect(refusalsIn(message)).toContain(HANDED_DECISION)
    })
  }

  const notHanding = [
    'Which way the cache goes is decided by the rules, so it moves to the new disk.',
    'Which way? That was the question in the issue, and the fix answers it.',
    'I tracked both repositories. The kernel check now passes.',
    'You asked: "Which way?"',
    'The guide shows which one to use.',
  ]
  for (const message of notHanding) {
    test(`${JSON.stringify(message)} does not leave a choice to the user`, () => {
      expect(refusalsIn(message)).not.toContain(HANDED_DECISION)
    })
  }
})

describe('the phrases of a message that labels a decision as a cost', () => {
  const costing = [
    'The intent layer covers both paths.\n- What it costs: text jobs move to the layer first.',
    '**What it costs:** a second registry for text jobs.',
    '- **The cost**: one more module.',
    'Cost: the old client stays for a while.',
    '* What that costs: a rebase of the open branch.',
  ]
  for (const message of costing) {
    test(`${JSON.stringify(message)} labels a decision as a cost`, () => {
      expect(refusalsIn(message)).toContain(COST_FRAMING)
    })
  }

  const notCosting = [
    'The cost of a full run is about four minutes.',
    'Each run costs less once the cache is shared.',
    'The page loads cost-free from the cache.',
    'Cost centres are listed in the report.',
    '> Cost: one more module.',
    '```\nCost: one more module.\n```',
    'The cost',
    ' '.repeat(50_000) + 'x',
    'Cost' + ' '.repeat(50_000) + 'x',
  ]
  for (const message of notCosting) {
    test(`${JSON.stringify(message)} does not label a decision as a cost`, () => {
      expect(refusalsIn(message)).not.toContain(COST_FRAMING)
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
  /**
   * Replaces the classic Stop hook of the engine beneath the plugin, so it returns `result`. The
   * engine also returns the id of the session, which the reminders read at every end of a turn.
   */
  function stopBeneath(on: On, result: ClassicResultOf['classic.Stop'] = {}): void {
    on('classic.Stop', () => result)
    on('session.id', () => ({ value: FIRST_SESSION }))
  }

  test('the first end on a waiting message is blocked with the waiting hint', async ($, on) => {
    stopBeneath(on)

    const stopped = await stopTurn($, { message: WAITING })

    expect(reasonsIn(stopped.block)).toEqual([WAITING_HINT.text])
  })

  test(
    'the first end on a message closing on a choice left to the user is blocked',
    async ($, on) => {
      stopBeneath(on)
      const message = 'Track both repositories, or switch the kernel check off. Which way?'

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([
        hintOf(HANDED_DECISION).text,
      ])
    },
  )

  test(
    'the first end on a message with a cost label is blocked with the cost hint',
    async ($, on) => {
      stopBeneath(on)
      const message =
        `The intent layer covers both paths.\n- What it costs: one more module.\n${WAITING}`

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([
        hintOf(COST_FRAMING).text,
        WAITING_HINT.text,
      ])
    },
  )

  test('the first end on a blocked message is blocked with the blocked hint', async ($, on) => {
    stopBeneath(on)
    const message = 'Packaging is still blocked on the signing key.'

    expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([BLOCKED_HINT.text])
  })

  test(
    'the first end on a message that reports that nothing needs action is blocked with the ' +
      'nothing needs action hint',
    async ($, on) => {
      stopBeneath(on)
      const message = 'Nothing needs action.'

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([
        NOTHING_NEEDS_ACTION_HINT.text,
      ])
    },
  )

  test('the first end on an idle reply is blocked with the idle reply hint', async ($, on) => {
    stopBeneath(on)
    const message = 'All clear.'

    expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([IDLE_REPLY_HINT.text])
  })

  for (const message of ['Nothing to do.', 'No change.']) {
    test(
      `the first end on ${JSON.stringify(message)}, which a phrase of the blocked hint ` +
        'matches too, is blocked with the idle reply hint alone',
      async ($, on) => {
        stopBeneath(on)

        expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([IDLE_REPLY_HINT.text])
      },
    )
  }

  test(
    'the first end on a message that announces work is blocked with the announced work hint',
    async ($, on) => {
      stopBeneath(on)
      const message = "Next\n- While the build runs, I'm working out why the cache is slow."

      expect(reasonsIn((await stopTurn($, { message })).block)).toEqual([ANNOUNCED_WORK_HINT.text])
    },
  )

  test(
    'a message with phrases of several kinds is blocked with the hint of each, in the order of ' +
      'the kinds',
    async ($, on) => {
      stopBeneath(on)
      const stopped = await stopTurn($, {
        message:
          'Nothing has changed. Everything left waits on your review. Nothing needs action.' +
          '\n\nNext\n- Rebase.',
      })

      expect(reasonsIn(stopped.block)).toEqual([
        WAITING_HINT.text,
        BLOCKED_HINT.text,
        NOTHING_NEEDS_ACTION_HINT.text,
        ANNOUNCED_WORK_HINT.text,
      ])
    },
  )

  test(
    'a message with phrases of the waiting and the blocked kind is blocked with both hints',
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
    async ($, on) => {
      stopBeneath(on)
      const closings = [
        closingOf((await stopTurn($, { message: WAITING })).block),
        closingOf((await stopTurn($, { message: 'Packaging is still blocked on the key.' })).block),
      ]

      expect(closings[0]).toBeDefined()
      expect(closings[1]).toBe(closings[0])
      expect(EVERY_KIND.map(kind => kind.text)).not.toContain(closings[0])
    },
  )

  test('the end that follows a block passes', async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: WAITING, followsBlock: true })).block).toBeUndefined()
  })

  test('the end of a subagent passes', async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: WAITING, agentId: 'agent-1' })).block).toBeUndefined()
  })

  test('a message without a hint phrase passes', async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($, { message: 'Build 62 passed.' })).block).toBeUndefined()
  })

  test('an end without a message passes', async ($, on) => {
    stopBeneath(on)

    expect((await stopTurn($)).block).toBeUndefined()
  })

  test('a block asked by a hook beneath comes before the hint', async ($, on) => {
    stopBeneath(on, { block: 'Run the linter first.' })

    expect(reasonsIn((await stopTurn($, { message: WAITING })).block)).toEqual([
      'Run the linter first.',
      WAITING_HINT.text,
    ])
  })

  test('a stop of the session asked by a hook beneath is returned unchanged', async ($, on) => {
    stopBeneath(on, { preventContinuation: true })

    expect(await stopTurn($, { message: WAITING })).toEqual({ preventContinuation: true })
  })

  test('the other fields returned by a hook beneath stay in the result', async ($, on) => {
    stopBeneath(on, { additionalContext: ['The build is green.'] })

    const stopped = await stopTurn($, { message: WAITING })

    expect(stopped.additionalContext).toEqual(['The build is green.'])
    expect(reasonsIn(stopped.block)).toEqual([WAITING_HINT.text])
  })
})

describe('the prompt after a turn that ended on a message with a hint phrase', () => {
  test('the next prompt carries no hint', async ($, on) => {
    const session = await startSession($, on)
    await endTurn($, { answer: WAITING })
    await typePrompt($, 'go on')

    expect(session.prompts[0]?.context).toBeUndefined()
  })
})
