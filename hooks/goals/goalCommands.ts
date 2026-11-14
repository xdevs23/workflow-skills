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
import { isTypedByUser } from '../promptOrigin'
import { Outcome } from './board'
import { addGoalToSession } from './goalActions'
import { describeOpenGoals } from './goalListTexts'
import { ADD_BY_COMMAND } from './goalPaneTexts'
import { GOALS_COMMAND } from './goalNames'
import { describeGoalsPaneFailures, openGoalsPaneOnFreshBoard } from './goalScreens'
import {
  GOALS_ADD_SUBJECT,
  GOALS_SUBJECT,
  GOAL_NOT_TYPED_BY_USER,
  describeAddRefused,
  describeGoalAdded,
  describeNotAdded,
} from './goalTexts'

/**
 * Adds the text after /goals as a goal when the user typed the command, and opens the Goals pane
 * for /goals alone.
 */
export const runGoalsCommand: MatchedHook<
  'command.run',
  { command: typeof GOALS_COMMAND }
> = async ($, e) => {
  const text = goalTextOf(e)
  if (text === '') {
    return openFromCommand($)
  }

  return isTypedByUser(e.origin) ? addFromCommand($, text) : { text: GOAL_NOT_TYPED_BY_USER }
}

/** Returns the reply to /goals when its hook failed, with the reason. */
export function replyWithGoalsHookFailure(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, goalTextOf(e) === '' ? GOALS_SUBJECT : GOALS_ADD_SUBJECT, next.error)
}

/** The text of the goal typed after /goals, empty for /goals alone. */
function goalTextOf(e: Frozen<CommandRunInput>): string {
  return e.args.trim()
}

/**
 * Adds `text` as a goal of the session. The board change is sent to Claude the same way as every
 * other change of the board.
 */
async function addFromCommand($: EngineInterface, text: string): Promise<CommandRunResult> {
  const added = await addGoalToSession($, await $.session.id(), text)
  switch (added.outcome) {
    case Outcome.Changed:
      return { text: describeGoalAdded(added.goal) }
    case Outcome.Refused:
      return { text: describeAddRefused(added) }
    case Outcome.Failed:
      return replyWithFailures($, [describeNotAdded(added)])
  }
}

/**
 * Reads the board of the session again and opens the Goals pane, which then shows it. Replies only
 * where the board could not be read or the pane could not open, and then lists the open goals and
 * the way to add one.
 */
async function openFromCommand($: EngineInterface): Promise<CommandRunResult> {
  const fresh = await openGoalsPaneOnFreshBoard($)
  const failures = describeGoalsPaneFailures(fresh, { command: GOALS_COMMAND })
  const { loaded, opened } = fresh
  if (loaded.outcome === Outcome.Failed || opened.isPlaced) {
    return replyWithFailures($, failures)
  }

  return { text: [...failures, ...describeOpenGoals(loaded.board), ADD_BY_COMMAND].join('\n') }
}
