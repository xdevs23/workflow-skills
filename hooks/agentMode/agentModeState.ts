import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { ofRunningSession, ofSession, updateOfSession } from '../sessionBoundState'
import { RecordOutcome } from '../sessionRecord'
import type { FailedRecordRead } from '../sessionRecord'
import { takeSetting } from '../settingNotes'
import type { SettingOfSession, TakenSetting } from '../settingNotes'
import { DEFAULT_AGENT_MODE } from './agentModeNames'
import type { AgentMode } from './agentModeNames'
import { readAgentMode } from './agentModeStore'

// The engine lists the state a module reads and writes from the source of the module, so this file
// writes every state reference of the agent mode with its plugin and key as literals.
const sessionAgentMode = atom({ plugin: 'workflow-skills', key: 'sessionAgentMode' } as const, null)

/** `isRecordRead` holds once the mode was read from the record of the session, or set. */
export type SessionAgentMode = SettingOfSession<AgentMode> & { isRecordRead: boolean }

export async function startConversationState(
  $: EngineInterface,
  readByModel: AgentMode | null,
): Promise<void> {
  await changeOwnState($, await $.session.id(), own => ({ ...own, readByModel }))
}

export async function readAgentModeInState($: EngineInterface): Promise<AgentMode> {
  const own = await ofRunningSession($, await read($, sessionAgentMode))

  return own?.setting ?? DEFAULT_AGENT_MODE
}

/**
 * Reads the agent mode set for the running session into the state, until it was read once or set.
 * A read that fails leaves the mode in the state, and is returned.
 */
export async function loadAgentModeIntoState(
  $: EngineInterface,
): Promise<FailedRecordRead | undefined> {
  const sessionId = await $.session.id()
  if (ofSession(await read($, sessionAgentMode), sessionId)?.isRecordRead === true) {
    return undefined
  }
  const loaded = await readAgentMode($, sessionId)
  if (loaded.outcome !== RecordOutcome.Read) {
    return loaded
  }
  // A set while the record was read has written the newer mode already.
  await changeOwnState($, sessionId, own =>
    own.isRecordRead ? own : { ...own, setting: loaded.value, isRecordRead: true },
  )

  return undefined
}

export async function setAgentModeInState(
  $: EngineInterface,
  sessionId: string,
  mode: AgentMode,
): Promise<void> {
  await changeOwnState($, sessionId, own => ({ ...own, setting: mode, isRecordRead: true }))
}

export function takeUnreadAgentMode(
  $: EngineInterface,
): Promise<TakenSetting<AgentMode> | undefined> {
  return takeSetting<SessionAgentMode>(
    $,
    ({ setting, readByModel }) => setting !== readByModel,
    change => update($, sessionAgentMode, change),
  )
}

export function takeEveryAgentMode(
  $: EngineInterface,
): Promise<TakenSetting<AgentMode> | undefined> {
  return takeSetting<SessionAgentMode>(
    $,
    () => true,
    change => update($, sessionAgentMode, change),
  )
}

function changeOwnState(
  $: EngineInterface,
  sessionId: string,
  change: (own: SessionAgentMode) => SessionAgentMode,
): Promise<SessionAgentMode | null> {
  return updateOfSession<SessionAgentMode>(
    $,
    sessionId,
    own =>
      change(
        own ?? { sessionId, setting: DEFAULT_AGENT_MODE, readByModel: null, isRecordRead: false },
      ),
    inState => update($, sessionAgentMode, inState),
  )
}
