import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { replyWithFailures } from '../failureToast'
import { replyToFailedHook } from '../hookFailure'
import { Outcome } from './board'
import { describeOpenGoals } from './goalListTexts'
import { GOALS_COMMAND } from './goalNames'
import { describeGoalsPaneFailures, openGoalsPaneOnFreshBoard } from './goalScreens'
import { GOALS_SUBJECT } from './goalTexts'

/** Opens the Goals pane for /goals, whatever arguments follow it. */
export const runGoalsCommand: MatchedHook<
  'command.run',
  { command: typeof GOALS_COMMAND }
> = async $ => openFromCommand($)

/** Returns the reply to /goals when its hook failed, with the reason. */
export function replyWithGoalsHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, GOALS_SUBJECT, next.error)
}

/**
 * Reads the board of the session again and opens the Goals pane, which then shows it. Replies only
 * where the board could not be read or the pane could not open, and then lists the open goals.
 */
async function openFromCommand($: EngineInterface): Promise<CommandRunResult> {
  const fresh = await openGoalsPaneOnFreshBoard($)
  const failures = describeGoalsPaneFailures(fresh, { command: GOALS_COMMAND })
  const { loaded, opened } = fresh
  if (loaded.outcome === Outcome.Failed || opened.isPlaced) {
    return replyWithFailures($, failures)
  }

  return { text: [...failures, ...describeOpenGoals(loaded.board)].join('\n') }
}
