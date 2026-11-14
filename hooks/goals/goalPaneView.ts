import type { EngineInterface } from 'claude-code'

import type { Board, Goal } from '../../types'
import { readPaneNotice } from '../paneNotice'
import { Outcome, nextGoalNumberOf, openGoalsByIdOf, openGoalsByPriorityOf } from './board'
import { dependedGoalOf } from './dependency'
import type { OpenGoals } from './dependency'
import { doneMarkOf } from './doneMark'
import { GOALS_PANE } from './goalNames'
import { BoardShown } from './goalPaneMessages'
import type { GoalsPaneView, PaneGoal } from './goalPaneMessages'
import { readBoardInState } from './goalState'
import { priorityOf } from './priority'

/** The board of the session as the Goals pane draws it. */
export async function readGoalsPaneView($: EngineInterface): Promise<GoalsPaneView> {
  const [inState, notice] = await Promise.all([
    readBoardInState($),
    readPaneNotice($, GOALS_PANE),
  ])
  if (inState === null) {
    return { board: BoardShown.Loading }
  }
  if (inState.outcome === Outcome.Failed) {
    return { board: BoardShown.NotRead, failure: inState.failure }
  }

  return paneViewOf(inState.board, notice)
}

/** `board`, read from the store, as the Goals pane draws it, with `notice` under the goals. */
export function paneViewOf(board: Board, notice: string | undefined): GoalsPaneView {
  const open = openGoalsByIdOf(board)

  return {
    board: BoardShown.Read,
    goals: openGoalsByPriorityOf(board).map(goal => paneGoalOf(open, goal)),
    nextNumber: nextGoalNumberOf(board),
    ...(notice === undefined ? {} : { notice }),
  }
}

/** `goal` as the Goals pane draws it, among the open goals `open`. */
function paneGoalOf(open: OpenGoals, goal: Goal): PaneGoal {
  const doneMark = doneMarkOf(goal)

  return {
    number: goal.number,
    text: goal.text,
    todos: goal.todos,
    ...shownSettingsOf(open, goal),
    ...(doneMark === undefined ? {} : { doneMark }),
  }
}

/**
 * The priority of `goal` and the number of the open goal depended on by it, among the open goals
 * `open`, as a pane draws them.
 */
export function shownSettingsOf(
  open: OpenGoals,
  goal: Goal,
): Pick<PaneGoal, 'priority' | 'dependsOn'> {
  const priority = priorityOf(goal)
  const dependsOn = dependedGoalOf(open, goal)

  return {
    ...(priority === undefined ? {} : { priority }),
    ...(dependsOn === undefined ? {} : { dependsOn: dependsOn.number }),
  }
}
