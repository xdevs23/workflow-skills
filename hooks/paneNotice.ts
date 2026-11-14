import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { ofRunningSession, updateOfSession } from './sessionBoundState'

// The engine lists the state a module reads and writes from the source of the module, so the state
// reference of the notices is written in this file with its plugin and key as literals.
const paneNotices = atom({ plugin: 'workflow-skills', key: 'paneNotices' } as const, null)

/** The text drawn under each pane of the session `sessionId` with one, by the id of the pane. */
export type PaneNotices = { sessionId: string; notices: Readonly<Record<string, string>> }

/** The text drawn under the pane `paneId` of the running session, set when the pane last opened. */
export async function readPaneNotice(
  $: EngineInterface,
  paneId: string,
): Promise<string | undefined> {
  return (await ofRunningSession($, await read($, paneNotices)))?.notices[paneId]
}

/**
 * Sets the text drawn under the pane `paneId` of the session `sessionId` to `notice`, or removes it
 * without `notice`.
 */
export async function setPaneNotice(
  $: EngineInterface,
  sessionId: string,
  paneId: string,
  notice: string | undefined,
): Promise<void> {
  await updateOfSession<PaneNotices>(
    $,
    sessionId,
    own => {
      const others = Object.entries(own?.notices ?? {}).filter(([id]) => id !== paneId)

      return {
        sessionId,
        notices: Object.fromEntries(notice === undefined ? others : [...others, [paneId, notice]]),
      }
    },
    changeInState => update($, paneNotices, changeInState),
  )
}
