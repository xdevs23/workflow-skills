import type { EngineInterface } from 'claude-code'

import type { RoastTry } from './roastActions'
import { RoastNotWrittenCause } from './roastFailure'
import { showRoastFailure } from './roastFailureNotice'
import type { RoastNotWrittenTexts } from './roastFailureNotice'
import { RoastOrNoPointVerdict, readRoastOrNoPointReply } from './roastReply'
import { RoastShown } from './roastState'
import type { RoastProgressOf } from './roastState'

/** The texts of one kind of roast whose prompt offers RoastOrNoPointVerdict. */
export type RoastOrNoPointTexts = RoastNotWrittenTexts & {
  readonly foundNoPoint: string
  readonly describeNotAskedAgain: (roast: RoastProgressOf<RoastShown.WritingAgain>) => string
}

/**
 * Sends the roast in `roast` with `send`, unless the model found no point, or shows with `texts`
 * why none was written.
 */
export async function useRoastOrNoPoint(
  $: EngineInterface,
  roast: RoastTry,
  texts: RoastOrNoPointTexts,
  send: (text: string) => Promise<void>,
): Promise<void> {
  switch (roast.shown) {
    case RoastShown.Written:
      await sendRoastOrNoPointReply($, roast.text, texts, send)
      break
    case RoastShown.WritingAgain:
      $.ui.log(texts.describeNotAskedAgain(roast), { to: 'debug' })
      break
    case RoastShown.NotWritten:
      showRoastFailure($, roast.failure, texts)
      break
  }
}

/**
 * Sends the roast in `reply`, unless it says the model found no point, or shows why it is
 * unreadable.
 */
export async function sendRoastOrNoPointReply(
  $: EngineInterface,
  reply: string,
  texts: RoastOrNoPointTexts,
  send: (text: string) => Promise<void>,
): Promise<void> {
  const read = readRoastOrNoPointReply(reply)
  if (!read.isRead) {
    showRoastFailure(
      $,
      { cause: RoastNotWrittenCause.UnreadableReply, reason: read.reason, reply },
      texts,
    )

    return
  }
  switch (read.model.verdict) {
    case RoastOrNoPointVerdict.Roast:
      await send(read.model.roast)
      break
    case RoastOrNoPointVerdict.NoPoint:
      $.ui.log(texts.foundNoPoint, { to: 'debug' })
      break
  }
}
