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
import { runDetached } from '../timedWork'
import { openRoastPane, startRoast, writeRoast } from './roastActions'
import { RoastNotWrittenCause } from './roastFailure'
import { ROAST_COMMAND, ROAST_PANE_CLOSED_BY_USER } from './roastNames'
import { dropRoast } from './roastState'
import {
  ROAST_DESCRIPTION,
  ROAST_SUBJECT,
  describeNotRegistered,
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
    { name: ROAST_COMMAND, description: ROAST_DESCRIPTION, immediate: true },
    describeNotRegistered,
  )

  return next(e)
}

/**
 * Opens the Roast pane, and has a fork made from the main conversation write the roast into it
 * without waiting for the fork. Replies only while Claude Code does not draw the pane.
 */
export const runRoastCommand: MatchedHook<
  'command.run',
  { command: typeof ROAST_COMMAND }
> = async $ => {
  const run = await startRoast($)
  const opened = await openRoastPane($)
  runDetached($, () => writeRoast($, run), message =>
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
