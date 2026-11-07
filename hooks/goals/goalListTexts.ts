import type { Board, Goal } from '../../types'
import { openGoalsByIdOf, openGoalsByPriorityOf } from './board'
import { unfinishedDependencyOf } from './dependency'
import { doneMarkOf } from './doneMark'
import { describeDoneMarkForPerson, nameGoal } from './goalTexts'
import { describePriority, priorityOf } from './priority'
import { describeEntry } from './todoEntry'

// The priority and the dependency of a goal as every list of the goals writes them: the lists read
// by the model and the list shown by /goals.

/** The priority of `goal` in a list, such as "(P0)", if it has one. */
export function priorityTagOf(goal: Goal): string | undefined {
  const priority = priorityOf(goal)

  return priority === undefined ? undefined : `(${describePriority(priority)})`
}

/** The name of `goal` with its priority, if it has one, such as "Goal 2 (P0)". */
export function nameGoalWithPriority(goal: Goal): string {
  const tag = priorityTagOf(goal)
  const name = nameGoal(goal.number)

  return tag === undefined ? name : `${name} ${tag}`
}

/** An open goal as one line: its number and its priority, then its text. */
export function describeGoalWithPriority(goal: Goal): string {
  return `${nameGoalWithPriority(goal)}: ${goal.text}`
}

/** The sentence on the dependency `dependsOn` of a goal, while it is not marked as done. */
export function describeUnfinishedDependency(dependsOn: Goal): string {
  return `Depends on ${nameGoal(dependsOn.number)}, which is not marked as done yet.`
}

/**
 * The open goals of `board` by priority, each with its dependency while it is not done, its done
 * mark and its TODO entries below it, one to a line.
 */
export function describeOpenGoals(board: Board): string[] {
  const open = openGoalsByIdOf(board)

  return openGoalsByPriorityOf(board).flatMap(goal => {
    const unfinished = unfinishedDependencyOf(open, goal)
    const mark = doneMarkOf(goal)

    return [
      describeGoalWithPriority(goal),
      ...(unfinished === undefined ? [] : [`  ${describeUnfinishedDependency(unfinished)}`]),
      ...(mark === undefined ? [] : [`  ${describeDoneMarkForPerson(mark)}`]),
      ...goal.todos.map(todo => `  ${describeEntry(todo)}`),
    ]
  })
}
