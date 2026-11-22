import type { EngineInterface, MatchedHook } from 'claude-code'

import type { IdleStretch, PendingMissingWork } from '../../types'
import { isMainConversation } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { showFailure } from '../failureToast'
import type { PendingTextSource } from '../pendingTexts'
import { readCanSubmitPluginPrompt } from '../promptWaits'
import { PromptOutcome, submitToSessionOrRestore } from '../sendToModel'
import type { TextWithLine } from '../sendToModel'
import { MILLISECONDS_PER_MINUTE } from '../timeUnits'
import { runAfter, runAfterMainTurn, runDetached } from '../timedWork'
import { startGoalCheck } from './goalCheck'
import type { CheckedStretch } from './goalCheck'
import {
  MISSING_WORK_WAITING_AFTER_STOP,
  describeGoalsNotChecked,
  describeMissingWork,
  describeMissingWorkNotSent,
  describeMissingWorkWaitingForPane,
} from './goalCheckTexts'
import { readIdleStretch, updateIdleStretch, updatePendingMissingWork } from './goalState'

/**
 * How long the main conversation is idle before the goal checker judges the open goals: a product
 * choice.
 */
const IDLE_MINUTES = 30

/** The phase of the main conversation of a session between two of its turns. */
export enum IdlePhase {
  /** A turn runs, and its end starts the idle minutes. */
  Running = 'running',
  /** The idle minutes run after the last turn. */
  Waiting = 'waiting',
  /**
   * The idle minutes passed while the prompts submitted by the plugin waited, and the goal check
   * starts once they no longer wait.
   */
  Due = 'due',
  /**
   * The goal check of the stretch started. A turn that starts meanwhile ends the stretch, and the
   * verdicts reported later still apply.
   */
  Checking = 'checking',
}

export const endIdleStretch: MatchedHook<'turn.start', EveryEvent> = async ($, e, next) => {
  if (isMainConversation(e)) {
    const sessionId = await $.session.id()
    await updateIdleStretch($, sessionId, () => newStretch(sessionId, IdlePhase.Running))
  }

  return next(e)
}

export const waitAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  runAfterMainTurn(e, next, () => startIdleStretch($))

/** Starts the idle minutes after a turn. */
async function startIdleStretch($: EngineInterface): Promise<void> {
  const waiting = newStretch(await $.session.id(), IdlePhase.Waiting)
  await updateIdleStretch($, waiting.sessionId, () => waiting)
  waitForIdleMinutes($, waiting)
}

/** Starts the goal check once the idle minutes of the stretch `waiting` passed. */
function waitForIdleMinutes($: EngineInterface, waiting: IdleStretch): void {
  // The timer has no handle: once the stretch `waiting` ended, the check finds another stretch in
  // the state and starts nothing.
  void runAfter(
    $,
    IDLE_MINUTES * MILLISECONDS_PER_MINUTE,
    () => checkAfterIdle($, waiting),
    describeGoalsNotChecked,
  )
}

/**
 * Starts the goal check while the stretch `waiting` lasts. While the prompts submitted by the
 * plugin wait, the stretch becomes due instead.
 */
async function checkAfterIdle($: EngineInterface, waiting: IdleStretch): Promise<void> {
  if (!isSameStretch(await readIdleStretch($, waiting.sessionId), waiting)) {
    return
  }
  if (await readCanSubmitPluginPrompt($)) {
    await checkGoals($, waiting)
  } else {
    await replaceStretch($, waiting, { ...waiting, phase: IdlePhase.Due })
  }
}

/**
 * Starts the goal check of the running session without waiting for it, when its idle minutes
 * passed while the prompts submitted by the plugin waited, and they no longer wait.
 */
export function startDueGoalCheck($: EngineInterface): void {
  runDetached(
    $,
    async () => {
      const stretch = await readIdleStretch($, await $.session.id())
      if (stretch?.phase === IdlePhase.Due && (await readCanSubmitPluginPrompt($))) {
        await checkGoals($, stretch)
      }
    },
    describeGoalsNotChecked,
  )
}

