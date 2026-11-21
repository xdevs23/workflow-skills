import type { EngineInterface, MatchedHook, SessionCompactResult } from 'claude-code'

import { replacesMainConversation } from '../compactionTrigger'
import { messageOf } from '../errorMessage'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { forkRoastWithoutRetry, writeForkPrompt } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { deliverRoast } from './roastDelivery'
import { RoastNotWrittenCause, RoastRecovery, recoveryOf, thrownFailure } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { COMPACTION_ROAST_PROMPT } from './roastPromptTexts'
import { CompactionRoastVerdict, readCompactionRoastReply } from './roastReply'
import { RoastShown, RoastSource } from './roastState'
import {
  COMPACTION_ROAST_FOUND_NO_POINT,
  describeCompactionRoastNotAskedAgain,
  describeCompactionRoastNotWritten,
  describeCompactionRoastNotWrittenToast,
} from './roastTexts'

/**
 * Has a fork roast the chat before a compaction that replaces the main conversation, and runs the
 * compaction without waiting for the fork. The roast goes to the model as deliverRoast describes,
 * once the compaction ended without a skip, so the model reads it after the summary.
 */
export const roastChatBeforeCompaction: MatchedHook<'session.compact', EveryEvent> = async (
  $,
  e,
  next,
) => {
  if (!replacesMainConversation(e)) {
    return next(e)
  }
  const sessionId = await $.session.id()
  const forkPrompt = await writeForkPrompt($, COMPACTION_ROAST_PROMPT)
  // A fork asked after the compaction started may read the summary in place of the chat.
  const roast = forkRoastWithoutRetry($, forkPrompt)
  const compaction = next(e)
  deliverAfterCompaction($, sessionId, roast, compaction).catch((error: unknown) => {
    showFailure($, describeCompactionRoastNotWrittenToast(thrownFailure(messageOf(error))))
  })

  return compaction
}

/**
 * Sends the roast in `roast` to the session `sessionId` once both `roast` and `compaction` ended.
 * Drops it where the compaction failed or was skipped. The engine reports a failed compaction
 * itself, and a skipped one leaves no summary for the roast to follow.
 */
async function deliverAfterCompaction(
  $: EngineInterface,
  sessionId: string,
  roast: Promise<ForkedRoast>,
  compaction: Promise<SessionCompactResult>,
): Promise<void> {
  // Waits for the roast too, so its failure counts as handled while the compaction runs.
  const [compacted] = await Promise.allSettled([compaction, roast])
  if (compacted.status === 'fulfilled' && compacted.value.skip === undefined) {
    await useCompactionRoast($, sessionId, await roast)
  }
}

/** Sends the roast in `roast` to the session `sessionId`, or shows why none was written. */
async function useCompactionRoast(
  $: EngineInterface,
  sessionId: string,
  roast: ForkedRoast,
): Promise<void> {
  switch (roast.shown) {
    case RoastShown.Written:
      await deliverCompactionRoastReply($, sessionId, roast.text)
      break
    case RoastShown.WritingAgain:
      $.ui.log(describeCompactionRoastNotAskedAgain(roast), { to: 'debug' })
      break
    case RoastShown.NotWritten:
      showCompactionRoastFailure($, roast.failure)
      break
  }
}

/** Sends the roast in `reply` to the session `sessionId` unless the fork found no point. */
async function deliverCompactionRoastReply(
  $: EngineInterface,
  sessionId: string,
  reply: string,
): Promise<void> {
  const read = readCompactionRoastReply(reply)
  if (!read.isRead) {
    showCompactionRoastFailure($, {
      cause: RoastNotWrittenCause.UnreadableReply,
      reason: read.reason,
      reply,
    })

    return
  }
  switch (read.model.verdict) {
    case CompactionRoastVerdict.Roast:
      await deliverRoast($, { source: RoastSource.Compaction, sessionId, text: read.model.roast })
      break
    case CompactionRoastVerdict.NoPoint:
      $.ui.log(COMPACTION_ROAST_FOUND_NO_POINT, { to: 'debug' })
      break
  }
}

/**
 * Shows `failure` in a toast where only a person can clear it. A failure that a new fork can get
 * past goes to the debug log alone.
 */
function showCompactionRoastFailure($: EngineInterface, failure: RoastFailure): void {
  switch (recoveryOf(failure)) {
    case RoastRecovery.AskAgain:
      $.ui.log(describeCompactionRoastNotWritten(failure), { to: 'debug' })
      break
    case RoastRecovery.NeedsPerson:
      showFailure($, describeCompactionRoastNotWrittenToast(failure))
      break
  }
}
