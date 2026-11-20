import type { EngineInterface } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import { PendingTextPlace, submitAddedText } from '../pendingTexts'
import type { PendingTextSource, PromptNoteSource, TakenNote } from '../pendingTexts'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import type { TextWithLine } from '../sendToModel'
import { runDetached } from '../timedWork'
import { openRoastPane } from './roastActions'
import { ROAST_PANE } from './roastNames'
import {
  attributeRoastToRoaster,
  describeIdleRoastMessage,
  describeRoastNote,
} from './roastPromptTexts'
import {
  RoastSource,
  addPendingRoast,
  markRoastSent,
  setRoastOfRun,
  takeAllPendingRoasts,
} from './roastState'
import type { PendingRoast, RoastRun, WrittenRoast } from './roastState'
import {
  ROAST_TO_OTHER_SESSION,
  ROAST_WAITING_AFTER_STOP,
  describeIdleRoastFailed,
  describeRoastNotSent,
  describeRoastSentLine,
  describeRoastWaitingForPane,
} from './roastTexts'

/** How a pending roast goes to the model, and where it goes back to when it does not. */
type PendingRoastDelivery = {
  /** The text of the prompt that the roast goes to the model in. */
  prompt: string
  /** The note at `place` that sends the model the roast, with the line that shows the roast. */
  noteAt: (place: PendingTextPlace) => TextWithLine
  /** Puts the roast back where it waits for the next try. */
  restore: () => Promise<void>
  /** The toast for the roast left unsent, with the reason. */
  describeNotSent: (reason: string) => string
}

/** The roasts that have not gone to the model yet, as a source of texts sent to the model. */
export function roastsSource($: EngineInterface): PendingTextSource & PromptNoteSource {
  return {
    takeNote: () => takeRoastsNote($),
    takeNoteBesidePrompt: () => takeRoastsBesidePrompt($),
    submit: () => submitPendingRoasts($),
    describeNotSent: describeRoastNotSent,
    waitingAfterStopToast: ROAST_WAITING_AFTER_STOP,
    describeWaitingForPane: describeRoastWaitingForPane,
  }
}

/**
 * Sends the roast written for `run`, with the comment typed beside it, once, and closes the Roast
 * pane without waiting for the session. The roast goes to the model as `submitAddedText` describes.
 * Where the pane does not close, the roast does not go into the state, or the prompt does not
 * enter, the roast and the comment go back into the pane.
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
 * Puts `roast` into the pending roasts, and sends it to the model once, as `submitAddedText`
 * describes.
 */
export async function deliverRoast($: EngineInterface, roast: PendingRoast): Promise<void> {
  await addPendingRoast($, roast)
  submitAddedText($, roastsSource($))
}

async function takeRoastsNote($: EngineInterface): Promise<TextWithLine | undefined> {
  const taken = await takeRoastsOfRunningSession($)

  return taken.length === 0 ? undefined : describeRoasts($, taken, PendingTextPlace.ToolResult)
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
      note: describeRoasts($, taken, PendingTextPlace.BesidePrompt),
      restore: async () => {
        for (const roast of taken) {
          await deliveryOf($, roast).restore()
        }
      },
    }
}

/** The note at `place` that sends the model every roast of `roasts`, with their lines. */
function describeRoasts(
  $: EngineInterface,
  roasts: readonly PendingRoast[],
  place: PendingTextPlace,
): TextWithLine {
  const notes = roasts.map(roast => deliveryOf($, roast).noteAt(place))

  return {
    text: notes.map(note => note.text).join('\n\n'),
    line: notes.map(note => note.line).join('\n\n'),
  }
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
        noteAt: place => ({
          text: describeRoastNote(place, message),
          line: describeRoastSentLine(place, message),
        }),
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
        noteAt: place => ({ text: message, line: describeRoastSentLine(place, message) }),
        restore: () => addPendingRoast($, roast),
        describeNotSent: describeIdleRoastFailed,
      }
    }
  }
}

/** The comment typed by the user, if any, then the roast as attributeRoastToRoaster returns it. */
function composeMessage({ comment, text }: WrittenRoast): string {
  return [comment.trim(), attributeRoastToRoaster(text)].filter(part => part !== '').join('\n\n')
}
