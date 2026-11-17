import type { EngineInterface, ModelForkResult, UiOpenResult } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import { moveKeyboardTo } from '../paneFocus'
import { randomWaitAfter } from '../retryWait'
import type { RetryWaits } from '../retryWait'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import { runDetached } from '../timedWork'
import { RoastNotWrittenCause, isPassingApiError } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { ROAST_PANE, SEND_KEY } from './roastNames'
import { writeRoastPrompt } from './roastPromptTexts'
import { RoastShown, markRoastSent, setRoastOfRun, setRoastWriting } from './roastState'
import type { RoastProgress, RoastRun, WrittenRoast } from './roastState'
import { PANE_TITLE, ROAST_TO_OTHER_SESSION, describeRoastNotSent } from './roastTexts'

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

/**
 * Sends the roast of `run`, with the comment typed beside it, as a message of the user once, and
 * closes the Roast pane without waiting for the session, which receives it once its turn has ended.
 * Where the session does not receive it, the roast and the comment go back into the pane.
 */
export async function sendRoast($: EngineInterface, run: RoastRun): Promise<void> {
  const written = await markRoastSent($, run)
  if (written === null) {
    return
  }
  const restore = () => restoreRoast($, run, written)
  await $.ui.close({ id: ROAST_PANE }).then(
    () => runDetached($, () => submitRoast($, run, written, restore), describeRoastNotSent),
    async (error: unknown) => {
      await restore()
      showFailure($, describeRoastNotSent(messageOf(error)))
    },
  )
}

async function submitRoast(
  $: EngineInterface,
  run: RoastRun,
  written: WrittenRoast,
  restore: () => Promise<void>,
): Promise<void> {
  const text = composeMessage(written)
  const submitted = await submitToSessionOrRestore(
    $,
    run.sessionId,
    { text, asUser: true },
    restore,
  )
  switch (submitted.outcome) {
    case PromptOutcome.Entered:
      return
    case PromptOutcome.OtherSession:
      return showFailure($, ROAST_TO_OTHER_SESSION)
    case PromptOutcome.Dropped:
      return showFailure($, describeRoastNotSent(submitted.reason))
  }
}

/** The message of the user: their comment, if they typed one, and the roast after it. */
function composeMessage({ comment, text }: WrittenRoast): string {
  return [comment.trim(), text].filter(part => part !== '').join('\n\n')
}

/** Puts `written` back into the state for `run`, and opens the Roast pane on it. */
async function restoreRoast(
  $: EngineInterface,
  run: RoastRun,
  written: WrittenRoast,
): Promise<void> {
  await setRoastOfRun($, run, written)
  await openRoastPane($)
}