/** Starts the goal check of the stretch `current`, once for it. */
async function checkGoals($: EngineInterface, current: IdleStretch): Promise<void> {
  if (await replaceStretch($, current, { ...current, phase: IdlePhase.Checking })) {
    await startGoalCheck($, current)
  }
}

/**
 * Starts the idle minutes again after the goal check of the stretch `checked` failed for a cause
 * that can clear on its own, while that stretch lasts.
 */
export function waitAgainAfterCheck(
  $: EngineInterface,
  { sessionId, stretchId }: CheckedStretch,
): Promise<void> {
  return waitAgain($, { sessionId, stretchId, phase: IdlePhase.Checking })
}

/** The goals found open by the goal checker, as a source of texts sent to the model. */
export function missingWorkSource($: EngineInterface): PendingTextSource {
  return {
    takeNote: () => takeMissingWorkNote($),
    submit: () => submitMissingWork($),
    describeNotSent: describeMissingWorkNotSent,
    waitingAfterStopToast: MISSING_WORK_WAITING_AFTER_STOP,
    describeWaitingForPane: describeMissingWorkWaitingForPane,
  }
}

/**
 * Submits the goals found open as a prompt that starts a turn. Where the prompt does not enter, the
 * goals wait again, and the idle minutes start again.
 */
async function submitMissingWork($: EngineInterface): Promise<void> {
  const pending = await takeMissingWork($)
  if (pending === undefined) {
    return
  }
  const { sessionId } = pending
  const reminded = newStretch(sessionId, IdlePhase.Running)
  await updateIdleStretch($, sessionId, () => reminded)
  // The prompt shows in the transcript itself, so it is sent without a transcript line.
  const submitted = await submitToSessionOrRestore(
    $,
    sessionId,
    { text: describeMissingWork(pending, await $.clock.now()).text },
    async () => {
      await updatePendingMissingWork($, sessionId, waiting => waiting ?? pending)
      await waitAgain($, reminded)
    },
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeMissingWorkNotSent(submitted.reason))
  }
}

/**
 * Removes the goals found open from the state, and returns their note at the time of the call, if
 * any wait for the session.
 */
async function takeMissingWorkNote($: EngineInterface): Promise<TextWithLine | undefined> {
  const pending = await takeMissingWork($)

  return pending && describeMissingWork(pending, await $.clock.now())
}

/** Removes the goals found open from the state, and returns them, if any wait for the session. */
async function takeMissingWork($: EngineInterface): Promise<PendingMissingWork | undefined> {
  let taken: PendingMissingWork | undefined
  await updatePendingMissingWork($, await $.session.id(), pending => {
    // A retried write runs this again, and the later run overwrites what the earlier one set.
    taken = pending ?? undefined

    return null
  })

  return taken
}

/** Starts the idle minutes again while `current` is the stretch in the state. */
async function waitAgain($: EngineInterface, current: IdleStretch): Promise<void> {
  const again = newStretch(current.sessionId, IdlePhase.Waiting)
  if (await replaceStretch($, current, again)) {
    waitForIdleMinutes($, again)
  }
}

/**
 * Replaces the stretch `current` with `next` while `current` is the stretch of its session in the
 * state, and returns whether this call replaced it.
 */
async function replaceStretch(
  $: EngineInterface,
  current: IdleStretch,
  next: IdleStretch,
): Promise<boolean> {
  let isReplaced = false
  await updateIdleStretch($, current.sessionId, stretch => {
    // A retried write runs this again, and the later run overwrites what the earlier one set.
    isReplaced = isSameStretch(stretch, current)

    return isReplaced ? next : stretch
  })

  return isReplaced
}

function newStretch(sessionId: string, phase: IdlePhase): IdleStretch {
  return { sessionId, stretchId: crypto.randomUUID(), phase }
}

function isSameStretch(stretch: IdleStretch | null, other: IdleStretch): boolean {
  return stretch?.stretchId === other.stretchId && stretch.phase === other.phase
}
