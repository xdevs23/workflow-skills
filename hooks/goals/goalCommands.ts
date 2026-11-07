import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { replyToFailedHook } from '../hookFailure'
import { Outcome } from './board'
import { describeOpenGoals } from './goalListTexts'
import { GOALS_COMMAND } from './goalNames'
import { openGoalsPaneOnFreshBoard } from './goalScreens'
import { GOALS_SUBJECT, describeNotRead, describePaneNotOpened } from './goalTexts'

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
  const { loaded, opened } = await openGoalsPaneOnFreshBoard($)
  const notOpened = opened.isPlaced ? [] : [describePaneNotOpened(opened.reason)]
  if (loaded.outcome === Outcome.Failed) {
    const text = [...notOpened, describeNotRead(loaded.failure)].join('\n')
    $.ui.log(text, { to: 'debug' })

    return { text }
  }
  if (opened.isPlaced) {
    return {}
  }

  return { text: [...notOpened, ...describeOpenGoals(loaded.board)].join('\n') }
}
