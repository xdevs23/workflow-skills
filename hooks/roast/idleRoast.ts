import type { EngineInterface, MatchedHook, On } from 'claude-code'

import { messageOf } from '../errorMessage'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import { isMessageTypedByUser } from '../promptOrigin'
import { RecordOutcome } from '../sessionRecord'
import { readIdleRoastSwitch } from './idleRoastSwitch'
import { IdleWaitCancel } from './idleWait'
import type { IdleWaitWork } from './idleWait'
import { forkRoast } from './roastActions'
import type { RoastTry } from './roastActions'
import { deliverRoast } from './roastDelivery'
import { RoastNotWrittenCause, RoastRecovery, recoveryOf, thrownFailure } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { showRoastFailure } from './roastFailureNotice'
import type { RoastNotWrittenTexts } from './roastFailureNotice'
import { IDLE_ROAST_PROMPT } from './roastPromptTexts'
import { IdleRoastVerdict, readIdleRoastReply } from './roastReply'
import { RoastShown, RoastSource } from './roastState'
import { endStretch, isStretchRoasted, recordStretchRoast } from './roastStretch'
import {
  IDLE_ROAST_FOUND_NO_BLOCKING_POINT,
  describeIdleRoastNotWritten,
  describeIdleRoastNotWrittenToast,
  describeIdleRoastSwitchNotRead,
} from './roastTexts'

const IDLE_ROAST_NOT_WRITTEN_TEXTS: RoastNotWrittenTexts = {
  describeNotWritten: describeIdleRoastNotWritten,
  describeNotWrittenToast: describeIdleRoastNotWrittenToast,
}

// Whether the idle roast is on for the running session, as read from the store at the start of the
// session and at a switch to another one, and as set by /idle-roast since. The end of the wait
// reads it here, so a session with the idle roast off does not read the store after each turn.
let isSwitchedOn = false

/**
 * Registers the hooks that read the switch of the idle roast at the start of the session and follow
 * the idle stretch, for idleRoastAfterIdleWait.
 */
export function registerIdleRoast(on: On): void {
  on('session.start', EVERY_EVENT, loadSwitchAtStart)
  on('prompt.submit', EVERY_EVENT, startStretchOnUserMessage)
}

/**
 * The idle roast as work of the idle wait: a fork roasts the main conversation where it blocks the
 * work, in a session with the idle roast switched on, once per idle stretch, as roastAfterIdleWait
 * describes.
 */
export function idleRoastAfterIdleWait($: EngineInterface): IdleWaitWork {
  return {
    start: async () => isStretchToRoast(),
    cancel: cause => endStretchOnSwitch($, cause),
    end: isWaitOfSession =>
      roastAfterIdleWait($, isWaitOfSession).catch((error: unknown) => {
        endStretchIfNeedsPerson(thrownFailure(messageOf(error)))
        throw error
      }),
    describeFailure: message => describeIdleRoastNotWrittenToast(thrownFailure(message)),
  }
}

const loadSwitchAtStart: MatchedHook<'session.start', EveryEvent> = async ($, e, next) => {
  await loadIdleRoastSwitch($)

  return next(e)
}

// After /clear, /resume or a fork, another conversation runs, for which the stretch was not
// started, and which has a switch of its own.
async function endStretchOnSwitch($: EngineInterface, cause: IdleWaitCancel): Promise<void> {
  if (cause === IdleWaitCancel.SessionSwitched) {
    endStretch()
    await loadIdleRoastSwitch($)
  }
}

/** Whether the idle roast is on for the running session. */
export function isIdleRoastSwitchedOn(): boolean {
  return isSwitchedOn
}

/** Whether the idle roast is on and the idle stretch has no roast yet. */
function isStretchToRoast(): boolean {
  return isSwitchedOn && !isStretchRoasted()
}

/**
 * Reads the switch of the running session into isSwitchedOn. A switch that could not be read is
 * shown in a toast and leaves the idle roast off.
 */
