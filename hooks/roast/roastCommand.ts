import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { registerCommandShowingRejection } from '../commandRegistration'
import { replyToFailedHook } from '../hookFailure'
import { isTypedByUser } from '../promptOrigin'
import { runDetached } from '../timedWork'
import { openRoastPane, startRoast, writeRoast } from './roastActions'
import { RoastNotWrittenCause } from './roastFailure'
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

export const registerRoastCommand: MatchedHook<'session.start', { isInteractive: true }> = async (
  $,
  e,
  next,
) => {
  await registerCommandShowingRejection(
    $,
    {
      name: ROAST_COMMAND,
      description: ROAST_DESCRIPTION,
      argumentHint: ROAST_ARGUMENT_HINT,
      immediate: true,
    },
    ROAST_LOST_WITHOUT_COMMAND,
  )

  return next(e)
}

/**
 * Opens the Roast pane, and has a fork made from the main conversation write the roast into it
 * without waiting for the fork. Text typed by the user after /roast goes to the fork as a
 * complaint, which the fork takes into the roast or refuses with a reason. Replies only while
 * Claude Code does not draw the pane.
 */
export const runRoastCommand: MatchedHook<
  'command.run',
  { command: typeof ROAST_COMMAND }
> = async ($, e) => {
  const finding = isTypedByUser(e.origin) ? e.args.trim() : ''
  const run = await startRoast($)
  const opened = await openRoastPane($)
  runDetached($, () => writeRoast($, run, finding), message =>
    describeRoastNotWritten({ cause: RoastNotWrittenCause.Thrown, message }),
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

export function replyWithRoastHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, ROAST_SUBJECT, next.error)
}
