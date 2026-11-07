import type {
  EngineInterface,
  Frozen,
  Next,
  Timer,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { messageOf } from './errorMessage'
import { showFailure } from './failureToast'

/**
 * The longest wait a timer of the engine holds, in milliseconds: the limit the engine types name
 * for the `timeoutMs` of `$.model.complete`, "held to what a timer holds".
 */
const LONGEST_TIMER_WAIT = 2_147_483_647

/**
 * Runs `work` once after `milliseconds`, and returns the timer that cancels it. A wait longer than
 * a timer holds ends at that limit, so `work` finds out itself whether its time came, and waits
 * again when it did not. The engine does not wait for the work of a timer, so a failure of `work`
 * is shown with the text made by `describeFailure` from its message.
 */
export function runAfter(
  $: EngineInterface,
  milliseconds: number,
  work: () => Promise<void>,
  describeFailure: (message: string) => string,
): Timer {
  return $.clock.after(Math.min(milliseconds, LONGEST_TIMER_WAIT), () => {
    work().catch((error: unknown) => showFailure($, describeFailure(messageOf(error))))
  })
}

/**
 * Runs `work` at once in a separate timer, so the hook that starts it does not wait for it. A
 * prompt submitted by the plugin starts its turn once the session is idle, and the submit resolves
 * only then. Nothing cancels the work, so the timer is not returned. A failure of `work` is shown
 * as `runAfter` shows it.
 */
export function runDetached(
  $: EngineInterface,
  work: () => Promise<void>,
  describeFailure: (message: string) => string,
): void {
  void runAfter($, 0, work, describeFailure)
}

/**
 * The first due time after `after`, of the due times every `interval` from `from` on, `from`
 * itself not counted. Work idle through several due times is due once, at the last of them.
 */
export function firstDueTimeAfter(from: number, interval: number, after: number): number {
  const periods = Math.max(Math.floor((after - from) / interval) + 1, 1)

  return from + periods * interval
}

/**
 * Runs the end of the turn `e`, and then `wait` when the turn was one of the main conversation, so
 * a due time that passed during the turn is waited for again once the turn ended.
 */
export async function waitAgainAfterTurn(
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  wait: () => Promise<void>,
): Promise<TurnCompleteResult> {
  const completed = await next(e)
  if (isMainConversation(e)) {
    await wait()
  }

  return completed
}
