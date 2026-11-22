import type { DoneMark, Goal, MarkRemoval } from '../../types'

// The model marks a goal as done, and the goal is open with the mark until the user clears it.

/** Who set a done mark. */
export enum MarkSetter {
  /** The goal checker of an earlier version, on a board stored by that version. */
  GoalChecker = 'goal-checker',
  Model = 'model',
}

/** Who removed a done mark. */
export enum MarkRemover {
  User = 'user',
  Model = 'model',
  /** Removed because its dependency was no longer done. */
  Dependency = 'dependency',
}

/**
 * What a caller supplies to remove a done mark: the remover, a reason only from the user, and on a
 * removal for a dependency, the number of the goal depended on.
 */
export type MarkRemovalAsked =
  | { removedBy: MarkRemover.User; reason?: string }
  | { removedBy: MarkRemover.Model }
  | { removedBy: MarkRemover.Dependency; dependencyNumber: number }

/** The remover of a stored removal. */
export type StoredMarkRemoval = MarkRemovalAsked

/** A goal with a done mark, removed or not, as a mark leaves it. */
export type MarkedGoal = Goal & { doneMark: DoneMark }

/** A goal with the removal of a done mark, as a removal leaves it. */
export type UnmarkedGoal = Goal & { markRemoval: MarkRemoval }

/**
 * `removal` with only the fields of its remover, its reason trimmed, and a blank reason left out.
 */
export function storedMarkRemovalOf(removal: StoredMarkRemoval): StoredMarkRemoval {
  switch (removal.removedBy) {
    case MarkRemover.Model:
      return { removedBy: removal.removedBy }
    case MarkRemover.User: {
      const trimmed = removal.reason?.trim() ?? ''

      return trimmed === ''
        ? { removedBy: removal.removedBy }
        : { removedBy: removal.removedBy, reason: trimmed }
    }
    case MarkRemover.Dependency:
      return { removedBy: removal.removedBy, dependencyNumber: removal.dependencyNumber }
  }
}

/** The setter named by `value`, a stored text, or undefined when it names none. */
export function readMarkSetter(value: unknown): MarkSetter | undefined {
  return Object.values(MarkSetter).find(setter => setter === value)
}

/** The done mark of `goal` while it has one: set and not removed since. */
export function doneMarkOf(goal: Goal): DoneMark | undefined {
  const mark = goal.doneMark

  return mark?.markedAt === goal.markRemoval?.markedAt ? undefined : mark
}

/** The done mark last removed from a goal by the user, with its removal. */
export type UserRemovedMark = {
  mark: DoneMark
  removal: Extract<MarkRemoval, { removedBy: MarkRemover.User }>
}

/**
 * The done mark last removed from `goal` by the user, while no mark was set on the goal since and
 * no edit followed the removal. A mark removed up to the last edit, also by the edit itself, was
 * set for an older text.
 */
export function userRemovedMarkOf(goal: Goal): UserRemovedMark | undefined {
  const mark = doneMarkOf(goal) === undefined ? goal.doneMark : undefined
  const removal = goal.markRemoval
  if (mark === undefined || removal?.removedBy !== MarkRemover.User) {
    return undefined
  }

  return goal.editedAt !== undefined && removal.removedAt <= goal.editedAt
    ? undefined
    : { mark, removal }
}

/** `goal` with its done mark `mark` removed as `removal` says. */
export function unmarkedGoalOf(
  goal: Goal,
  mark: DoneMark,
  removal: MarkRemovalAsked & { removedAt: number },
): UnmarkedGoal {
  const markRemoval = { ...storedMarkRemovalOf(removal), removedAt: removal.removedAt }

  return { ...goal, markRemoval: { ...markRemoval, markedAt: mark.markedAt } }
}
