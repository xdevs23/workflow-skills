import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { namesOfHintKinds } from '../hintKind'
import type { HintKind, HintKindName } from '../hintKind'
import { ofRunningSession, updateOfSession } from '../sessionBoundState'

/**
 * A roast on the hints of `kinds`, which `reply`, a reply that ended a turn, calls for. `id` tells
 * the request apart from a later one with the same reply.
 */
export type HintRoastRequest = { id: string; reply: string; kinds: readonly HintKindName[] }

/**
 * The roasts on hints of the main conversation of the session `sessionId` not written yet: the
 * roasts queued by the ends of the running turn, and the roasts handed to the waits after turns.
 */
export type HintRoastsOfSession = {
  sessionId: string
  queuedInTurn: readonly HintRoastRequest[]
  ofWait: readonly HintRoastRequest[]
}

// A change of HintRoastsOfSession or of the names of the hint kinds changes the tag, so the roasts
// written by another version of the plugin read as absent.
const hintRoastsOfSession = atom(
  { plugin: 'workflow-skills', key: 'hintRoastsOfSession' } as const,
  null,
  { shape: 'hint-roast-requests-with-ids-in-turn-and-of-wait' },
)

/**
 * Queues the roast on the hints of `kinds`, which `reply`, the reply that ends a turn, calls for. A
 * Stop block lets one turn end several times, so the end of the turn hands all of them to the wait.
 */
export async function queueHintRoast(
  $: EngineInterface,
  reply: string,
  kinds: readonly HintKind[],
): Promise<void> {
  const request: HintRoastRequest = {
    id: crypto.randomUUID(),
    reply,
    kinds: namesOfHintKinds(kinds),
  }
  await changeHintRoasts($, own => ({ ...own, queuedInTurn: [...own.queuedInTurn, request] }))
}

/**
 * Hands the roasts queued in the turn that ended to the wait, after the roasts that earlier waits
 * kept, and returns every roast of the wait.
 */
export async function handHintRoastsToWait(
  $: EngineInterface,
): Promise<readonly HintRoastRequest[]> {
  let ofWait: readonly HintRoastRequest[] = []
  await changeHintRoasts($, own => {
    // A retried write runs this again, and its last run decides.
    ofWait = [...own.ofWait, ...own.queuedInTurn]

    return { ...own, queuedInTurn: [], ofWait }
  })

  return ofWait
}

/** The roasts of the wait of the running session. */
export async function readHintRoastsOfWait(
  $: EngineInterface,
): Promise<readonly HintRoastRequest[]> {
  return (await ofRunningSession($, await read($, hintRoastsOfSession)))?.ofWait ?? []
}

/** Whether a roast of the wait of the running session has one of the ids `ids`. */
export async function hasHintRoastOfWaitAmong(
  $: EngineInterface,
  ids: ReadonlySet<string>,
): Promise<boolean> {
  return (await readHintRoastsOfWait($)).some(request => ids.has(request.id))
}

/** Removes the roasts of the wait of the running session with the ids `ids`, once written. */
export async function removeHintRoastsOfWait(
  $: EngineInterface,
  ids: ReadonlySet<string>,
): Promise<void> {
  await changeHintRoasts($, own => ({
    ...own,
    ofWait: own.ofWait.filter(request => !ids.has(request.id)),
  }))
}

/**
 * Removes from the roasts of the wait of the running session the hint kinds for which `isRemoved`
 * holds, together with each roast left without a kind, and returns each roast with the kinds
 * removed from it.
 */
export async function removeHintKindsOfWait(
  $: EngineInterface,
  isRemoved: (kind: HintKindName) => boolean,
): Promise<readonly HintRoastRequest[]> {
  let removed: readonly HintRoastRequest[] = []
  await changeHintRoasts($, own => {
    const split = own.ofWait.map(request => ({
      kept: { ...request, kinds: request.kinds.filter(kind => !isRemoved(kind)) },
      removed: { ...request, kinds: request.kinds.filter(isRemoved) },
    }))
    // A retried write runs this again, and its last run decides.
    removed = split.map(part => part.removed).filter(hasKinds)

    return { ...own, ofWait: split.map(part => part.kept).filter(hasKinds) }
  })

  return removed
}

function hasKinds(request: HintRoastRequest): boolean {
  return request.kinds.length > 0
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
