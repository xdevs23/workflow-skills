import type { Engine } from 'claude-code/testing'
import type { On, PromptSubmitInput, TurnCompleteReason } from 'claude-code'

export const TURN = 'turn-1'

// The kit stops a test after five seconds unless told otherwise. These tests end once the work
// they start has settled, so they disable the time limit.
export const NO_TIME_LIMIT = { timeoutMs: Number.POSITIVE_INFINITY }

/**
 * Replaces the engine beneath the plugin for prompts, and returns the prompts the engine receives.
 * A prompt for which `dropOf` returns a reason is dropped with that reason.
 */
export function recordPrompts(
  on: On,
  dropOf: (prompt: PromptSubmitInput) => string | undefined = () => undefined,
): PromptSubmitInput[] {
  const prompts: PromptSubmitInput[] = []
  on('prompt.submit', ($, e) => {
    prompts.push(e)
    const drop = dropOf(e)
    if (drop !== undefined) {
      return { drop }
    }

    return e.context === undefined ? { text: e.text } : { text: e.text, context: e.context }
  })

  return prompts
}

export function typePrompt($: Engine, text: string) {
  return $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false })
}

/** Ends the turn TURN of the main conversation, or of the subagent `agentId`, with `answer`. */
export function endTurn(
  $: Engine,
  turn: {
    answer?: string
    reason?: Exclude<TurnCompleteReason, 'refusal'>
    agentId?: string
  } = {},
) {
  const reason = turn.reason ?? 'answer'

  return $.turn.complete({
    answer: turn.answer ?? '',
    durationMs: 5,
    isAborted: reason === 'aborted',
    turnId: TURN,
    reason,
    ...(turn.agentId === undefined ? {} : { agentId: turn.agentId }),
  })
}
