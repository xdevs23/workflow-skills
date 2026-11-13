import type { SessionCompactTrigger } from 'claude-code'

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
