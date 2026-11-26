import type { EngineInterface, MatchedHook } from 'claude-code'

import type { EveryEvent } from '../everyEvent'
import { HintRoastKept, HintWithoutPoint, namesOfHintKinds } from '../hintKind'
import type { HintKindName, RoastedHintKind } from '../hintKind'
import { roastedHintKindsNamed } from '../hintKinds'
import { deliverHintNote } from '../hintNoteDelivery'
import { writeHintTextsWithEachStepOnce } from '../hintText'
import type { HintText } from '../hintText'
import { isMessageTypedByUser } from '../promptOrigin'
import { runDetached } from '../timedWork'
import {
  handHintRoastsToWait,
  hasHintRoastOfWaitAmong,
  readHintRoastsOfWait,
  removeHintKindsOfWait,
  removeHintRoastsOfWait,
  takeHintRoasts,
} from './hintRoastQueue'
import type { HintRoastRequest } from './hintRoastQueue'
import { IdleWaitCancel } from './idleWait'
import type { IdleWaitWork } from './idleWait'
import { forkRoast } from './roastActions'
import type { RoastTry } from './roastActions'
import { HintRoastMissingCause, RoastNotWrittenCause } from './roastFailure'
import type { HintRoastMissing } from './roastFailure'
import { attributeRoastToRoaster, writeHintRoastPrompt } from './roastPromptTexts'
import { RoastOrNoPointVerdict, readRoastOrNoPointReply } from './roastReply'
import { RoastShown } from './roastState'
import {
  describeHintRoastDropped,
  describeHintRoastLost,
  describeHintRoastMissing,
} from './roastTexts'

/** The roast on the hints at the end of turns, attributed to the roaster, or why none came. */
type HintRoast =
  | { isWritten: true; roast: string }
  | { isWritten: false; missing: HintRoastMissing }

/**
 * The roast on hints as work of the idle wait: the end of a turn hands the roasts queued in it to
 * the wait, and one fork writes them all once the wait ended.
 */
export function hintRoastAfterIdleWait($: EngineInterface): IdleWaitWork {
  return {
    start: async () => (await handHintRoastsToWait($)).length > 0,
    cancel: cause => dropHintRoastsOnCancel($, cause),
    end: () => roastHintsAfterWait($),
    describeFailure: describeHintRoastLost,
  }
}

/**
 * Drops the roasts on hints not written yet that the cancel of the wait for `cause` ends: every
 * roast once another session runs, and the hint kinds kept until the next turn once a turn starts.
 */
async function dropHintRoastsOnCancel($: EngineInterface, cause: IdleWaitCancel): Promise<void> {
  switch (cause) {
    case IdleWaitCancel.SessionSwitched:
      return logHintRoastsDropped($, await takeHintRoasts($))
    case IdleWaitCancel.TurnStarted:
      return logHintRoastsDropped($, await removeHintKindsOfWait($, isKeptUntilTurnStart))
  }
}

function isKeptUntilTurnStart(name: HintKindName): boolean {
  return roastedHintKindsNamed([name]).some(
    kind => kind.roaster.kept === HintRoastKept.UntilTurnStart,
  )
}

/** Drops every roast on hints not written yet once the user sends a message. */
export const dropHintRoastsOnUserMessage: MatchedHook<'prompt.submit', EveryEvent> = async (
  $,
  e,
  next,
) => {
  if (isMessageTypedByUser(e)) {
    logHintRoastsDropped($, await takeHintRoasts($))
  }

  return next(e)
}

function logHintRoastsDropped($: EngineInterface, dropped: readonly HintRoastRequest[]): void {
  for (const { kinds } of dropped) {
    $.ui.log(describeHintRoastDropped(kinds), { to: 'debug' })
  }
}

/**
 * Has one fork write the roast on every roast of the wait, sends the session the roast as
 * `deliverHintRoast` does, and returns whether it sent a note. A turn started meanwhile does not
 * stop the fork. Where the user sent a message or another session runs once the fork returned,
 * the roasts were dropped, and none goes out. A fork that fails drops the roasts it wrote for.
 */