async function loadIdleRoastSwitch($: EngineInterface): Promise<void> {
  const read = await readIdleRoastSwitch($, await $.session.id())
  if (read.outcome === RecordOutcome.Read) {
    isSwitchedOn = read.value

    return
  }
  isSwitchedOn = false
  showFailure($, describeIdleRoastSwitchNotRead(read))
}

/**
 * Sets the idle roast of the running session on when `isOn`, and off otherwise, once /idle-roast
 * saved it. Off drops an idle roast still being written.
 */
export function setIdleRoastSwitch(isOn: boolean): void {
  isSwitchedOn = isOn
}

const startStretchOnUserMessage: MatchedHook<'prompt.submit', EveryEvent> = ($, e, next) => {
  if (isMessageTypedByUser(e)) {
    endStretch()
  }

  return next(e)
}

/**
 * Has a fork write the idle roast once the wait ended, as `forkRoast` describes, while
 * `isWaitOfSession` and the idle roast is on, uses the result of the last fork, and returns whether
 * it sent the roast. Drops the result once a turn started since or the idle roast was switched off.
 */
async function roastAfterIdleWait(
  $: EngineInterface,
  isWaitOfSession: () => boolean,
): Promise<boolean> {
  if (!isStretchToRoast()) {
    return false
  }
  const sessionId = await $.session.id()
  const isRoastOfWait = (): boolean => isWaitOfSession() && isSwitchedOn
  const roast = await forkRoast($, IDLE_ROAST_PROMPT, async () => isRoastOfWait())

  return isRoastOfWait() && (await useIdleRoast($, sessionId, roast))
}

/**
 * Sends the reply in `roast` to deliverIdleRoastReply, or shows why no roast was written, and
 * returns whether it sent the roast.
 */
async function useIdleRoast(
  $: EngineInterface,
  sessionId: string,
  roast: RoastTry,
): Promise<boolean> {
  switch (roast.shown) {
    case RoastShown.Written:
      return deliverIdleRoastReply($, sessionId, roast.text)
    case RoastShown.NotWritten:
      showIdleRoastFailure($, roast.failure)

      return false
    case RoastShown.WritingAgain:
      return false
  }
}

/**
 * Sends the roast in `reply` to the session `sessionId` unless no point blocks the work, and
 * returns whether it sent the roast. Either verdict ends the stretch.
 */
async function deliverIdleRoastReply(
  $: EngineInterface,
  sessionId: string,
  reply: string,
): Promise<boolean> {
  const read = readIdleRoastReply(reply)
  if (!read.isRead) {
    showIdleRoastFailure($, {
      cause: RoastNotWrittenCause.UnreadableReply,
      reason: read.reason,
      reply,
    })

    return false
  }
  recordStretchRoast()
  switch (read.model.verdict) {
    case IdleRoastVerdict.Roast:
      await deliverRoast($, { source: RoastSource.Idle, sessionId, text: read.model.roast })

      return true
    case IdleRoastVerdict.NoBlockingPoint:
      $.ui.log(IDLE_ROAST_FOUND_NO_BLOCKING_POINT, { to: 'debug' })

      return false
  }
}

/**
 * Shows `failure` of the idle roast in a toast where only a person can clear it, and ends the
 * stretch, so the idle roast does not ask again before the next message typed by the user. A
 * failure that a new fork can get past goes to the debug log alone, and the end of the next turn
 * waits again.
 */
function showIdleRoastFailure($: EngineInterface, failure: RoastFailure): void {
  endStretchIfNeedsPerson(failure)
  showRoastFailure($, failure, IDLE_ROAST_NOT_WRITTEN_TEXTS)
}

function endStretchIfNeedsPerson(failure: RoastFailure): void {
  if (recoveryOf(failure) === RoastRecovery.NeedsPerson) {
    recordStretchRoast()
  }
}
