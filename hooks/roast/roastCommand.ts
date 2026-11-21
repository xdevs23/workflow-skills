import type {
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { isTypedByUser } from '../promptOrigin'
import { runDetached } from '../timedWork'
import { openRoastPane, startRoast, writeRoast } from './roastActions'
import { thrownFailure } from './roastFailure'
import { ROAST_COMMAND, ROAST_PANE_CLOSED_BY_USER } from './roastNames'
import { dropRoast } from './roastState'
import {
  ROAST_ARGUMENT_HINT,
  ROAST_DESCRIPTION,
  ROAST_LOST_WITHOUT_COMMAND,
  ROAST_SUBJECT,
  describeRoastNotWritten,
  describeRoastPaneWaiting,
} from './roastTexts'

/** /roast, which has a fork write a roast of the main conversation into the Roast pane. */
export function roastCommand($: EngineInterface): PluginCommand {
  return {
    spec: {
      name: ROAST_COMMAND,
      description: ROAST_DESCRIPTION,
      argumentHint: ROAST_ARGUMENT_HINT,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: ROAST_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: true,
    run: e => runRoastCommand($, e),
    subjectOf: () => ROAST_SUBJECT,
  }
}

/**
 * Opens the Roast pane, and has a fork made from the main conversation write the roast into it
 * without waiting for the fork. Text typed by the user after /roast goes to the fork as a
 * complaint, which the fork takes into the roast or refuses with a reason. Replies only while
 * Claude Code does not draw the pane.
 */
async function runRoastCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const finding = isTypedByUser(e.origin) ? e.args.trim() : ''
  const run = await startRoast($)
  const opened = await openRoastPane($)
  runDetached($, () => writeRoast($, run, finding), message =>
    describeRoastNotWritten(thrownFailure(message)),
  )

  return opened.isPlaced ? {} : { text: describeRoastPaneWaiting(opened.reason) }
}

/** Removes the roast once the user closed the Roast pane, so a fork returning later stops. */
export const dropRoastOnClose: MatchedHook<'ui.close', typeof ROAST_PANE_CLOSED_BY_USER> = async (
  $,
  e,
  next,
) => {
  const closed = await next(e)
  if (closed.deny === undefined) {
    await dropRoast($)
  }

  return closed
}
