/** Whether the event comes from the main conversation. An event of a subagent has its agent id. */
export function isMainConversation(event: { readonly agentId?: string | undefined }): boolean {
  return event.agentId === undefined
}