async function roastHintsAfterWait($: EngineInterface): Promise<boolean> {
  const requests = await readHintRoastsOfWait($)
  if (requests.length === 0) {
    return false
  }
  const ids = new Set(requests.map(request => request.id))
  const isStillQueued = () => hasHintRoastOfWaitAmong($, ids)
  const kinds = roastedHintKindsNamed([...new Set(requests.flatMap(request => request.kinds))])
  const prompt = writeHintRoastPrompt({
    replies: requests.map(request => request.reply),
    tasks: kinds.map(kind => kind.roaster.task),
    hints: writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
  })
  const roast = await forkRoast($, prompt, isStillQueued).catch(async (error: unknown) => {
    await removeHintRoastsOfWait($, ids)
    throw error
  })
  if (!(await isStillQueued())) {
    return false
  }
  await removeHintRoastsOfWait($, ids)

  return deliverHintRoast($, await $.session.id(), kinds, readForkedHintRoast(roast))
}

/**
 * Sends the session `sessionId` the note on `roast`, the roast on the hints of `kinds`, as
 * sendHintNoteDetached does. Where the roaster did not write a roast, sends the fixed texts of
 * `kindsSentWithoutRoast` in its place, where there are any, and writes to the debug log why the
 * roast was not written. Returns whether it sends a note.
 */
function deliverHintRoast(
  $: EngineInterface,
  sessionId: string,
  kinds: readonly RoastedHintKind[],
  roast: HintRoast,
): boolean {
  if (roast.isWritten) {
    sendHintNoteDetached($, sessionId, namesOfHintKinds(kinds), [[roast.roast]])

    return true
  }
  const fixedTextKinds = kindsSentWithoutRoast(kinds, roast.missing)
  const fixedTextKindNames = namesOfHintKinds(fixedTextKinds)
  $.ui.log(describeHintRoastMissing(roast.missing, fixedTextKindNames), { to: 'debug' })
  if (fixedTextKinds.length === 0) {
    return false
  }
  sendHintNoteDetached($, sessionId, fixedTextKindNames, fixedTextKinds.map(kind => kind.text))

  return true
}

/**
 * Sends the session `sessionId` the note on `texts`, the texts of the hints `kinds`, as
 * `runDetached` runs work, so a note that fails shows its own toast.
 */
function sendHintNoteDetached(
  $: EngineInterface,
  sessionId: string,
  kinds: readonly HintKindName[],
  texts: readonly HintText[],
): void {
  runDetached($, () => deliverHintNote($, sessionId, kinds, texts), describeHintRoastLost)
}

/**
 * The kinds of `kinds` whose fixed text goes to the model where the roaster did not write a roast
 * for `missing`: every kind after a failed fork, and after a fork that did not find a point the
 * kinds whose hint applies without a point.
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
  }
}

function readForkedHintRoast(roast: RoastTry): HintRoast {
  switch (roast.shown) {
    case RoastShown.Written:
      return readHintRoastText(roast.text)
    case RoastShown.NotWritten:
      return missing({ cause: HintRoastMissingCause.NotWritten, failure: roast.failure })
    case RoastShown.WritingAgain:
      // forkRoast stops asking again only once the roasts were dropped, and roastHintsAfterWait
      // reads no roast of dropped roasts.
      throw new Error('The roaster was not asked again while the roasts were still queued.')
  }
}

/** The roast in `reply`, the text of the fork, unless the fork found no point. */
function readHintRoastText(reply: string): HintRoast {
  const read = readRoastOrNoPointReply(reply)
  if (!read.isRead) {
    return missing({
      cause: HintRoastMissingCause.NotWritten,
      failure: { cause: RoastNotWrittenCause.UnreadableReply, reason: read.reason, reply },
    })
  }
  switch (read.model.verdict) {
    case RoastOrNoPointVerdict.Roast:
      return { isWritten: true, roast: attributeRoastToRoaster(read.model.roast) }
    case RoastOrNoPointVerdict.NoPoint:
      return missing({ cause: HintRoastMissingCause.NoPoint })
  }
}

function missing(cause: HintRoastMissing): HintRoast {
  return { isWritten: false, missing: cause }
}
