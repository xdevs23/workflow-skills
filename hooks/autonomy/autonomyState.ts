import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { returningProjectFailure } from '../projectFolder'
import { updateOfSession } from '../sessionBoundState'
import { takeSetting } from '../settingNotes'
import type { SettingOfSession, TakenSetting } from '../settingNotes'
import { GrantsFailureKind, isSameGrants, readGrants } from './autonomyGrants'
import type { Grant, ReadGrants } from './autonomyGrants'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the autonomy is written in this file with its plugin and key as literals.
const sessionAutonomy = atom({ plugin: 'workflow-skills', key: 'sessionAutonomy' } as const, null)

export type SessionAutonomy = SettingOfSession<readonly Grant[]> & { newestLoad: number }

export async function startConversationState(
  $: EngineInterface,
  readByModel: readonly Grant[] | null,
): Promise<void> {
  await changeOwnState($, await $.session.id(), own => ({ ...own, readByModel }))
}

export async function loadGrantsIntoState($: EngineInterface): Promise<ReadGrants> {
  const sessionId = await $.session.id()
  const started = await changeOwnState($, sessionId, own => ({
    ...own,
    newestLoad: own.newestLoad + 1,
  }))
  const loaded = await returningProjectFailure(
    $,
    () => readGrants($, sessionId),
    (failure): ReadGrants => ({
      grants: [],
      failures: [{ kind: GrantsFailureKind.Project, failure }],
    }),
  )
  await changeOwnState($, sessionId, own =>
    own.newestLoad === started?.newestLoad ? { ...own, setting: loaded.grants } : own,
  )

  return loaded
}

export function takeUnreadGrants(
  $: EngineInterface,
): Promise<TakenSetting<readonly Grant[]> | undefined> {
  return takeSetting<SessionAutonomy>(
    $,
    ({ setting, readByModel }) => readByModel === null || !isSameGrants(setting, readByModel),
    change => update($, sessionAutonomy, change),
  )
}

export function takeEveryGrant(
  $: EngineInterface,
): Promise<TakenSetting<readonly Grant[]> | undefined> {
  return takeSetting<SessionAutonomy>(
    $,
    () => true,
    change => update($, sessionAutonomy, change),
  )
}

function changeOwnState(
  $: EngineInterface,
  sessionId: string,
  change: (own: SessionAutonomy) => SessionAutonomy,
): Promise<SessionAutonomy | null> {
  return updateOfSession<SessionAutonomy>(
    $,
    sessionId,
    own => change(own ?? { sessionId, newestLoad: 0, setting: [], readByModel: null }),
    inState => update($, sessionAutonomy, inState),
  )
}
