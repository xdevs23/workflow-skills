import type { EngineInterface, ModelForkResult, UiOpenResult } from 'claude-code'

import { messageOf } from '../errorMessage'
import { moveKeyboardTo } from '../paneFocus'
import { randomWaitAfter } from '../retryWait'
import type { RetryWaits } from '../retryWait'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'
import { runEvery } from '../timedWork'
import { RoastNotWrittenCause, isPassingApiError } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { ROAST_PANE, SEND_KEY } from './roastNames'
import { writeRoastPrompt } from './roastPromptTexts'
import { RoastVerdict, readRoastReply } from './roastReply'
import { RoastShown, recordSecondsWriting, setRoastOfRun, setRoastWriting } from './roastState'
import type { RoastProgressOf, RoastRun } from './roastState'
import { PANE_TITLE, describeSecondsNotShown } from './roastTexts'

// The user may watch the Roast pane while the fork runs again, so the wait before the next try
// grows from two seconds up to half a minute and goes no longer.
const FORK_RETRY_WAITS: RetryWaits = { firstMs: 2000, longestMs: 30_000 }

/** The result of one fork asked for a roast. */
export type ForkedRoast = RoastProgressOf<
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
 * Roast pane. A `finding` that is not empty goes to the fork as a complaint of the user, which the
 * fork takes into the roast or refuses with a reason, and the pane then shows that reason. Asks
 * again after an error of the API that passes, until a fork writes or refuses the roast, fails for
 * good, or the state dropped `run`. A failure thrown on the way shows in the pane too. Every second
 * until then, the pane shows the seconds since the first fork started.
 */
export async function writeRoast(
  $: EngineInterface,
  run: RoastRun,
  finding: string,
): Promise<void> {
  await runCountingSeconds($, run, () =>
    forkRoast($, writeRoastPrompt(finding), roast => showForkedRoast($, run, readVerdict(roast))),
  ).catch(
    async (error: unknown) => {
      const message = messageOf(error)
      await setRoastOfRun($, run, notWritten({ cause: RoastNotWrittenCause.Thrown, message }))
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
 * Asks a fork made from the main conversation for a roast with `prompt`, and hands each result to
 * `useResult`. Asks again after an error of the API that passes, until a fork writes the roast or
 * fails for good, or `useResult` returns false.
 */
export async function forkRoast(
  $: EngineInterface,
  prompt: string,
  useResult: (roast: ForkedRoast) => Promise<boolean>,
): Promise<void> {
  for (let tries = 1; ; tries += 1) {
    const roast = readForkReply(await $.model.fork({ prompt }), tries)
    if (!(await useResult(roast)) || roast.shown !== RoastShown.WritingAgain) {
      return
    }
    await $.clock.sleep(randomWaitAfter(tries, FORK_RETRY_WAITS))
  }
}

/** What a fork reply to a roast shows: the roast, the refusal of the roast, or a failure. */
type ForkedReply = ForkedRoast | RoastProgressOf<RoastShown.Refused>

/** `roast` with the verdict of the fork read from its reply, where the fork replied. */
function readVerdict(roast: ForkedRoast): ForkedReply {
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

/** What the fork reply `reply` to the try numbered `tries` shows for the roast. */
function readForkReply(reply: ModelForkResult, tries: number): ForkedRoast {
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
