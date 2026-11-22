import type { EngineInterface } from 'claude-code'

import type { PendingMissingWork } from '../../types'
import { showFailure } from '../failureToast'
import type { PendingTextSource } from '../pendingTexts'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import type { TextWithLine } from '../sendToModel'
import {
  MISSING_WORK_WAITING_AFTER_STOP,
  describeMissingWork,
  describeMissingWorkNotSent,
  describeMissingWorkWaitingForPane,
} from './goalCheckTexts'
import { updatePendingMissingWork } from './goalState'

/** The goals found open by the goal checker, as a source of texts sent to the model. */
export function missingWorkSource($: EngineInterface): PendingTextSource {
  return {
    takeNote: () => takeMissingWorkNote($),
    submit: () => submitMissingWork($),
    describeNotSent: describeMissingWorkNotSent,
    waitingAfterStopToast: MISSING_WORK_WAITING_AFTER_STOP,
    describeWaitingForPane: describeMissingWorkWaitingForPane,
  }
}

/**
 * Submits the goals found open as a prompt that starts a turn. Where the prompt does not enter, the
 * goals wait again.
 */
async function submitMissingWork($: EngineInterface): Promise<void> {
  const pending = await takeMissingWork($)
  if (pending === undefined) {
    return
  }
  const { sessionId } = pending
  // The prompt shows in the transcript itself, so it is sent without a transcript line.
  const submitted = await submitToSessionOrRestore(
    $,
    sessionId,
    { text: describeMissingWork(pending, await $.clock.now()).text },
    async () => {
      await updatePendingMissingWork($, sessionId, waiting => waiting ?? pending)
    },
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeMissingWorkNotSent(submitted.reason))
  }
}

/**
 * Removes the goals found open from the state, and returns their note at the time of the call, if
 * any wait for the session.
 */
async function takeMissingWorkNote($: EngineInterface): Promise<TextWithLine | undefined> {
  const pending = await takeMissingWork($)

  return pending && describeMissingWork(pending, await $.clock.now())
}

/** Removes the goals found open from the state, and returns them, if any wait for the session. */
async function takeMissingWork($: EngineInterface): Promise<PendingMissingWork | undefined> {
  let taken: PendingMissingWork | undefined
  await updatePendingMissingWork($, await $.session.id(), pending => {
    // A retried write runs this again, and the later run overwrites what the earlier one set.
    taken = pending ?? undefined

    return null
  })

  return taken
}
