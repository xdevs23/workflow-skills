import type { On } from 'claude-code'

import {
  dropRoastOnClose,
  registerRoastCommand,
  replyWithRoastHookFailure,
  runRoastCommand,
} from './roastCommand'
import { ROAST_COMMAND, ROAST_PANE_CLOSED_BY_USER, ROAST_PANE_SITE } from './roastNames'
import { drawRoastPane } from './roastScreens'

/** Registers /roast, which opens a pane with a roast about the main conversation to send to it. */
export function registerRoast(on: On): void {
  on('session.start', { isInteractive: true }, registerRoastCommand)
  on('command.run', { command: ROAST_COMMAND }, runRoastCommand).catch(replyWithRoastHookFailure)
  on('ui.render', ROAST_PANE_SITE, drawRoastPane)
  on('ui.close', ROAST_PANE_CLOSED_BY_USER, dropRoastOnClose)
}
