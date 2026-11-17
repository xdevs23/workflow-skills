import type { EngineInterface, ModelForkResult, UiOpenResult } from 'claude-code'

import { messageOf } from '../errorMessage'
import { moveKeyboardTo } from '../paneFocus'
import { randomWaitAfter } from '../retryWait'
import type { RetryWaits } from '../retryWait'
import { RoastNotWrittenCause, isPassingApiError } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { ROAST_PANE, SEND_KEY } from './roastNames'
import { writeRoastPrompt } from './roastPromptTexts'
import { RoastShown, setRoastOfRun, setRoastWriting } from './roastState'
import type { RoastProgress, RoastRun } from './roastState'
import { PANE_TITLE } from './roastTexts'

// The user watches the Roast pane while the fork runs again, so the wait before the next try grows
// from two seconds up to half a minute and goes no longer.
const FORK_RETRY_WAITS: RetryWaits = { firstMs: 2000, longestMs: 30_000 }

/** Makes a run of /roast in the running session, and shows its roast as being written. */
export async function startRoast($: EngineInterface): Promise<RoastRun> {
  const run = { sessionId: await $.session.id(), runId: crypto.randomUUID() }
  await setRoastWriting($, run)

  return run
}

export function openRoastPane($: EngineInterface): Promise<UiOpenResult> {
  return $.ui.open({ id: ROAST_PANE, title: PANE_TITLE, focus: true, closeOnEscape: true })
}

/**
 * Asks a fork made from the main conversation for the roast of `run`, with `finding` as one of
 * its points unless it is empty, and shows the result in the Roast pane. Asks again after an error
 * of the API that passes, until a fork writes the roast, fails for good, or the state dropped
 * `run`. A failure thrown on the way shows in the pane too.
 */
export async function writeRoast(
  $: EngineInterface,
  run: RoastRun,
  finding: string,
): Promise<void> {
  await forkUntilDone($, run, writeRoastPrompt(finding)).catch(async (error: unknown) => {
    const message = messageOf(error)
    await setRoastOfRun($, run, notWritten({ cause: RoastNotWrittenCause.Thrown, message }))
    throw error
  })
}

async function forkUntilDone($: EngineInterface, run: RoastRun, prompt: string): Promise<void> {
  for (let tries = 1; ; tries += 1) {
    const roast = readForkReply(await $.model.fork({ prompt }), tries)
    if (!(await setRoastOfRun($, run, roast))) {
      return
    }
    if (roast.shown === RoastShown.Written) {
      // The pane had the keyboard while it showed the notice, so the Send button has it only now.
      return moveKeyboardTo($, { title: PANE_TITLE, requestId: ROAST_PANE, key: SEND_KEY })
    }
    if (roast.shown === RoastShown.NotWritten) {
      return
    }
    await $.clock.sleep(randomWaitAfter(tries, FORK_RETRY_WAITS))
  }
}

/** What the fork reply `reply` to the try numbered `tries` shows in the Roast pane. */
function readForkReply(reply: ModelForkResult, tries: number): RoastProgress {
  if (reply.isAnswered) {
    const text = reply.text.trim()

    return text === ''
      ? notWritten({ cause: RoastNotWrittenCause.EmptyReply })
      : { shown: RoastShown.Written, text, comment: '' }
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

function notWritten(failure: RoastFailure): RoastProgress {
  return { shown: RoastShown.NotWritten, failure }
}
