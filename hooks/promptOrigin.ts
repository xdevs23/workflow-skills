import type { Frozen, PromptOrigin, PromptSubmitInput } from 'claude-code'

/**
 * Whether the prompt or the command with the origin `origin` was typed by the user: at the prompt,
 * or through the Remote Control bridge.
 */
export function isTypedByUser(origin: PromptOrigin): boolean {
  return origin.kind === 'composer' || origin.kind === 'bridge'
}

/** Whether the user typed the prompt `e` as a message to the model, and not as a slash command. */
export function isMessageTypedByUser(e: Frozen<PromptSubmitInput>): boolean {
  return e.command === undefined && isTypedByUser(e.origin)
}
