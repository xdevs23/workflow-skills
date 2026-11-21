import type { EngineInterface, MatchedHook, On, Timer } from 'claude-code'

import { isMainConversation } from '../conversation'
import { messageOf } from '../errorMessage'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { showFailure, showingStoreFailure } from '../failureToast'
import { isMessageTypedByUser } from '../promptOrigin'
import { SWITCHING_SOURCES } from '../sessionSources'
import { readSessionAcceptsPluginPrompts } from '../sessionState'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'
import { runAfter, runAfterMainTurn } from '../timedWork'
import { SwitchOutcome, deleteIdleRoastSwitch, readIdleRoastSwitch } from './idleRoastSwitch'
import { forkRoast } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { deliverRoast } from './roastDelivery'
import { RoastNotWrittenCause, RoastRecovery, recoveryOf, thrownFailure } from './roastFailure'
import type { RoastFailure } from './roastFailure'
import { IDLE_WAIT_SECONDS } from './roastNames'
import { IDLE_ROAST_PROMPT } from './roastPromptTexts'
import { IdleRoastVerdict, readIdleRoastReply } from './roastReply'
import { RoastShown, RoastSource } from './roastState'
import {
  IDLE_ROAST_FOUND_NO_BLOCKING_POINT,
  describeIdleRoastNotWritten,
  describeIdleRoastNotWrittenToast,
  describeIdleRoastSwitchNotDeleted,
  describeIdleRoastSwitchNotRead,
} from './roastTexts'

// Whether the idle roast is on for the running session, as read from the store at the start of the
// session and at a switch to another one, and as set by /idle-roast since. The end of a turn reads
// it here, so a session with the idle roast off does not read the store after each turn.
let isSwitchedOn = false

// The wait of the running session for an idle roast, replaced at the end of each turn of the main
// conversation, and cancelled at the start of one and at a switch to another session. A roast
// written after the wait ended goes to the session only while no turn started since.
let idleWait: Timer | undefined = undefined

// Whether the idle stretch already got a roast, or a reply that no point blocks the work. A message
// typed by the user ends the stretch, so the turns that follow the roast before the user returns
// wait for no further roast. A reload of the plugin forgets both, and the end of the next turn
// waits again.
let isStretchRoasted = false

/**
 * Registers the hooks that have a fork roast the main conversation where it blocks the work, once
 * the main conversation has been idle for IDLE_WAIT_SECONDS since the last response, in a session
 * with the idle roast switched on.
 */
export function registerIdleRoast(on: On): void {
  on('session.start', EVERY_EVENT, loadSwitchAtStart)
  on('session.end', EVERY_EVENT, deleteSwitchAtEnd)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, endStretchOnSwitch)
  on('prompt.submit', EVERY_EVENT, startStretchOnUserMessage)
  on('turn.start', EVERY_EVENT, cancelIdleWaitOnTurn)
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    runAfterMainTurn(e, next, async () => waitForIdleRoast($)),
  )
}

const loadSwitchAtStart: MatchedHook<'session.start', EveryEvent> = async ($, e, next) => {
  await loadIdleRoastSwitch($)

  return next(e)
}

// The record of the switch exists only while the idle roast is on, so the store file, shared by
// every session, does not grow with the sessions that ever ran /idle-roast.
const deleteSwitchAtEnd: MatchedHook<'session.end', EveryEvent> = async ($, e, next) => {
  await showingStoreFailure(
    $,
    () => deleteIdleRoastSwitch($, e.sessionId),
    describeIdleRoastSwitchNotDeleted,
  )

  return next(e)
}

// After /clear, /resume or a fork, another conversation runs, for which neither the wait nor the
// stretch was started, and which has a switch of its own.
const endStretchOnSwitch: MatchedHook<
  'classic.SessionStart',
  { source: typeof SWITCHING_SOURCES }
> = async ($, e, next) => {
  cancelIdleWait()
  isStretchRoasted = false
  await loadIdleRoastSwitch($)

  return next(e)
}

/**
 * Reads the switch of the running session into isSwitchedOn. A switch that could not be read is
 * shown in a toast and leaves the idle roast off.
 */
async function loadIdleRoastSwitch($: EngineInterface): Promise<void> {
  const read = await readIdleRoastSwitch($, await $.session.id())
  if (read.outcome === SwitchOutcome.Read) {
    isSwitchedOn = read.isOn

    return
  }
  isSwitchedOn = false
  showFailure($, describeIdleRoastSwitchNotRead(read))
}

