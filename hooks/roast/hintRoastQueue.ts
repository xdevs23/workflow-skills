import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { namesOfHintKinds } from '../hintKind'
import type { HintKindName, RoastedHintKind } from '../hintKind'
import { ofRunningSession, updateOfSession } from '../sessionBoundState'

/** A roast on the hints of `kinds`, which `reply`, a reply that ended a turn, calls for. */
export type HintRoastRequest = { reply: string; kinds: readonly HintKindName[] }

/**
 * The roasts on hints of the main conversation of the session `sessionId` not written yet: the
 * roasts queued by the ends of the running turn, and the roasts of the wait after the last turn.
 */
export type HintRoastsOfSession = {
  sessionId: string
  queuedInTurn: readonly HintRoastRequest[]
  ofWait: readonly HintRoastRequest[]
}

/** The roasts of the wait that a turn end starts, and the roasts of the wait before it. */
type HintRoastsHandedToWait = {
  ofWait: readonly HintRoastRequest[]
  replaced: readonly HintRoastRequest[]
}

// A change of HintRoastsOfSession or of the names of the hint kinds changes the tag, so the roasts
// written by another version of the plugin read as absent.
const hintRoastsOfSession = atom(
  { plugin: 'workflow-skills', key: 'hintRoastsOfSession' } as const,
  null,
  { shape: 'hint-roast-requests-in-turn-and-of-wait' },
)

/**
 * Queues the roast on the hints of `kinds`, which `reply`, the reply that ends a turn, calls for. A
 * Stop block lets one turn end several times, so the end of the turn hands all of them to the wait.
 */
export async function queueHintRoast(
  $: EngineInterface,
  reply: string,
  kinds: readonly RoastedHintKind[],
): Promise<void> {
  const request: HintRoastRequest = { reply, kinds: namesOfHintKinds(kinds) }
  await changeHintRoasts($, own => ({ ...own, queuedInTurn: [...own.queuedInTurn, request] }))
}

/**
 * Hands the roasts queued in the turn that ended to the wait, in place of the roasts of the wait
 * before, and returns both.
 */
export async function handHintRoastsToWait($: EngineInterface): Promise<HintRoastsHandedToWait> {
  let handed: HintRoastsHandedToWait = { ofWait: [], replaced: [] }
  await changeHintRoasts($, own => {
    // A retried write runs this again, and its last run decides.
    handed = { ofWait: own.queuedInTurn, replaced: own.ofWait }

    return { ...own, queuedInTurn: [], ofWait: own.queuedInTurn }
  })

  return handed
}

/** The roasts of the wait of the running session. */
export async function readHintRoastsOfWait(
  $: EngineInterface,
): Promise<readonly HintRoastRequest[]> {
  return (await ofRunningSession($, await read($, hintRoastsOfSession)))?.ofWait ?? []
}

/** Removes the roasts of the wait of the running session, once they are written. */
export async function removeHintRoastsOfWait($: EngineInterface): Promise<void> {
  await changeHintRoasts($, own => ({ ...own, ofWait: [] }))
}

/** Removes every roast on hints not written yet, of whichever session, and returns them. */
export async function takeHintRoasts($: EngineInterface): Promise<readonly HintRoastRequest[]> {
  if ((await read($, hintRoastsOfSession)) === null) {
    return []
  }
  let taken: readonly HintRoastRequest[] = []
  await update($, hintRoastsOfSession, inState => {
    // A retried write runs this again, and its last run decides.
    taken = inState === null ? [] : [...inState.queuedInTurn, ...inState.ofWait]

    return null
  })

  return taken
}

/**
 * Replaces the roasts of the running session with what `change` makes of them. Where no roast is
 * left, the state is null.
 */
async function changeHintRoasts(
  $: EngineInterface,
  change: (own: HintRoastsOfSession) => HintRoastsOfSession,
): Promise<void> {
  const sessionId = await $.session.id()
  await updateOfSession<HintRoastsOfSession>(
    $,
    sessionId,
    own => withoutEmpty(change(own ?? { sessionId, queuedInTurn: [], ofWait: [] })),
    changeInState => update($, hintRoastsOfSession, changeInState),
  )
}

function withoutEmpty(roasts: HintRoastsOfSession): HintRoastsOfSession | null {
  return roasts.queuedInTurn.length === 0 && roasts.ofWait.length === 0 ? null : roasts
}
