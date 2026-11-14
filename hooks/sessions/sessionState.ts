import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { ofSession } from '../sessionBoundState'

// The engine lists the state a module reads and writes from the source of the module, so the state
// reference of the session records is written in this file with its plugin and key as literals.
const firstPromptAwaited = atom(
  { plugin: 'workflow-skills', key: 'firstPromptAwaited' } as const,
  null,
)

/** Marks the session `sessionId`, which recorded its start, as waiting for its first prompt. */
export async function awaitFirstPrompt($: EngineInterface, sessionId: string): Promise<void> {
  await update($, firstPromptAwaited, () => ({ sessionId }))
}

/** Whether the session `sessionId` recorded its start in this process and no first prompt yet. */
export async function isFirstPromptAwaited(
  $: EngineInterface,
  sessionId: string,
): Promise<boolean> {
  return ofSession(await read($, firstPromptAwaited), sessionId) !== null
}

export async function stopAwaitingFirstPrompt($: EngineInterface): Promise<void> {
  await update($, firstPromptAwaited, () => null)
}
