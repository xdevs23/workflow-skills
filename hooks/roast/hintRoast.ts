import type { EngineInterface } from 'claude-code'

import { HintWithoutPoint, namesOfHintKinds } from '../hintKind'
import type { RoastedHintKind } from '../hintKind'
import { deliverHintNote } from '../hintNoteDelivery'
import { writeHintTextsWithEachStepOnce } from '../hintText'
import { forkRoast } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { HintRoastMissingCause, RoastNotWrittenCause } from './roastFailure'
import type { HintRoastMissing } from './roastFailure'
import { attributeRoastToRoaster, writeHintRoastPrompt } from './roastPromptTexts'
import { HintRoastVerdict, readHintRoastReply } from './roastReply'
import { RoastShown } from './roastState'
import { describeHintRoastMissing } from './roastTexts'

/** The roast on the hints at the end of a turn, attributed to the roaster, or why none came. */
type HintRoast =
  | { isWritten: true; roast: string }
  | { isWritten: false; missing: HintRoastMissing }

/** The roast on the hints in `kinds`, which `reply`, a reply that ended a turn, calls for. */
type HintRoastQueued = { reply: string; kinds: readonly RoastedHintKind[] }

// The roasts on hints queued by the ends of the running turn of the main conversation. A Stop block
// lets one turn end several times, so the end of the turn hands all of them to the wait.
let hintRoastsQueuedInTurn: HintRoastQueued[] = []

// The roasts on hints that the wait of the running session holds until it ends.
let hintRoastsOfWait: readonly HintRoastQueued[] = []

/**
 * Queues the roast on the hints in `kinds`, which `reply`, the reply that ends a turn, calls for.
 * The end of the turn hands it to the wait, as holdHintRoastsForWait describes.
 */
export function queueHintRoast(reply: string, kinds: readonly RoastedHintKind[]): void {
  hintRoastsQueuedInTurn.push({ reply, kinds })
}

/** Hands the roasts queued by the turn that starts the wait to the wait. */
export function holdHintRoastsForWait(): void {
  hintRoastsOfWait = hintRoastsQueuedInTurn
  hintRoastsQueuedInTurn = []
}

/**
 * Drops the roasts held for the wait, which the start of a turn or a switch to another session
 * cancelled, and writes each drop to the debug log.
 */
export function dropHintRoastsOfWait($: EngineInterface): void {
  takeHintRoastsOfWait().forEach(() =>
    $.ui.log(describeHintRoastMissing(WAIT_CANCELLED, []), { to: 'debug' }),
  )
}

function takeHintRoastsOfWait(): readonly HintRoastQueued[] {
  const taken = hintRoastsOfWait
  hintRoastsOfWait = []

  return taken
}

/**
 * Has a fork write each roast held for the wait while `isWaitOfSession`, sends the session the
 * roasts as `deliverHintRoast` does, and returns whether it sent any note. A roast written once a
 * turn started or another session runs since reads as dropped, together with the fixed texts sent
 * in its place.
 */
export async function roastHintsAfterWait(
  $: EngineInterface,
  isWaitOfSession: () => boolean,
): Promise<boolean> {
  const queued = takeHintRoastsOfWait()
  const sessionId = await $.session.id()
  const roasts = await Promise.all(
    queued.map(async ({ reply, kinds }) => ({
      kinds,
      roast: await forkHintRoast($, reply, kinds, isWaitOfSession),
    })),
  )
  // Read once for all roasts, since the first roast sent starts a turn.
  const isDropped = !isWaitOfSession()
  let hasSentNote = false
  for (const { kinds, roast } of roasts) {
    if (await deliverHintRoast($, sessionId, kinds, isDropped ? missing(WAIT_CANCELLED) : roast)) {
      hasSentNote = true
    }
  }

  return hasSentNote
}

/**
 * Asks a fork made from the main conversation for the roast on the hints in `kinds`, which `reply`
 * calls for, as `forkRoast` does, while `isWaitOfSession`.
 */
async function forkHintRoast(
  $: EngineInterface,
  reply: string,
  kinds: readonly RoastedHintKind[],
  isWaitOfSession: () => boolean,
): Promise<HintRoast> {
  const prompt = writeHintRoastPrompt({
    reply,
    tasks: kinds.map(kind => kind.roaster.task),
    hints: writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
  })

  return readForkedHintRoast(await forkRoast($, prompt, async () => isWaitOfSession()))
}

/**
 * Sends the session `sessionId` the note on `roast`, the roast on the hints of `kinds`. Where the
 * roaster did not write a roast, sends the fixed texts of `kindsSentWithoutRoast` in its place,
 * where there are any, and writes to the debug log why the roast was not written. Returns whether
 * it sent a note.
 */
async function deliverHintRoast(
  $: EngineInterface,
  sessionId: string,
  kinds: readonly RoastedHintKind[],
  roast: HintRoast,
): Promise<boolean> {
  if (roast.isWritten) {
    await deliverHintNote($, sessionId, namesOfHintKinds(kinds), [[roast.roast]])

    return true
  }
  const fixedTextKinds = kindsSentWithoutRoast(kinds, roast.missing)
  const fixedTextKindNames = namesOfHintKinds(fixedTextKinds)
  $.ui.log(describeHintRoastMissing(roast.missing, fixedTextKindNames), { to: 'debug' })
  if (fixedTextKinds.length === 0) {
    return false
  }
  await deliverHintNote($, sessionId, fixedTextKindNames, fixedTextKinds.map(kind => kind.text))

  return true
}

/**
 * The kinds of `kinds` whose fixed text goes to the model where the roaster did not write a roast
 * for `missing`: every kind after a failed fork, after a fork that did not find a point the kinds
 * whose hint applies without a point, and none once the wait was cancelled.
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
    case HintRoastMissingCause.WaitCancelled:
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
      // forkRoast stops asking again after an API error that passes only once a turn started or
      // the session changed.
      return missing(WAIT_CANCELLED)
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

const WAIT_CANCELLED: HintRoastMissing = { cause: HintRoastMissingCause.WaitCancelled }

function missing(cause: HintRoastMissing): HintRoast {
  return { isWritten: false, missing: cause }
}
