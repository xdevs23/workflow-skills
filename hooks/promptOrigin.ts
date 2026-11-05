import type { PromptOrigin } from 'claude-code'

/**
 * Whether the prompt or the command with the origin `origin` was typed by the user: at the prompt,
 * or through the Remote Control bridge.
 */
export function isTypedByUser(origin: PromptOrigin): boolean {
  return origin.kind === 'composer' || origin.kind === 'bridge'
}
