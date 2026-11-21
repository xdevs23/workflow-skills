import type { EngineInterface } from 'claude-code'

import type { RoastedHintKind } from '../hintKind'
import { writeHintTextsWithEachStepOnce } from '../hintText'
import { forkRoastOnce } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { HintRoastMissingCause, RoastNotWrittenCause } from './roastFailure'
import type { HintRoastMissing } from './roastFailure'
import { attributeRoastToRoaster, writeHintRoastPrompt } from './roastPromptTexts'
import { HintRoastVerdict, readHintRoastReply } from './roastReply'
import { RoastShown } from './roastState'

/** The roast on the hints at the end of a turn, attributed to the roaster, or why none came. */
export type HintRoast =
  | { isWritten: true; roast: string }
  | { isWritten: false; missing: HintRoastMissing }

/**
 * The roast on the hints of `kinds` for the end of a turn, as one fork made from the main
 * conversation writes it.
 */
export async function roastHints(
  $: EngineInterface,
  kinds: readonly RoastedHintKind[],
): Promise<HintRoast> {
  const prompt = writeHintRoastPrompt({
    tasks: kinds.map(kind => kind.roasterTask),
    hints: writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
  })

  return readForkedHintRoast(await forkRoastOnce($, prompt, 1))
}

function readForkedHintRoast(roast: ForkedRoast): HintRoast {
  switch (roast.shown) {
    case RoastShown.Written:
      return readHintRoastText(roast.text)
    case RoastShown.WritingAgain:
      return missing({ cause: HintRoastMissingCause.NotAskedAgain, error: roast.error })
    case RoastShown.NotWritten:
      return missing({ cause: HintRoastMissingCause.NotWritten, failure: roast.failure })
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
