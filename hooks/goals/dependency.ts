import type { Goal } from '../../types'
import { MarkRemover, doneMarkOf, unmarkedGoalOf } from './doneMark'
import type { UnmarkedGoal } from './doneMark'

// A goal depends on one other goal at most. A goal has a done mark only while its dependency is
// done: marked as done, or cleared.

/**
 * The open goals of a board by id, built by openGoalsByIdOf. A goal depended on is looked up among
 * them alone, so a dependency on a cleared goal reads as none: a cleared goal counts as done.
 */
export type OpenGoals = ReadonlyMap<string, Goal>

/** The open goal depended on by `goal`. */
export function dependedGoalOf(open: OpenGoals, goal: Goal): Goal | undefined {
  const id = goal.dependencySetting?.value

  return id === undefined ? undefined : open.get(id)
}

/** The open goal depended on by `goal`, while that goal is not marked as done. */
export function unfinishedDependencyOf(open: OpenGoals, goal: Goal): Goal | undefined {
  const depended = dependedGoalOf(open, goal)

  return depended !== undefined && doneMarkOf(depended) === undefined ? depended : undefined
}

/**
 * Whether a dependency of `goal` on `candidate` closes a loop among the open goals: whether
 * `candidate` is `goal`, or depends on it directly or through other open goals.
 */
export function closesLoop(open: OpenGoals, goal: Goal, candidate: Goal): boolean {
  const dependedOf = (id: string) => {
    const depending = open.get(id)

    return depending === undefined ? undefined : dependedGoalOf(open, depending)?.id
  }

  return closesLoopAmong(dependedOf, goal.id, candidate.id)
}

/**
 * Whether a dependency of the goal `goal` on the goal `candidate` closes a loop, where `dependedOf`
 * gives the goal that each goal depends on: whether `candidate` is `goal`, or depends on it
 * directly or through other goals.
 */
export function closesLoopAmong<Id>(
  dependedOf: (goal: Id) => Id | undefined,
  goal: Id,
  candidate: Id,
): boolean {
  // Two processes can store a loop that does not pass `goal`, so the walk stops at a goal it has
  // already visited.
  const visited = new Set<Id>()
  for (
    let current: Id | undefined = candidate;
    current !== undefined && !visited.has(current);
    current = dependedOf(current)
  ) {
    if (current === goal) {
      return true
    }
    visited.add(current)
  }

  return false
}

/** The open goals that `goal` can depend on: every one whose dependency closes no loop. */
export function dependencyChoicesOf(open: OpenGoals, goal: Goal): Goal[] {
  return [...open.values()].filter(candidate => !closesLoop(open, goal, candidate))
}

/**
 * The open goals whose done marks are removed at `removedAt` because their dependency is not done.
 * A removal can leave another goal waiting, so the removals go on down a chain of dependencies.
 */
export function goalsUnmarkedForDependency(open: OpenGoals, removedAt: number): UnmarkedGoal[] {
  const goals = new Map(open)
  const unmarked: UnmarkedGoal[] = []
  let found = waitingGoalsOf(goals, removedAt)
  while (found.length > 0) {
    found.forEach(goal => goals.set(goal.id, goal))
    unmarked.push(...found)
    found = waitingGoalsOf(goals, removedAt)
  }

  return unmarked
}

/** The goals among `open` marked as done while their dependency is not, with the marks removed. */
function waitingGoalsOf(open: OpenGoals, removedAt: number): UnmarkedGoal[] {
  return [...open.values()].flatMap(goal => {
    const mark = doneMarkOf(goal)
    const unfinished = unfinishedDependencyOf(open, goal)

    return mark === undefined || unfinished === undefined
      ? []
      : [
          unmarkedGoalOf(goal, mark, {
            removedBy: MarkRemover.Dependency,
            dependencyNumber: unfinished.number,
            removedAt,
          }),
        ]
  })
}
