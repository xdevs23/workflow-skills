import type { Origin } from 'claude-code'

/** Whether the event comes from the main conversation. An event of a subagent has its agent id. */
export function isMainConversation(event: { readonly agentId?: string | undefined }): boolean {
  return event.agentId === undefined
}

/**
 * Whether the model of the main conversation made the tool call `event`, raised from `origin`. A
 * call made by a plugin is raised from the tier of that plugin.
 */
export function isModelToolCall(
  event: { readonly agentId?: string | undefined },
  origin: Origin,
): boolean {
  return isMainConversation(event) && origin.tier === 'core'
}
