import type { EngineInterface, ModelForkResult, UiOpenResult } from 'claude-code'

import { messageOf } from '../errorMessage'
import { readWordsRecordedInSession } from '../ideas/wordsOfSession'
import type { RecordedWords, WordsOfSession } from '../ideas/wordsOfSession'
import { moveKeyboardTo } from '../paneFocus'
import { randomWaitAfter } from '../retryWait'
import type { RetryWaits } from '../retryWait'
import { listRunningAgents } from '../runningAgents'
import type { RunningAgents } from '../runningAgents'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'
import { runEvery } from '../timedWork'
import { readMessagesUnseenByFork } from './messagesUnseenByFork'
import { listOpenGoalsForRoast } from './openGoalsForRoast'
import { RoastNotWrittenCause, isPassingApiError, thrownFailure } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { ROAST_PANE, SEND_KEY } from './roastNames'
import {
  writePromptAfterOpenGoals,
  writePromptAfterRecordedWords,
  writePromptAfterRunningAgents,
  writePromptAfterUnseenMessages,
  writeRoastPrompt,
} from './roastPromptTexts'
import { RoastVerdict, readRoastReply } from './roastReply'
import {
  RoastShown,
  recordSecondAttempt,
  recordSecondsWriting,
  setRoastOfRun,
  setRoastWriting,
} from './roastState'
import type { RoastProgressOf, RoastRun } from './roastState'
import {
  PANE_TITLE,
  describeForkViewUnknown,
  describeRecordedWordsUnknown,
  describeRunningAgentsUnknown,
  describeSecondsNotShown,
} from './roastTexts'

// The user may watch the Roast pane while the fork runs again, so the wait before the next try
// grows from two seconds up to half a minute and goes no longer.
const RETRY_WAITS: RetryWaits = { firstMs: 2000, longestMs: 30_000 }

/** The result of one try of a fork or a completion asked for a roast. */
export type RoastTry = RoastProgressOf<
  RoastShown.Written | RoastShown.WritingAgain | RoastShown.NotWritten
>

/** Makes a run of /roast in the running session, and shows its roast as being written. */
export async function startRoast($: EngineInterface): Promise<RoastRun> {
  const run = { sessionId: await $.session.id(), runId: crypto.randomUUID() }
  await setRoastWriting($, run)

  return run
}

export function openRoastPane($: EngineInterface): Promise<UiOpenResult> {
  return $.ui.open({ id: ROAST_PANE, title: PANE_TITLE, focus: true })
}

/**
 * Asks a fork made from the main conversation for the roast of `run`, and shows the result in the
 * Roast pane. A `finding` that is not empty goes to the fork as a complaint from the user, which
 * the fork takes into the roast or refuses with a reason. A refusal starts the second attempt: a
 * new fork, made from the main conversation as it is by then, gets the same prompt, and the pane
 * shows the reason for a second refusal. Asks again after an error of the API that passes, until a
 * fork writes or refuses the roast, fails for good, or the state dropped `run`. A failure thrown on
 * the way shows in the pane too. Every second until then, the pane shows the seconds since the
 * first fork started.
 */
export async function writeRoast(
  $: EngineInterface,
  run: RoastRun,
  finding: string,
): Promise<void> {
  const prompt = writeRoastPrompt(finding)
  const showVerdictOf = (roast: RoastTry) => showForkedRoast($, run, readVerdict(roast))
  await runCountingSeconds($, run, async () => {
    const firstRoast = await forkRoast(
      $,
      prompt,
      async roast => isRefusedRoast(roast) || showVerdictOf(roast),
    )
    if (isRefusedRoast(firstRoast) && (await recordSecondAttempt($, run))) {
      await forkRoast($, prompt, showVerdictOf)
    }
  }).catch(
    async (error: unknown) => {
      await setRoastOfRun($, run, notWritten(thrownFailure(messageOf(error))))
      throw error
    },
  )
}

/**
 * Runs `work`, and every second puts the whole seconds since it started beside the roast of `run`.
 */
async function runCountingSeconds(
  $: EngineInterface,
  run: RoastRun,
  work: () => Promise<void>,
): Promise<void> {
  const startedAt = await $.clock.now()
  const secondsSinceStart = async () =>
    Math.floor(((await $.clock.now()) - startedAt) / MILLISECONDS_PER_SECOND)
  const ticks = runEvery(
    $,
    MILLISECONDS_PER_SECOND,
    async () => recordSecondsWriting($, run, await secondsSinceStart()),
    describeSecondsNotShown,
  )
  await work().finally(() => ticks.cancel())
}

/**
 * Asks a fork made from the main conversation for a roast with `prompt`, as
 * askAgainAfterPassingErrors asks. Each fork gets the messages of the main conversation that it
 * does not see before `prompt`.
 */
export async function forkRoast(
  $: EngineInterface,
  prompt: string,
  useResult: (roast: RoastTry) => Promise<boolean>,
): Promise<RoastTry> {
  return askAgainAfterPassingErrors($, tries => forkRoastOnce($, prompt, tries), useResult)
}

/**
 * Asks for a roast with `ask`, given the number of the try, sends each result to `useResult`, and
 * returns the result of the last try. After an error of the API that passes, waits as
 * RETRY_WAITS sets and asks again, until a try writes the roast or fails for good, or
 * `useResult` returns false.
 */
export async function askAgainAfterPassingErrors(
  $: EngineInterface,
  ask: (tries: number) => Promise<RoastTry>,
  useResult: (roast: RoastTry) => Promise<boolean>,
): Promise<RoastTry> {
  let roast = await ask(1)
  while ((await useResult(roast)) && roast.shown === RoastShown.WritingAgain) {
    await $.clock.sleep(randomWaitAfter(roast.failedTries, RETRY_WAITS))
    roast = await ask(roast.failedTries + 1)
  }

  return roast
}

