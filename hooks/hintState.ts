import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook } from 'claude-code'

import type { HintKindsSentInTurn } from '../types'
import { isMainConversation } from './conversation'
import { namesOfHintKinds } from './hintKind'
import type { HintKind, HintKindName } from './hintKind'
import { ofSession, updateOfSession } from './sessionBoundState'

// A change of HintKindsSentInTurn or of the names of the hint kinds changes the tag, so the kinds
// written by another version of the plugin read as absent.
const hintKindsSentInTurn = atom(
  { plugin: 'workflow-skills', key: 'hintKindsSentInTurn' } as const,
  null,
  { shape: 'hint-kind-names' },
)

/**
 * Claims the kinds in `kinds` not yet sent in the running turn of the main conversation, counts
 * them as sent, and returns them. Returns no kinds where every kind was sent or another session
 * runs by now.
 */
export async function claimHintKindsUnsentInTurn(
  $: EngineInterface,
  kinds: readonly HintKind[],
): Promise<readonly HintKind[]> {
  const sessionId = await $.session.id()
  const sent = ofSession(await read($, hintKindsSentInTurn), sessionId)?.names ?? []
  const unsent = kinds.filter(kind => !sent.includes(kind.name))
  if (unsent.length === 0) {
    return []
  }
  const recorded = await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: [...(own?.names ?? []), ...namesOfHintKinds(unsent)] }),
    change => update($, hintKindsSentInTurn, change),
  )

  return recorded === null ? [] : unsent
}

/**
 * Counts the hint kinds `names` as sent in the turn of the main conversation of the session
 * `sessionId` that receives a hint note on them: the running turn, or the turn that a prompt
 * submitted next starts. The kinds sent in a turn are cleared before the session counts as idle,
 * so the kinds counted for a prompt submitted while idle last through the turn of that prompt.
 */
export async function markHintKindsSentInTurn(
  $: EngineInterface,
  sessionId: string,
  names: readonly HintKindName[],
): Promise<void> {
  await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: [...(own?.names ?? []), ...names] }),
    change => update($, hintKindsSentInTurn, change),
  )
}

/** Clears the hint kinds sent in the turn of the main conversation that `e` ends, if any. */
export const forgetHintKindsSentInTurn: Hook<'turn.complete'> = async ($, e, next) => {
  if (isMainConversation(e) && (await read($, hintKindsSentInTurn)) !== null) {
    await update($, hintKindsSentInTurn, () => null)
  }

  return next(e)
}
