import type { EngineInterface, Frozen, Next, NextResult, PaneCloseInput, UiPane } from 'claude-code'

import { acceptsPluginPrompts, readSessionActivity } from './sessionState'
import type { SessionActivity } from './sessionState'

// Each feature registers its panes as the module registers its hooks. A reload of the module starts
// the list anew.
const promptWaitPaneIds: string[] = []

/** Makes the prompts submitted by the plugin wait while the pane with the id `paneId` is drawn. */
export function registerPromptWaitPane(paneId: string): void {
  promptWaitPaneIds.push(paneId)
}

/**
 * What decides whether a prompt submitted by the plugin goes to the session now: the activity of
 * the session, and the first registered pane drawn now, if any.
 */
export type PluginPromptSituation = { activity: SessionActivity; waitPane: UiPane | undefined }

export async function readPluginPromptSituation(
  $: EngineInterface,
): Promise<PluginPromptSituation> {
  const drawn = (await $.ui.panes()).filter(pane => pane.isPlaced)

  return {
    activity: await readSessionActivity($),
    waitPane: promptWaitPaneIds
      .map(id => drawn.find(pane => pane.id === id))
      .find(pane => pane !== undefined),
  }
}

/** Whether a prompt submitted by the plugin in `situation` enters the session and starts a turn. */
export function canSubmitPluginPrompt(situation: PluginPromptSituation): boolean {
  return acceptsPluginPrompts(situation.activity) && situation.waitPane === undefined
}

export async function readCanSubmitPluginPrompt($: EngineInterface): Promise<boolean> {
  return canSubmitPluginPrompt(await readPluginPromptSituation($))
}

/**
 * Closes the pane named by `e` as `next` does, and then calls `sendWaitingPrompts` when the pane
 * made the prompts submitted by the plugin wait. Only a pane closed by the user ends the wait here.
 * The plugin closes such a pane to submit a prompt of its own, and the turn started by that prompt
 * sends the waiting prompts when it ends.
 */
export async function closePaneSendingWaitingPrompts(
  e: Frozen<PaneCloseInput>,
  next: Next<'ui.close'>,
  sendWaitingPrompts: () => void,
): Promise<NextResult<'ui.close'>> {
  const closed = await next(e)
  if (closed.deny === undefined && promptWaitPaneIds.includes(e.id)) {
    sendWaitingPrompts()
  }

  return closed
}