/**
 * Asks one fork for a roast with `prompt`, as the try numbered `tries`. The engine stops the budget
 * of a calling hook while the fork runs.
 */
async function forkRoastOnce(
  $: EngineInterface,
  prompt: string,
  tries: number,
): Promise<RoastTry> {
  return askFork($, await writeForkPrompt($, prompt), tries)
}

/**
 * Asks one fork for a roast with `forkPrompt`, made by writeForkPrompt, and does not ask again
 * after an error of the API that passes. The fork is asked before this function returns.
 */
export function forkRoastWithoutRetry(
  $: EngineInterface,
  forkPrompt: string,
): Promise<RoastTry> {
  return askFork($, forkPrompt, 1)
}

/** Asks one fork for a roast with `forkPrompt`, as the try numbered `tries`. */
async function askFork(
  $: EngineInterface,
  forkPrompt: string,
  tries: number,
): Promise<RoastTry> {
  return readModelReply(await $.model.fork({ prompt: forkPrompt }), tries)
}

export async function writeForkPrompt($: EngineInterface, prompt: string): Promise<string> {
  const [openGoals, recorded, running, unseen] = await Promise.all([
    listOpenGoalsForRoast($),
    readWordsRecordedInSession($),
    listRunningAgents($),
    readMessagesUnseenByFork($),
  ])
  const promptWithAgents = writePromptAfterKnownAgents(
    $,
    writePromptAfterKnownWords($, writePromptAfterOpenGoals(prompt, openGoals), recorded),
    running,
  )
  if (!unseen.isKnown) {
    $.ui.log(describeForkViewUnknown(unseen.cause), { to: 'debug' })

    return promptWithAgents
  }

  return writePromptAfterUnseenMessages(promptWithAgents, unseen.messages)
}

function writePromptAfterKnownAgents(
  $: EngineInterface,
  prompt: string,
  running: RunningAgents,
): string {
  if (!running.isKnown) {
    $.ui.log(describeRunningAgentsUnknown(running.cause), { to: 'debug' })

    return prompt
  }

  return writePromptAfterRunningAgents(prompt, running.agents)
}

function writePromptAfterKnownWords(
  $: EngineInterface,
  prompt: string,
  recorded: WordsOfSession,
): string {
  return writePromptAfterRecordedWords(prompt, listKnownWords($, recorded))
}

/** The words in `recorded`. Where they are unknown, logs why for debugging and returns none. */
export function listKnownWords(
  $: EngineInterface,
  recorded: WordsOfSession,
): readonly RecordedWords[] {
  if (!recorded.isKnown) {
    $.ui.log(describeRecordedWordsUnknown(recorded.failure), { to: 'debug' })

    return []
  }

  return recorded.words
}

/** What a fork reply to a roast shows: the roast, the refusal of the roast, or a failure. */
type ForkedReply = RoastTry | RoastProgressOf<RoastShown.Refused>

/** `roast` with the verdict of the fork read from its reply, where the fork replied. */
function readVerdict(roast: RoastTry): ForkedReply {
  if (roast.shown !== RoastShown.Written) {
    return roast
  }
  const read = readRoastReply(roast.text)
  if (!read.isRead) {
    return notWritten({
      cause: RoastNotWrittenCause.UnreadableReply,
      reason: read.reason,
      reply: roast.text,
    })
  }
  switch (read.model.verdict) {
    case RoastVerdict.Roast:
      return { ...roast, text: read.model.roast }
    case RoastVerdict.Refused:
      return { shown: RoastShown.Refused, reason: read.model.reason }
  }
}

/** Whether the fork that wrote `roast` refused the roast. */
function isRefusedRoast(roast: RoastTry): boolean {
  return readVerdict(roast).shown === RoastShown.Refused
}

/** Shows `roast` in the Roast pane for `run`, and returns whether the state still has `run`. */
async function showForkedRoast(
  $: EngineInterface,
  run: RoastRun,
  roast: ForkedReply,
): Promise<boolean> {
  const isShown = await setRoastOfRun($, run, roast)
  if (isShown && roast.shown === RoastShown.Written) {
    // The pane had the keyboard while it showed the notice, so the Send button has it only now.
    await moveKeyboardTo($, { title: PANE_TITLE, requestId: ROAST_PANE, key: SEND_KEY })
  }

  return isShown
}

/**
 * What `reply`, of a fork or a completion asked for a roast as the try numbered `tries`, shows for
 * the roast.
 */
export function readModelReply(reply: ModelForkResult, tries: number): RoastTry {
  if (reply.isAnswered) {
    const text = reply.text.trim()

    return text === ''
      ? notWritten({ cause: RoastNotWrittenCause.EmptyReply })
      : { shown: RoastShown.Written, text, comment: '', outputTokens: reply.usage.output_tokens }
  }
  switch (reply.reason) {
    case 'nothing-to-fork':
      return notWritten({ cause: RoastNotWrittenCause.NothingToFork })
    case 'empty-reply':
      return notWritten({ cause: RoastNotWrittenCause.EmptyReply })
    case 'aborted':
      return notWritten({ cause: RoastNotWrittenCause.Aborted })
    case 'api-error':
      // A null status means that no response arrived, as on a dropped connection.
      return reply.status === null || isPassingApiError(reply.error)
        ? { shown: RoastShown.WritingAgain, failedTries: tries, error: reply.error }
        : notWritten({
            cause: RoastNotWrittenCause.ApiError,
            error: reply.error,
            status: reply.status,
          })
  }
}

function notWritten(failure: RoastFailure): RoastProgressOf<RoastShown.NotWritten> {
  return { shown: RoastShown.NotWritten, failure }
}
