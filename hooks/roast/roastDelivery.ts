import type { EngineInterface, MatchedHook, On } from 'claude-code'

import { messageOf } from '../errorMessage'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { callToolWithNote, sendOrRestore } from '../sendToModel'
import { readIsTurnRunning } from '../sessionState'
import { runAfterMainTurn, runDetached } from '../timedWork'
import { openRoastPane } from './roastActions'
import { ROAST_PANE } from './roastNames'
import { describeRoastNote } from './roastPromptTexts'
import {
  addPendingRoast,
  markRoastSent,
  setRoastOfRun,
  takeAllPendingRoasts,
} from './roastState'
import type { PendingRoast, RoastRun, WrittenRoast } from './roastState'
import { ROAST_TO_OTHER_SESSION, describeRoastNotSent } from './roastTexts'

// The engine runs a prompt from a plugin only once the session is idle, so a roast sent as a prompt
// during a long turn would wait for its end and go stale.

export function registerRoastDelivery(on: On): void {
  on('tool.call', EVERY_EVENT, addRoastsToToolResult)
  on('turn.complete', EVERY_EVENT, submitRoastsAfterTurn)
}

/**
 * Sends the roast written for `run`, with the comment typed beside it, as a message of the user
 * once, and closes the Roast pane without waiting for the session. During a turn of the main
 * conversation the roast goes with the next tool result, and otherwise as a prompt. Where the pane
 * does not close, the roast does not go into the state, or the prompt does not enter, the roast and
 * the comment go back into the pane.
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
      () => runDetached($, () => submitWhileNoTurnRuns($), describeRoastNotSent),
      async (error: unknown) => {
        await restoreRoast($, roast)
        showFailure($, describeRoastNotSent(messageOf(error)))
      },
    )
}

// Where reading the turn or taking the roasts fails, the roast stays in the state for the next tool
// result or end of turn.
async function submitWhileNoTurnRuns($: EngineInterface): Promise<void> {
  if (!(await readIsTurnRunning($))) {
    await submitPendingRoasts($)
  }
}

const addRoastsToToolResult: MatchedHook<'tool.call', EveryEvent> = ($, e, next) =>
  callToolWithNote(e, next, async () => {
    const taken = await takeRoastsOfRunningSession($)

    return taken.length === 0
      ? undefined
      : taken.map(roast => describeRoastNote(composeMessage(roast.written))).join('\n\n')
  })

// A roast that went with no tool result during the turn goes as a prompt once the turn ended, also
// after the user interrupted the turn, since the user pressed Send.
const submitRoastsAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  runAfterMainTurn(e, next, () => submitPendingRoasts($))

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
  const entered = await sendOrRestore(
    () => $.prompt.submit({ text: composeMessage(roast.written), asUser: true }),
    ({ drop }) => drop === undefined,
    () => restoreRoast($, roast),
  )
  if (entered.drop !== undefined) {
    showFailure($, describeRoastNotSent(entered.drop))
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
