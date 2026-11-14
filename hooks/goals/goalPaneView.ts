import type { EngineInterface } from 'claude-code'

import type { Board, Goal } from '../../types'
import { Outcome, nextGoalNumberOf, openGoalsByIdOf, openGoalsByPriorityOf } from './board'
import { dependedGoalOf } from './dependency'
import type { OpenGoals } from './dependency'
import { doneMarkOf } from './doneMark'
import { BoardShown } from './goalPaneMessages'
import type { GoalsPaneView, PaneGoal } from './goalPaneMessages'
import { readBoardInState } from './goalState'
import { priorityOf } from './priority'

/** The board of the session as the Goals pane draws it. */
export async function readGoalsPaneView($: EngineInterface): Promise<GoalsPaneView> {
  const inState = await readBoardInState($)
  if (inState === null) {
    return { board: BoardShown.Loading }
  }
  if (inState.outcome === Outcome.Failed) {
    return { board: BoardShown.NotRead, failure: inState.failure }
  }

  return paneViewOf(inState.board)
}

/** `board`, read from the store, as the Goals pane draws it. */
export function paneViewOf(board: Board): GoalsPaneView {
  const open = openGoalsByIdOf(board)

  return {
    board: BoardShown.Read,
    goals: openGoalsByPriorityOf(board).map(goal => paneGoalOf(open, goal)),
    nextNumber: nextGoalNumberOf(board),
  }
}

/** `goal` as the Goals pane draws it, among the open goals `open`. */
function paneGoalOf(open: OpenGoals, goal: Goal): PaneGoal {
  const priority = priorityOf(goal)
  const dependsOn = dependedGoalOf(open, goal)
  const doneMark = doneMarkOf(goal)

  return {
    number: goal.number,
    text: goal.text,
    todos: goal.todos,
    ...(priority === undefined ? {} : { priority }),
    ...(dependsOn === undefined ? {} : { dependsOn: dependsOn.number }),
    ...(doneMark === undefined ? {} : { doneMark }),
  }
}
