import type { MatchedHook, SessionCompactResult } from 'claude-code'

import { replacesMainConversation } from '../compactionTrigger'
import { messageOf } from '../errorMessage'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { forkRoastWithoutRetry, writeForkPrompt } from './roastActions'
import type { RoastTry } from './roastActions'
import { deliverRoast } from './roastDelivery'
import { thrownFailure } from './roastFailure'
import { useRoastOrNoPoint } from './roastOrNoPoint'
import type { RoastOrNoPointTexts } from './roastOrNoPoint'
import { COMPACTION_ROAST_PROMPT } from './roastPromptTexts'
import { RoastSource } from './roastState'
import {
  COMPACTION_ROAST_FOUND_NO_POINT,
  describeCompactionRoastNotAskedAgain,
  describeCompactionRoastNotWritten,
  describeCompactionRoastNotWrittenToast,
} from './roastTexts'

const COMPACTION_ROAST_TEXTS: RoastOrNoPointTexts = {
  foundNoPoint: COMPACTION_ROAST_FOUND_NO_POINT,
  describeNotAskedAgain: describeCompactionRoastNotAskedAgain,
  describeNotWritten: describeCompactionRoastNotWritten,
  describeNotWrittenToast: describeCompactionRoastNotWrittenToast,
}

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
  useAfterCompaction(compaction, roast, written =>
    useRoastOrNoPoint($, written, COMPACTION_ROAST_TEXTS, text =>
      deliverRoast($, { source: RoastSource.Compaction, sessionId, text }),
    ),
  ).catch((error: unknown) => {
    showFailure($, describeCompactionRoastNotWrittenToast(thrownFailure(messageOf(error))))
  })

  return compaction
}

/**
 * Runs `use` with the result of `roast` once both `roast` and `compaction` ended. Drops it where
 * the compaction failed or was skipped. The engine reports a failed compaction itself, and a
 * skipped one leaves no summary for the roast to follow.
 */
export async function useAfterCompaction(
  compaction: Promise<SessionCompactResult>,
  roast: Promise<RoastTry>,
  use: (roast: RoastTry) => Promise<void>,
): Promise<void> {
  // Waits for the roast too, so its failure counts as handled while the compaction runs.
  const [compacted] = await Promise.allSettled([compaction, roast])
  if (compacted.status === 'fulfilled' && compacted.value.skip === undefined) {
    await use(await roast)
  }
}
