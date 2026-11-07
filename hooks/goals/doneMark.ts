import type { DoneMark, Goal, MarkRemoval } from '../../types'

// Only the model marks a goal as done, and the goal is open with the mark until the user clears it.

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
  | { removedBy: MarkRemover.Model }
  | { removedBy: MarkRemover.User; reason?: string }
  | { removedBy: MarkRemover.Dependency; dependencyNumber: number }

/** A goal with a done mark, removed or not, as a mark leaves it. */
export type MarkedGoal = Goal & { doneMark: DoneMark }

/** A goal with the removal of a done mark, as a removal leaves it. */
export type UnmarkedGoal = Goal & { markRemoval: MarkRemoval }

/** `asked` with only the fields of its remover, its reason trimmed, and a blank reason left out. */
export function markRemovalAskedOf(asked: MarkRemovalAsked): MarkRemovalAsked {
  switch (asked.removedBy) {
    case MarkRemover.Model:
      return { removedBy: asked.removedBy }
    case MarkRemover.User: {
      const trimmed = asked.reason?.trim() ?? ''

      return trimmed === ''
        ? { removedBy: asked.removedBy }
        : { removedBy: asked.removedBy, reason: trimmed }
    }
    case MarkRemover.Dependency:
      return { removedBy: asked.removedBy, dependencyNumber: asked.dependencyNumber }
  }
}

/** The done mark of `goal` while it has one: set by the model and not removed since. */
export function doneMarkOf(goal: Goal): DoneMark | undefined {
  const mark = goal.doneMark

  return mark?.markedAt === goal.markRemoval?.markedAt ? undefined : mark
}

/** `goal` with its done mark `mark` removed as `removal` says. */
export function unmarkedGoalOf(
  goal: Goal,
  mark: DoneMark,
  removal: MarkRemovalAsked & { removedAt: number },
): UnmarkedGoal {
  const markRemoval = { ...markRemovalAskedOf(removal), removedAt: removal.removedAt }

  return { ...goal, markRemoval: { ...markRemoval, markedAt: mark.markedAt } }
}
