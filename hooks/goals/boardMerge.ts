import type { Board, Goal, Setting } from '../../types'
import { isOpen } from './board'

/**
 * Returns the board with every goal added, edited, marked, prioritized, made dependent or cleared
 * in either of two copies of the board, which may have been read in any order. For a goal open in
 * `first`, the TODO entries come from `second`, the text of the later edit, the done mark changed
 * later, and the priority and the dependency set later. Goals are never removed and clears never
 * undone, so no copy undoes a change.
 */
export function combinedBoardOf(first: Board, second: Board): Board {
  const inSecond = new Map(second.goals.map(goal => [goal.id, goal]))
  const inFirst = new Set(first.goals.map(goal => goal.id))

  return {
    goals: [
      ...first.goals.map(goal =>
        isOpen(goal) ? withLaterChangesOf(inSecond.get(goal.id) ?? goal, goal) : goal,
      ),
      ...second.goals.filter(goal => !inFirst.has(goal.id)),
    ],
  }
}

/**
 * `goal` with the text, the done mark, the removal of a done mark, the priority and the dependency
 * of `other`, each where `other` changed it later.
 */
function withLaterChangesOf(goal: Goal, other: Goal): Goal {
  const withMark = withLaterRemovalOf(withLaterMarkOf(withLaterTextOf(goal, other), other), other)
  const { prioritySetting, dependencySetting } = other

  return {
    ...withMark,
    ...(isSetLater(prioritySetting, goal.prioritySetting) ? { prioritySetting } : {}),
    ...(isSetLater(dependencySetting, goal.dependencySetting) ? { dependencySetting } : {}),
  }
}

/** `goal` with the text of `other` when `other` was edited after `goal`. */
function withLaterTextOf(goal: Goal, other: Goal): Goal {
  const { text, editedAt } = other
  if (editedAt === undefined || editedAt <= (goal.editedAt ?? -Infinity)) {
    return goal
  }

  return { ...goal, text, editedAt }
}

/** `goal` with the done mark of `other` when `other` was marked after `goal`. */
function withLaterMarkOf(goal: Goal, other: Goal): Goal {
  const { doneMark } = other
  if (doneMark === undefined || doneMark.markedAt <= (goal.doneMark?.markedAt ?? -Infinity)) {
    return goal
  }

  return { ...goal, doneMark }
}

/** `goal` with the removal of a done mark of `other` when `other` removed a mark after `goal`. */
function withLaterRemovalOf(goal: Goal, other: Goal): Goal {
  const { markRemoval } = other
  const removedBefore = goal.markRemoval?.removedAt ?? -Infinity
  if (markRemoval === undefined || markRemoval.removedAt <= removedBefore) {
    return goal
  }

  return { ...goal, markRemoval }
}

/** Whether `setting` was set or removed after `than`. A setting is replaced as a whole. */
function isSetLater<Value>(
  setting: Setting<Value> | undefined,
  than: Setting<Value> | undefined,
): setting is Setting<Value> {
  return setting !== undefined && setting.setAt > (than?.setAt ?? -Infinity)
}
