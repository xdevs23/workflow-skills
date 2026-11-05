import type { EngineInterface } from 'claude-code'

// The state of the plugin may outlive a switch to another session, so a value that belongs to one
// session carries the id of that session. The engine loads a module only when every read and
// update of the state names an atom declared in that module, so the modules of the features read
// and write their atoms themselves and pass the values through the functions below.

/** A value in the state of the plugin that belongs to the session with the id `sessionId`. */
type OfSession = { readonly sessionId: string }

/** `inState` while it belongs to the session `sessionId`, and null otherwise. */
export function ofSession<T extends OfSession>(inState: T | null, sessionId: string): T | null {
  return inState?.sessionId === sessionId ? inState : null
}

/** `inState` while its session runs, and null otherwise, such as after a switch. */
export async function ofRunningSession<T extends OfSession>(
  $: EngineInterface,
  inState: T | null,
): Promise<T | null> {
  return ofSession(inState, await $.session.id())
}

/** Whether the session `sessionId` still runs, so a value of it may go into the state. */
export async function isSessionRunning($: EngineInterface, sessionId: string): Promise<boolean> {
  return (await $.session.id()) === sessionId
}
