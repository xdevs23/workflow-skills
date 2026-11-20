import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { registerPromptWaitPane } from '../promptWaits'
import { registerIdleRoast } from './idleRoast'
import { forgetForkViewOnCompaction, recordForkView } from './messagesUnseenByFork'
import { dropRoastOnClose } from './roastCommand'
import { ROAST_PANE, ROAST_PANE_CLOSED_BY_USER, ROAST_PANE_SITE } from './roastNames'
import { drawRoastPane } from './roastScreens'
import { registerVerificationRoast } from './verificationRoast'
import { registerVerifierPromptLimit } from './verifierPromptLimit'

/**
 * Registers the Roast pane, which shows a roast about the main conversation to send to it, and the
 * idle roast. Also registers the hooks that set and forget what a fork that writes either roast
 * sees of the main conversation, roast_work, which hands the final-verification agent a roast of
 * the work on the change that agent verifies, and the hooks that limit every message to that agent
 * to a short name of the change.
 */
export function registerRoast(on: On): void {
  registerPromptWaitPane(ROAST_PANE)
  on('ui.render', ROAST_PANE_SITE, drawRoastPane)
  on('ui.close', ROAST_PANE_CLOSED_BY_USER, dropRoastOnClose)
  registerIdleRoast(on)
  registerVerificationRoast(on)
  registerVerifierPromptLimit(on)
  on('turn.step', EVERY_EVENT, recordForkView)
  on('session.compact', EVERY_EVENT, forgetForkViewOnCompaction)
}
