import { atom, read, update } from 'claude-code'
import type { EngineInterface, Timer } from 'claude-code'

import { ofRunningSession } from '../sessionBoundState'
import { readSessionAcceptsPluginPrompts } from '../sessionState'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'
import { runAfter, runDetached } from '../timedWork'
import { IDLE_WAIT_SECONDS } from './roastNames'

/** Why the wait of the running session was cancelled. */
export enum IdleWaitCancel {
  /** A turn of the main conversation started. */
  TurnStarted = 'turn started',
  /** Another session runs, after /clear, /resume or a fork. */
  SessionSwitched = 'session switched',
}

/**
 * Work done once the main conversation was idle for IDLE_WAIT_SECONDS after a turn. Its functions
 * close over the `$` of the hook that made the work, since the engine passes `$` only to a function
 * named at the call.
 */
export type IdleWaitWork = {
  /** Handles the start of a wait, and returns whether this work runs at its end. */
  start: () => Promise<boolean>
  /** Handles the cancel of the wait for `cause`. */
  cancel: (cause: IdleWaitCancel) => Promise<void>
  /**
   * Runs at the end of the wait while `isWaitOfSession`, and returns whether it sent the session
   * anything.
   */
  end: (isWaitOfSession: () => boolean) => Promise<boolean>
  /** The toast for a failure of `end` with the message `message`. */
  describeFailure: (message: string) => string
}

/** The works of the wait, in the order in which they run at its end. */
export type IdleWaitWorks = readonly [IdleWaitWork, ...IdleWaitWork[]]

/** When the wait of the session `sessionId` ends. */
export type IdleWaitEnd = { sessionId: string; endsAt: number }

const IDLE_WAIT_MILLISECONDS = IDLE_WAIT_SECONDS * MILLISECONDS_PER_SECOND

// The end of the wait, stored so the start of the session after a reload of the plugin waits for
// the time left.
const idleWaitEnd = atom({ plugin: 'workflow-skills', key: 'idleWaitEnd' } as const, null)

// The number of the wait of the running session, raised by each start and each cancel of the wait
// and kept by a restart, so the works of a wait run only until a turn starts or another session
// runs.
let waitNumber = 0

// The timer of the end of the wait of the running session, until it fires.
let pendingEnd: Timer | undefined = undefined

/**
 * Starts the wait in place of the one before it, at the end of a turn of the main conversation.
 * Where a work of `works` runs at its end, the wait ends after IDLE_WAIT_SECONDS.
 */
export async function startIdleWait($: EngineInterface, works: IdleWaitWorks): Promise<void> {
  stopRunningWait()
  const isWaitOfSession = checkOfRunningWait()
  const runsAtEnd = await Promise.all(works.map(work => work.start()))
  if (runsAtEnd.includes(true)) {
    await endWaitAfter($, IDLE_WAIT_MILLISECONDS, isWaitOfSession, works)
  }
}

/**
 * Cancels the wait of the running session for `cause`, and has each work of `works` handle the
 * cancel, in their order.
 */
export async function cancelIdleWait(
  $: EngineInterface,
  cause: IdleWaitCancel,
  works: IdleWaitWorks,
): Promise<void> {
  stopRunningWait()
  if ((await read($, idleWaitEnd)) !== null) {
    await update($, idleWaitEnd, () => null)
  }
  for (const work of works) {
    await work.cancel(cause)
  }
}

/**
 * Has the wait of the running session end IDLE_WAIT_SECONDS after this call, unless its end is
 * still to come, or a turn runs, whose end starts the wait.
 */
export async function restartIdleWait($: EngineInterface, works: IdleWaitWorks): Promise<void> {
  const isWaitOfSession = checkOfRunningWait()
  if (pendingEnd === undefined && (await readSessionAcceptsPluginPrompts($))) {
    await endWaitAfter($, IDLE_WAIT_MILLISECONDS, isWaitOfSession, works)
  }
}

/**
 * Has the wait stored for the running session end at its time, once a reload of the plugin dropped
 * the timer of the wait, where that time is still to come.
 */
export async function resumeIdleWait($: EngineInterface, works: IdleWaitWorks): Promise<void> {
  const isWaitOfSession = checkOfRunningWait()
  const stored = await ofRunningSession($, await read($, idleWaitEnd))
  const now = await $.clock.now()
  if (stored !== null && stored.endsAt > now) {
    runWorksAfter($, stored.endsAt - now, isWaitOfSession, works)
  }
}

function stopRunningWait(): void {
  waitNumber += 1
  pendingEnd?.cancel()
  pendingEnd = undefined
}

/** Whether the wait of the session is still the wait that ran when this function was called. */
function checkOfRunningWait(): () => boolean {
  const number = waitNumber

  return () => waitNumber === number
}

/**
 * Stores the end of the wait after `milliseconds`, and runs `works` at it, as runWorksAfter
 * describes, while `isWaitOfSession`. A turn may have started during the reads before this call.
 */
async function endWaitAfter(
  $: EngineInterface,
  milliseconds: number,
  isWaitOfSession: () => boolean,
  works: IdleWaitWorks,
): Promise<void> {
  const end: IdleWaitEnd = {
    sessionId: await $.session.id(),
    endsAt: (await $.clock.now()) + milliseconds,
  }
  if (isWaitOfSession()) {
    await update($, idleWaitEnd, () => end)
    runWorksAfter($, milliseconds, isWaitOfSession, works)
  }
}

/** Runs `works` in their order once `milliseconds` passed, as endWaitWith describes. */
function runWorksAfter(
  $: EngineInterface,
  milliseconds: number,
  isWaitOfSession: () => boolean,
  [first, ...rest]: IdleWaitWorks,
): void {
  pendingEnd?.cancel()
  pendingEnd = runAfter(
    $,
    milliseconds,
    async () => {
      pendingEnd = undefined
      await endWaitWith($, isWaitOfSession, first, rest)
    },
    first.describeFailure,
  )
}

/**
 * Runs the end of `work` while `isWaitOfSession`, and where it sent the session nothing, the end of
 * the first work of `rest` as `runDetached` runs work, so a failure shows with the toast of its own
 * work, and the works after it do not run.
 */
async function endWaitWith(
  $: EngineInterface,
  isWaitOfSession: () => boolean,
  work: IdleWaitWork,
  [next, ...rest]: readonly IdleWaitWork[],
): Promise<void> {
  if (isWaitOfSession() && !(await work.end(isWaitOfSession)) && next !== undefined) {
    runDetached($, () => endWaitWith($, isWaitOfSession, next, rest), next.describeFailure)
  }
}
