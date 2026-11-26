import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { registerPromptWaitPane } from '../promptWaits'
import { registerAgentRoast } from './agentRoast'
import { roastChatBeforeCompaction } from './compactionRoast'
import { dropHintRoastsOnUserMessage } from './hintRoast'
import { registerIdleRoast } from './idleRoast'
import { registerIdleWait } from './idleWaitRoasts'
import { forgetForkViewOnCompaction, recordForkView } from './messagesUnseenByFork'
import { dropRoastOnClose } from './roastCommand'
import { ROAST_PANE, ROAST_PANE_CLOSED_BY_USER, ROAST_PANE_SITE } from './roastNames'
import { drawRoastPane } from './roastScreens'

/**
 * Registers the Roast pane, which shows a roast about the main conversation to send to it, the idle
 * roast and the roast on hints. Also registers the hooks that set and forget what a fork that
 * writes a roast sees of the main conversation, and the hook that has a fork roast the chat before
 * each compaction in the main conversation, and the roast for each subagent of an agent type that
 * `roastedAgentTypes` lists.
 */
export function registerRoast(on: On, roastedAgentTypes: readonly string[]): void {
  registerPromptWaitPane(ROAST_PANE)
  on('ui.render', ROAST_PANE_SITE, drawRoastPane)
  on('ui.close', ROAST_PANE_CLOSED_BY_USER, dropRoastOnClose)
  // The turn started by a note on hints starts the wait again at its end, so the idle roast reads
  // the conversation after the hints.
  registerIdleWait(on)
  registerIdleRoast(on)
  on('prompt.submit', EVERY_EVENT, dropHintRoastsOnUserMessage)
  on('turn.step', EVERY_EVENT, recordForkView)
  on('session.compact', EVERY_EVENT, forgetForkViewOnCompaction)
  on('session.compact', EVERY_EVENT, roastChatBeforeCompaction)
  registerAgentRoast(on, roastedAgentTypes)
}
