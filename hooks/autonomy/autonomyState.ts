import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { returningProjectFailure } from '../projectFolder'
import { updateOfSession } from '../sessionBoundState'
import { GrantsFailureKind, isSameGrants, readGrants } from './autonomyGrants'
import type { Grant, ReadGrants } from './autonomyGrants'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the autonomy is written in this file with its plugin and key as literals.
const sessionAutonomy = atom({ plugin: 'workflow-skills', key: 'sessionAutonomy' } as const, null)

export type SessionAutonomy = {
  sessionId: string
  newestLoad: number
  grants: readonly Grant[]
  grantsReadByModel: readonly Grant[] | null
}

export type UnreadGrants = { grants: readonly Grant[]; restore: () => Promise<void> }

export async function startConversationState(
  $: EngineInterface,
  grantsReadByModel: readonly Grant[] | null,
): Promise<void> {
  await changeOwnState($, await $.session.id(), own => ({ ...own, grantsReadByModel }))
}

export async function loadGrantsIntoState($: EngineInterface): Promise<ReadGrants> {
  const sessionId = await $.session.id()
  const started = await changeOwnState($, sessionId, own => ({
    ...own,
    newestLoad: own.newestLoad + 1,
  }))
  const loaded = await returningProjectFailure(
    $,
    project => readGrants($, { sessionId, project }),
    (failure): ReadGrants => ({
      grants: [],
      failures: [{ kind: GrantsFailureKind.Project, failure }],
    }),
  )
  await changeOwnState($, sessionId, own =>
    own.newestLoad === started?.newestLoad ? { ...own, grants: loaded.grants } : own,
  )

  return loaded
}

export function takeUnreadGrants($: EngineInterface): Promise<UnreadGrants | undefined> {
  return takeGrants($, ({ grants, grantsReadByModel }) =>
    grantsReadByModel === null || !isSameGrants(grants, grantsReadByModel),
  )
}

export function takeEveryGrant($: EngineInterface): Promise<UnreadGrants | undefined> {
  return takeGrants($, () => true)
}

async function takeGrants(
  $: EngineInterface,
  isToSend: (own: SessionAutonomy) => boolean,
): Promise<UnreadGrants | undefined> {
  const sessionId = await $.session.id()
  let taken: UnreadGrants | undefined
  await updateOfSession<SessionAutonomy>(
    $,
    sessionId,
    own => {
      // A retried write runs this again, and its last run decides.
      taken = undefined
      if (own === null || !isToSend(own)) {
        return own
      }
      const readBefore = own.grantsReadByModel
      taken = {
        grants: own.grants,
        restore: async () => {
          await changeOwnState($, sessionId, now => ({ ...now, grantsReadByModel: readBefore }))
        },
      }

      return { ...own, grantsReadByModel: own.grants }
    },
    change => update($, sessionAutonomy, change),
  )

  return taken
}

function changeOwnState(
  $: EngineInterface,
  sessionId: string,
  change: (own: SessionAutonomy) => SessionAutonomy,
): Promise<SessionAutonomy | null> {
  return updateOfSession<SessionAutonomy>(
    $,
    sessionId,
    own => change(own ?? { sessionId, newestLoad: 0, grants: [], grantsReadByModel: null }),
    inState => update($, sessionAutonomy, inState),
  )
}
