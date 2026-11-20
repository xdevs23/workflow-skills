import type { SessionCompactTrigger } from 'claude-code'

import { isMainConversation } from './conversation'

/**
 * Whether a compaction by each trigger puts its summary in place of the conversation. A
 * `precompute` computes a summary ahead of time and changes nothing.
 */
export const REPLACES_CONVERSATION: Record<SessionCompactTrigger, boolean> = {
  manual: true,
  auto: true,
  plugin: true,
  precompute: false,
}

/** Whether the compaction `e` puts its summary in place of the main conversation. */
export function replacesMainConversation(e: {
  readonly agentId?: string | undefined
  readonly trigger: SessionCompactTrigger
}): boolean {
  return isMainConversation(e) && REPLACES_CONVERSATION[e.trigger]
}
