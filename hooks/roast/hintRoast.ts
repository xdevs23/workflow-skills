import type { EngineInterface } from 'claude-code'

import { messageOf } from '../errorMessage'
import { HintWithoutPoint, namesOfHintKinds } from '../hintKind'
import type { RoastedHintKind } from '../hintKind'
import { deliverHintNote } from '../hintNoteDelivery'
import { writeHintTextsWithEachStepOnce } from '../hintText'
import { isSessionRunning } from '../sessionBoundState'
import { runDetached } from '../timedWork'
import { forkAgainAfterPassingErrors, forkRoastWithoutRetry, writeForkPrompt } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { HintRoastMissingCause, RoastNotWrittenCause, thrownFailure } from './roastFailure'
import type { HintRoastMissing } from './roastFailure'
import { attributeRoastToRoaster, writeHintRoastPrompt } from './roastPromptTexts'
import { HintRoastVerdict, readHintRoastReply } from './roastReply'
import { RoastShown } from './roastState'
import { describeHintRoastLost, describeHintRoastMissing } from './roastTexts'

/** The roast on the hints at the end of a turn, attributed to the roaster, or why none came. */
type HintRoast =
  | { isWritten: true; roast: string }
  | { isWritten: false; missing: HintRoastMissing }

/**
 * Asks a fork made from the main conversation for the roast on the hints in `kinds`, which `reply`,
 * the reply that ends a turn, calls for, and returns after it asked the fork, without waiting for
 * the fork to answer. Asks again after an API error that passes, as `forkAgainAfterPassingErrors`
 * does, while the session of the turn runs. Once the last fork ended, sends that session the roast
 * as `deliverHintRoast` does.
 */
export async function roastHintsDetached(
  $: EngineInterface,
  reply: string,
  kinds: readonly RoastedHintKind[],
): Promise<void> {
  const sessionId = await $.session.id()
  const prompt = writeHintRoastPrompt({
    reply,
    tasks: kinds.map(kind => kind.roaster.task),
    hints: writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
  })
  // The rejection handler turns a thrown fork into a roast not written, so `roast` never rejects
  // while nothing awaits it yet.
  const roast = forkRoastWithoutRetry($, await writeForkPrompt($, prompt))
    .then(first =>
      forkAgainAfterPassingErrors($, prompt, first, () => isSessionRunning($, sessionId)),
    )
    .then(readForkedHintRoast, (error: unknown) =>
      missing({
        cause: HintRoastMissingCause.NotWritten,
        failure: thrownFailure(messageOf(error)),
      }),
    )
  runDetached(
    $,
    async () => deliverHintRoast($, sessionId, kinds, await roast),
    describeHintRoastLost,
  )
}

/**
 * Sends the session `sessionId` the note on `roast`, the roast on the hints of `kinds`. Where the
 * roaster did not write a roast, sends the fixed texts of `kindsSentWithoutRoast` in its place,
 * where there are any, and writes to the debug log why the roast was not written.
 */
async function deliverHintRoast(
  $: EngineInterface,
  sessionId: string,
  kinds: readonly RoastedHintKind[],
  roast: HintRoast,
): Promise<void> {
  if (roast.isWritten) {
    await deliverHintNote($, sessionId, namesOfHintKinds(kinds), [[roast.roast]])

    return
  }
  const fixedTextKinds = kindsSentWithoutRoast(kinds, roast.missing)
  const fixedTextKindNames = namesOfHintKinds(fixedTextKinds)
  $.ui.log(describeHintRoastMissing(roast.missing, fixedTextKindNames), { to: 'debug' })
  if (fixedTextKinds.length > 0) {
    await deliverHintNote($, sessionId, fixedTextKindNames, fixedTextKinds.map(kind => kind.text))
  }
}

/**
 * The kinds of `kinds` whose fixed text goes to the model where the roaster did not write a roast
 * for `missing`: every kind after a failed fork, after a fork that did not find a point the kinds
 * whose hint applies without a point, and none once the session left.
 */
function kindsSentWithoutRoast(
  kinds: readonly RoastedHintKind[],
  missing: HintRoastMissing,
): readonly RoastedHintKind[] {
  switch (missing.cause) {
    case HintRoastMissingCause.NotWritten:
      return kinds
    case HintRoastMissingCause.NoPoint:
      return kinds.filter(kind => kind.roaster.withoutPoint === HintWithoutPoint.Text)
    case HintRoastMissingCause.SessionLeft:
      return []
  }
}

function readForkedHintRoast(roast: ForkedRoast): HintRoast {
  switch (roast.shown) {
    case RoastShown.Written:
      return readHintRoastText(roast.text)
    case RoastShown.NotWritten:
      return missing({ cause: HintRoastMissingCause.NotWritten, failure: roast.failure })
    case RoastShown.WritingAgain:
      // roastHintsDetached stops asking after an API error that passes only once the session left.
      return missing({ cause: HintRoastMissingCause.SessionLeft })
  }
}

/** The roast in `reply`, the text of the fork, unless the fork found no point. */
function readHintRoastText(reply: string): HintRoast {
  const read = readHintRoastReply(reply)
  if (!read.isRead) {
    return missing({
      cause: HintRoastMissingCause.NotWritten,
      failure: { cause: RoastNotWrittenCause.UnreadableReply, reason: read.reason, reply },
    })
  }
  switch (read.model.verdict) {
    case HintRoastVerdict.Roast:
      return { isWritten: true, roast: attributeRoastToRoaster(read.model.roast) }
    case HintRoastVerdict.NoPoint:
      return missing({ cause: HintRoastMissingCause.NoPoint })
  }
}

function missing(cause: HintRoastMissing): HintRoast {
  return { isWritten: false, missing: cause }
}
