import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { registerPromptWaitPane } from '../promptWaits'
import { registerIdleRoast } from './idleRoast'
import {
  registerIdleRoastCommand,
  replyWithIdleRoastHookFailure,
  runIdleRoastCommand,
} from './idleRoastCommand'
import { forgetForkViewOnCompaction, recordForkView } from './messagesUnseenByFork'
import {
  dropRoastOnClose,
  registerRoastCommand,
  replyWithRoastHookFailure,
  runRoastCommand,
} from './roastCommand'
import {
  IDLE_ROAST_COMMAND,
  ROAST_COMMAND,
  ROAST_PANE,
  ROAST_PANE_CLOSED_BY_USER,
  ROAST_PANE_SITE,
} from './roastNames'
import { drawRoastPane } from './roastScreens'
import { registerVerificationRoast } from './verificationRoast'

/**
 * Registers /roast, which opens a pane with a roast about the main conversation to send to it, and
 * the idle roast with /idle-roast, which sets it for the running session. Also registers the hooks
 * that set and forget what a fork that writes either roast sees of the main conversation, and
 * roast_work, which hands the final-verification agent a roast of the work on the change that agent
 * verifies.
 */
export function registerRoast(on: On): void {
  registerPromptWaitPane(ROAST_PANE)
  on('session.start', { isInteractive: true }, registerRoastCommand)
  on('command.run', { command: ROAST_COMMAND }, runRoastCommand).catch(replyWithRoastHookFailure)
  on('ui.render', ROAST_PANE_SITE, drawRoastPane)
  on('ui.close', ROAST_PANE_CLOSED_BY_USER, dropRoastOnClose)
  on('session.start', { isInteractive: true }, registerIdleRoastCommand)
  on('command.run', { command: IDLE_ROAST_COMMAND }, runIdleRoastCommand).catch(
    replyWithIdleRoastHookFailure,
  )
  registerIdleRoast(on)
  registerVerificationRoast(on)
  on('turn.step', EVERY_EVENT, recordForkView)
  on('session.compact', EVERY_EVENT, forgetForkViewOnCompaction)
}
