import type { EngineInterface } from 'claude-code'

import { HintWithoutPoint, namesOfHintKinds } from '../hintKind'
import type { HintKindName, RoastedHintKind } from '../hintKind'
import { roastedHintKindsNamed } from '../hintKinds'
import { deliverHintNote } from '../hintNoteDelivery'
import { writeHintTextsWithEachStepOnce } from '../hintText'
import type { HintText } from '../hintText'
import { runDetached } from '../timedWork'
import {
  handHintRoastsToWait,
  readHintRoastsOfWait,
  removeHintRoastsOfWait,
  takeHintRoasts,
} from './hintRoastQueue'
import type { HintRoastRequest } from './hintRoastQueue'
import type { IdleWaitWork } from './idleWait'
import { forkRoast } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { HintRoastMissingCause, RoastNotWrittenCause } from './roastFailure'
import type { HintRoastMissing } from './roastFailure'
import { attributeRoastToRoaster, writeHintRoastPrompt } from './roastPromptTexts'
import { HintRoastVerdict, readHintRoastReply } from './roastReply'
import { RoastShown } from './roastState'
import {
  describeHintRoastDropped,
  describeHintRoastLost,
  describeHintRoastMissing,
} from './roastTexts'

/** The roast on the hints at the end of a turn, attributed to the roaster, or why none came. */
type HintRoast =
  | { isWritten: true; roast: string }
  | { isWritten: false; missing: HintRoastMissing }

/** The result of the last fork asked for the roast on the hints of `kinds`. */
type ForkedHintRoast = { kinds: readonly RoastedHintKind[]; roast: ForkedRoast }

/**
 * The roast on hints as work of the idle wait: the end of a turn hands the roasts queued in it to
 * the wait, and forks write them once the wait ended.
 */
export function hintRoastAfterIdleWait($: EngineInterface): IdleWaitWork {
  return {
    start: () => startHintRoastsOfWait($),
    cancel: () => dropHintRoasts($),
    end: isWaitOfSession => roastHintsAfterWait($, isWaitOfSession),
    describeFailure: describeHintRoastLost,
  }
}

/**
 * Hands the roasts queued in the turn that starts the wait to the wait, and returns whether there
 * are any. Drops the roasts of the wait before, which no turn start cancelled.
 */
async function startHintRoastsOfWait($: EngineInterface): Promise<boolean> {
  const { ofWait, replaced } = await handHintRoastsToWait($)
  logHintRoastsDropped($, replaced)

  return ofWait.length > 0
}

/** Drops every roast on hints not written yet, once the wait was cancelled. */
async function dropHintRoasts($: EngineInterface): Promise<void> {
  logHintRoastsDropped($, await takeHintRoasts($))
}

function logHintRoastsDropped($: EngineInterface, dropped: readonly HintRoastRequest[]): void {
  for (const { kinds } of dropped) {
    $.ui.log(describeHintRoastDropped(kinds), { to: 'debug' })
  }
}

/**
 * Has a fork write each roast of the wait while `isWaitOfSession`, sends the session the roasts as
 * `deliverHintRoast` does, and returns whether it sent any note. Where a turn started or another
 * session runs once the forks returned, the cancel of the wait dropped the roasts, and none goes
 * out.
 */
async function roastHintsAfterWait(
  $: EngineInterface,
  isWaitOfSession: () => boolean,
): Promise<boolean> {
  const forks = (await readHintRoastsOfWait($)).map(request =>
    forkHintRoast($, request, isWaitOfSession),
  )
  const roasts = (await Promise.allSettled(forks)).flatMap(fork =>
    fork.status === 'fulfilled' ? [fork.value] : [],
  )
  // Read once for all roasts, since the first roast sent starts a turn.
  const hasSentNote = isWaitOfSession() && (await deliverHintRoastsOfWait($, roasts))
  // forkRoast returns each failure of the API as a result, and the engine types name no error
  // class for a fork that throws, so such an error is shown once the other roasts went out.
  await Promise.all(forks)

  return hasSentNote
}

/**
 * Asks a fork made from the main conversation for the roast of `request`, as `forkRoast` does,
 * while `isWaitOfSession`.
 */
async function forkHintRoast(
  $: EngineInterface,
  request: HintRoastRequest,
  isWaitOfSession: () => boolean,
): Promise<ForkedHintRoast> {
  const kinds = roastedHintKindsNamed(request.kinds)
  const prompt = writeHintRoastPrompt({
    reply: request.reply,
    tasks: kinds.map(kind => kind.roaster.task),
    hints: writeHintTextsWithEachStepOnce(kinds.map(kind => kind.text)),
  })

  return { kinds, roast: await forkRoast($, prompt, async () => isWaitOfSession()) }
}

/**
 * Removes the roasts of the wait from the state, sends the session `roasts` as `deliverHintRoast`
 * does, and returns whether it sends any note.
 */
async function deliverHintRoastsOfWait(
  $: EngineInterface,
  roasts: readonly ForkedHintRoast[],
): Promise<boolean> {
  await removeHintRoastsOfWait($)
  const sessionId = await $.session.id()

  return roasts
    .map(({ kinds, roast }) => deliverHintRoast($, sessionId, kinds, readForkedHintRoast(roast)))
    .includes(true)
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
 * `runDetached` runs work, so a note that fails shows its own toast and the other notes still go.
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

function readForkedHintRoast(roast: ForkedRoast): HintRoast {
  switch (roast.shown) {
    case RoastShown.Written:
      return readHintRoastText(roast.text)
    case RoastShown.NotWritten:
      return missing({ cause: HintRoastMissingCause.NotWritten, failure: roast.failure })
    case RoastShown.WritingAgain:
      // forkRoast stops asking again only once the wait was cancelled, and roastHintsAfterWait
      // reads no roast of a cancelled wait.
      throw new Error('The roaster was not asked again while the wait for the roast still ran.')
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
