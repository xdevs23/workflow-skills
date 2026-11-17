import type { EngineInterface } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import { submitWhileSessionAcceptsPrompts } from '../heldTexts'
import type { HeldTextSource, PromptNoteSource, TakenNote } from '../heldTexts'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import { runDetached } from '../timedWork'
import { openRoastPane } from './roastActions'
import { ROAST_PANE } from './roastNames'
import { RoastNotePlace, describeRoastNote } from './roastPromptTexts'
import {
  addPendingRoast,
  markRoastSent,
  setRoastOfRun,
  takeAllPendingRoasts,
} from './roastState'
import type { PendingRoast, RoastRun, WrittenRoast } from './roastState'
import { ROAST_TO_OTHER_SESSION, describeRoastNotSent } from './roastTexts'

/** The roasts sent by the user, as a source of texts sent to the model. */
export function roastsSource($: EngineInterface): HeldTextSource & PromptNoteSource {
  return {
    takeNote: () => takeRoastsNote($),
    takeNoteBesidePrompt: () => takeRoastsBesidePrompt($),
    submit: () => submitPendingRoasts($),
    describeNotSent: describeRoastNotSent,
  }
}

/**
 * Sends the roast written for `run`, with the comment typed beside it, as a message of the user
 * once, and closes the Roast pane without waiting for the session. The roast goes to the model as
 * `submitWhileSessionAcceptsPrompts` describes. Where the pane does not close, the roast does not
 * go into the state, or the prompt does not enter, the roast and the comment go back into the pane.
 */
export async function sendRoast($: EngineInterface, run: RoastRun): Promise<void> {
  const written = await markRoastSent($, run)
  if (written === null) {
    return
  }
  const roast = { run, written }
  await $.ui
    .close({ id: ROAST_PANE })
    .then(() => addPendingRoast($, roast))
    .then(
      () => submitWhileSessionAcceptsPrompts($, roastsSource($)),
      async (error: unknown) => {
        await restoreRoast($, roast)
        showFailure($, describeRoastNotSent(messageOf(error)))
      },
    )
}

async function takeRoastsNote($: EngineInterface): Promise<string | undefined> {
  const taken = await takeRoastsOfRunningSession($)

  return taken.length === 0 ? undefined : describeRoasts(taken, RoastNotePlace.ToolResult)
}

/**
 * Removes the pending roasts of the running session, and returns their note beside a prompt typed
 * by the user, with the function that puts them back into the Roast pane.
 */
async function takeRoastsBesidePrompt($: EngineInterface): Promise<TakenNote | undefined> {
  const taken = await takeRoastsOfRunningSession($)

  return taken.length === 0
    ? undefined
    : {
      note: describeRoasts(taken, RoastNotePlace.Prompt),
      restore: async () => {
        for (const roast of taken) {
          await restoreRoast($, roast)
        }
      },
    }
}

/** The note at `place` that sends the model every roast of `roasts`. */
function describeRoasts(roasts: readonly PendingRoast[], place: RoastNotePlace): string {
  return roasts.map(roast => describeRoastNote(place, composeMessage(roast.written))).join('\n\n')
}

/** Submits every pending roast written for the running session as a prompt, without waiting. */
async function submitPendingRoasts($: EngineInterface): Promise<void> {
  for (const roast of await takeRoastsOfRunningSession($)) {
    runDetached($, () => submitRoast($, roast), describeRoastNotSent)
  }
}

/**
 * Removes every pending roast from the state, and returns the ones written for the running session.
 * Drops a roast written for another session, which cannot receive it any more, with a toast.
 */
async function takeRoastsOfRunningSession($: EngineInterface): Promise<PendingRoast[]> {
  const { ofRunningSession, ofOtherSessions } = await takeAllPendingRoasts($)
  if (ofOtherSessions.length > 0) {
    showFailure($, ROAST_TO_OTHER_SESSION)
  }

  return ofRunningSession
}

async function submitRoast($: EngineInterface, roast: PendingRoast): Promise<void> {
  const submitted = await submitToSessionOrRestore(
    $,
    roast.run.sessionId,
    { text: composeMessage(roast.written), asUser: true },
    () => restoreRoast($, roast),
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeRoastNotSent(submitted.reason))
  }
}

/** The message of the user: their comment, if they typed one, and the roast after it. */
function composeMessage({ comment, text }: WrittenRoast): string {
  return [comment.trim(), text].filter(part => part !== '').join('\n\n')
}

/** Puts the written roast of `roast` back into the state for its run, and opens the Roast pane. */
async function restoreRoast($: EngineInterface, { run, written }: PendingRoast): Promise<void> {
  await setRoastOfRun($, run, written)
  await openRoastPane($)
}
