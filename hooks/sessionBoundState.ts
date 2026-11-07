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

/**
 * Replaces the value of the session `sessionId` with what `change` makes of it, by handing `apply`
 * the change of the whole value in the state, unless another session runs by now. Returns the value
 * of that session in the state after it. `change` is called with null when the session has no
 * value, and a value of another session is left in the state while `change` returns null.
 */
export async function updateOfSession<T extends OfSession>(
  $: EngineInterface,
  sessionId: string,
  change: (own: T | null) => T | null,
  apply: (changeInState: (inState: T | null) => T | null) => Promise<T | null>,
): Promise<T | null> {
  if (!(await isSessionRunning($, sessionId))) {
    return null
  }
  const inState = await apply(inState => {
    const own = ofSession(inState, sessionId)
    const changed = change(own)

    return own === null && changed === null ? inState : changed
  })

  return ofSession(inState, sessionId)
}

/**
 * `loaded` in place of `shown`, unless `shown` was read and `loaded` was not, so a failed read
 * leaves the last values read on screen. A value was read when its outcome is `read`.
 */
export function keepReadOverFailure<Outcome, T extends { outcome: Outcome }>(
  shown: T | null,
  loaded: T,
  read: Outcome,
): T {
  return shown?.outcome === read && loaded.outcome !== read ? shown : loaded
}
