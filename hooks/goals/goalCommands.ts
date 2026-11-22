import type { CommandRunInput, CommandRunResult, EngineInterface, Frozen } from 'claude-code'

import { runGoalAutonomyCommand } from '../autonomy/autonomyCommand'
import { readGoalAutonomyForm } from '../autonomy/autonomyNames'
import type { GoalAutonomyForm } from '../autonomy/autonomyNames'
import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { isTypedByUser } from '../promptOrigin'
import { Outcome, openGoalNumbered } from './board'
import { addGoalToSession, readBoardOfSession } from './goalActions'
import { describeOpenGoals } from './goalListTexts'
import { ADD_BY_COMMAND, describeNotRead } from './goalPaneTexts'
import { GOALS_COMMAND } from './goalNames'
import { describeGoalsPaneFailures, openGoalsPaneOnFreshBoard } from './goalScreens'
import {
  GOALS_ADD_SUBJECT,
  GOALS_ARGUMENT_HINT,
  GOALS_DESCRIPTION,
  GOALS_LOST_WITHOUT_COMMAND,
  GOALS_SUBJECT,
  GOAL_NOT_TYPED_BY_USER,
  describeAddRefused,
  describeCommandGoalNotOpen,
  describeGoalAdded,
  describeNotAdded,
} from './goalTexts'

/** /goals, which adds a goal, or opens the Goals pane for /goals alone. */
export function goalsCommand($: EngineInterface): PluginCommand {
  return {
    spec: {
      name: GOALS_COMMAND,
      description: GOALS_DESCRIPTION,
      argumentHint: GOALS_ARGUMENT_HINT,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: GOALS_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: false,
    run: e => runGoalsCommand($, e),
    subjectOf: e => (addsGoal(goalTextOf(e)) ? GOALS_ADD_SUBJECT : GOALS_SUBJECT),
  }
}

async function runGoalsCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const text = goalTextOf(e)
  if (text === '') {
    return openFromCommand($)
  }
  const autonomyForm = readGoalAutonomyForm(text)
  if (autonomyForm !== undefined) {
    return runGoalAutonomyForm($, e, autonomyForm)
  }

  return isTypedByUser(e.origin) ? addFromCommand($, text) : { text: GOAL_NOT_TYPED_BY_USER }
}

function addsGoal(text: string): boolean {
  return text !== '' && readGoalAutonomyForm(text) === undefined
}

/** The text of the goal typed after /goals, empty for /goals alone. */
function goalTextOf(e: Frozen<CommandRunInput>): string {
  return e.args.trim()
}

async function runGoalAutonomyForm(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
  form: GoalAutonomyForm,
): Promise<CommandRunResult> {
  const loaded = await readBoardOfSession($, await $.session.id())
  if (loaded.outcome === Outcome.Failed) {
    return replyWithFailures($, [describeNotRead(loaded.failure)])
  }
  const goal = openGoalNumbered(loaded.board, form.goalNumber)

  return goal === undefined
    ? { text: describeCommandGoalNotOpen(form.goalNumber) }
    : runGoalAutonomyCommand($, { goal, word: form.word, origin: e.origin })
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
