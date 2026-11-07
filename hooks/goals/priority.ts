import type { Goal } from '../../types'

// A product choice: ten priorities, P0 to P9. A lower number is the more important priority.
export const PRIORITIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** The priority of a goal, set by the user: 0 for P0, the most important, up to 9 for P9. */
export type Priority = (typeof PRIORITIES)[number]

export function isPriority(value: unknown): value is Priority {
  return PRIORITIES.some(priority => priority === value)
}

/** The priority as the user and the model read it, such as "P1". */
export function describePriority(priority: Priority): string {
  return `P${priority}`
}

/** The priority of `goal`, while the user has set one and not removed it since. */
export function priorityOf(goal: Goal): Priority | undefined {
  return goal.prioritySetting?.value
}

/**
 * The goals by priority: P0 first and goals without a priority last, and by number among goals of
 * one priority.
 */
export function sortedByPriority(goals: readonly Goal[]): Goal[] {
  return [...goals].sort(compareByPriority)
}

function compareByPriority(first: Goal, second: Goal): number {
  const firstPriority = priorityOf(first)
  const secondPriority = priorityOf(second)
  if (firstPriority === secondPriority) {
    return first.number - second.number
  }
  if (firstPriority === undefined) {
    return 1
  }
  if (secondPriority === undefined) {
    return -1
  }

  return firstPriority - secondPriority
}
