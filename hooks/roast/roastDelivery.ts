import type { EngineInterface } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import { submitWhileSessionAcceptsPrompts } from '../heldTexts'
import type { HeldTextSource, PromptNoteSource, TakenNote } from '../heldTexts'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import { runDetached } from '../timedWork'
import { openRoastPane } from './roastActions'
import { ROAST_PANE } from './roastNames'
import { RoastNotePlace, describeIdleRoastMessage, describeRoastNote } from './roastPromptTexts'
import {
  RoastSource,
  addPendingRoast,
  markRoastSent,
  setRoastOfRun,
  takeAllPendingRoasts,
} from './roastState'
import type { PendingRoast, RoastRun, WrittenRoast } from './roastState'
import { ROAST_TO_OTHER_SESSION, describeIdleRoastFailed, describeRoastNotSent } from './roastTexts'

/** How a pending roast goes to the model, and where it goes back to when it does not. */
type PendingRoastDelivery = {
  /** The text of the prompt that the roast goes to the model in. */
  prompt: string
  /** The note at `place` that sends the model the roast. */
  noteAt: (place: RoastNotePlace) => string
  /** Puts the roast back where it waits for the next try. */
  restore: () => Promise<void>
  /** The toast for the roast left unsent, with the reason. */
  describeNotSent: (reason: string) => string
}

/** The roasts that have not gone to the model yet, as a source of texts sent to the model. */
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
  const roast: PendingRoast = { ...run, source: RoastSource.Pane, written }
  const { restore, describeNotSent } = deliveryOf($, roast)
  await $.ui
    .close({ id: ROAST_PANE })
    .then(() => deliverRoast($, roast))
    .catch(async (error: unknown) => {
      await restore()
      showFailure($, describeNotSent(messageOf(error)))
    })
}

/**
 * Puts `roast` into the pending roasts, and sends it to the model once, as
 * `submitWhileSessionAcceptsPrompts` describes.
 */
export async function deliverRoast($: EngineInterface, roast: PendingRoast): Promise<void> {
  await addPendingRoast($, roast)
  submitWhileSessionAcceptsPrompts($, roastsSource($))
}

async function takeRoastsNote($: EngineInterface): Promise<string | undefined> {
  const taken = await takeRoastsOfRunningSession($)

  return taken.length === 0 ? undefined : describeRoasts($, taken, RoastNotePlace.ToolResult)
}

/**
 * Removes the pending roasts of the running session, and returns their note beside a prompt typed
 * by the user, with the function that puts them back.
 */
async function takeRoastsBesidePrompt($: EngineInterface): Promise<TakenNote | undefined> {
  const taken = await takeRoastsOfRunningSession($)

  return taken.length === 0
    ? undefined
    : {
      note: describeRoasts($, taken, RoastNotePlace.Prompt),
      restore: async () => {
        for (const roast of taken) {
          await deliveryOf($, roast).restore()
        }
      },
    }
}

/** The note at `place` that sends the model every roast of `roasts`. */
function describeRoasts(
  $: EngineInterface,
  roasts: readonly PendingRoast[],
  place: RoastNotePlace,
): string {
  return roasts.map(roast => deliveryOf($, roast).noteAt(place)).join('\n\n')
}

/** Submits every pending roast written for the running session as a prompt, without waiting. */
async function submitPendingRoasts($: EngineInterface): Promise<void> {
  for (const roast of await takeRoastsOfRunningSession($)) {
    runDetached($, () => submitRoast($, roast), deliveryOf($, roast).describeNotSent)
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
  const { prompt, restore, describeNotSent } = deliveryOf($, roast)
  const submitted = await submitToSessionOrRestore(
    $,
    roast.sessionId,
    { text: prompt, asUser: true },
    restore,
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeNotSent(submitted.reason))
  }
}

/**
 * The delivery of `roast`. A roast from the Roast pane goes back into the pane, and a roast written
 * by the idle roast waits again for the next prompt or tool result.
 */
function deliveryOf($: EngineInterface, roast: PendingRoast): PendingRoastDelivery {
  switch (roast.source) {
    case RoastSource.Pane: {
      const message = composeMessage(roast.written)

      return {
        prompt: message,
        noteAt: place => describeRoastNote(place, message),
        restore: async () => {
          await setRoastOfRun($, roast, roast.written)
          await openRoastPane($)
        },
        describeNotSent: describeRoastNotSent,
      }
    }
    case RoastSource.Idle: {
      const message = describeIdleRoastMessage(roast.text)

      return {
        prompt: message,
        noteAt: () => message,
        restore: () => addPendingRoast($, roast),
        describeNotSent: describeIdleRoastFailed,
      }
    }
  }
}

/** The message of the user: their comment, if they typed one, and the roast after it. */
function composeMessage({ comment, text }: WrittenRoast): string {
  return [comment.trim(), text].filter(part => part !== '').join('\n\n')
}