/**
 * Sets the idle roast of the running session on when `isOn`, and off otherwise, once /idle-roast
 * saved it. The wait starts again now unless a turn runs, whose end starts it. Off cancels the
 * wait, so a roast still being written for it is dropped.
 */
export async function setIdleRoastSwitch($: EngineInterface, isOn: boolean): Promise<void> {
  isSwitchedOn = isOn
  cancelIdleWait()
  if (await readSessionAcceptsPluginPrompts($)) {
    waitForIdleRoast($)
  }
}

const startStretchOnUserMessage: MatchedHook<'prompt.submit', EveryEvent> = ($, e, next) => {
  if (isMessageTypedByUser(e)) {
    isStretchRoasted = false
  }

  return next(e)
}

const cancelIdleWaitOnTurn: MatchedHook<'turn.start', EveryEvent> = ($, e, next) => {
  if (isMainConversation(e)) {
    cancelIdleWait()
  }

  return next(e)
}

function cancelIdleWait(): void {
  idleWait?.cancel()
  idleWait = undefined
}

function waitForIdleRoast($: EngineInterface): void {
  if (!isSwitchedOn || isStretchRoasted) {
    return
  }
  idleWait?.cancel()
  const wait: Timer = runAfter(
    $,
    IDLE_WAIT_SECONDS * MILLISECONDS_PER_SECOND,
    () =>
      roastAfterIdleWait($, wait).catch((error: unknown) => {
        endStretchIfNeedsPerson(thrownFailure(messageOf(error)))
        throw error
      }),
    message => describeIdleRoastNotWrittenToast(thrownFailure(message)),
  )
  idleWait = wait
}

/**
 * Has a fork write the idle roast once `wait` ended, as `forkRoast` describes, while `wait` is the
 * wait of the session, and uses the result of the last fork. Drops the result once a turn started
 * since or the idle roast was switched off.
 */
async function roastAfterIdleWait($: EngineInterface, wait: Timer): Promise<void> {
  const sessionId = await $.session.id()
  const isWaitOfSession = () => idleWait === wait
  const roast = await forkRoast($, IDLE_ROAST_PROMPT, async () => isWaitOfSession())
  if (isWaitOfSession()) {
    await useIdleRoast($, sessionId, roast)
  }
}

/** Sends the reply in `roast` to deliverIdleRoastReply, or shows why no roast was written. */
async function useIdleRoast(
  $: EngineInterface,
  sessionId: string,
  roast: ForkedRoast,
): Promise<void> {
  switch (roast.shown) {
    case RoastShown.Written:
      await deliverIdleRoastReply($, sessionId, roast.text)
      break
    case RoastShown.NotWritten:
      showIdleRoastFailure($, roast.failure)
      break
    case RoastShown.WritingAgain:
      break
  }
}

/**
 * Sends the roast in `reply` to the session `sessionId` unless no point blocks the work. Either
 * verdict ends the stretch once it was used.
 */
async function deliverIdleRoastReply(
  $: EngineInterface,
  sessionId: string,
  reply: string,
): Promise<void> {
  const read = readIdleRoastReply(reply)
  if (!read.isRead) {
    showIdleRoastFailure($, {
      cause: RoastNotWrittenCause.UnreadableReply,
      reason: read.reason,
      reply,
    })

    return
  }
  switch (read.model.verdict) {
    case IdleRoastVerdict.Roast:
      await deliverRoast($, { source: RoastSource.Idle, sessionId, text: read.model.roast })
      break
    case IdleRoastVerdict.NoBlockingPoint:
      $.ui.log(IDLE_ROAST_FOUND_NO_BLOCKING_POINT, { to: 'debug' })
      break
  }
  isStretchRoasted = true
}

/**
 * Shows `failure` of the idle roast in a toast where only a person can clear it, and ends the
 * stretch, so the idle roast does not ask again before the next message typed by the user. A
 * failure that a new fork can get past goes to the debug log alone, and the end of the next turn
 * waits again.
 */
function showIdleRoastFailure($: EngineInterface, failure: RoastFailure): void {
  endStretchIfNeedsPerson(failure)
  switch (recoveryOf(failure)) {
    case RoastRecovery.AskAgain:
      $.ui.log(describeIdleRoastNotWritten(failure), { to: 'debug' })
      break
    case RoastRecovery.NeedsPerson:
      showFailure($, describeIdleRoastNotWrittenToast(failure))
      break
  }
}

function endStretchIfNeedsPerson(failure: RoastFailure): void {
  if (recoveryOf(failure) === RoastRecovery.NeedsPerson) {
    isStretchRoasted = true
  }
}
