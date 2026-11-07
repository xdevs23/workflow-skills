import type { Board, Goal } from '../../types'
import { sortedByNumber } from '../numbered'
import { isOpen } from './board'

/** The kinds of change of a goal between two copies of a board. */
export enum ChangeKind {
  Added = 'added',
  Edited = 'edited',
  MarkSet = 'mark-set',
  MarkRemoved = 'mark-removed',
  PriorityChanged = 'priority-changed',
  DependencyChanged = 'dependency-changed',
  Cleared = 'cleared',
}

/** A change of `goal`, which is the goal as the later copy of the board has it. */
export type GoalChange = { goal: Goal; kind: ChangeKind }

/** Whether a goal changed from `earlier`, the goal in the earlier copy if there, to `goal`. */
type ChangeTest = (earlier: Goal | undefined, goal: Goal) => boolean

/** The kinds of change, in the order the changes of one goal are listed, each with its test. */
const CHANGE_TESTS: readonly (readonly [ChangeKind, ChangeTest])[] = [
  [ChangeKind.Added, earlier => earlier === undefined],
  [ChangeKind.Edited, (earlier, goal) => earlier !== undefined && earlier.text !== goal.text],
  [
    ChangeKind.MarkSet,
    (earlier, goal) =>
      goal.doneMark !== undefined && goal.doneMark.markedAt !== earlier?.doneMark?.markedAt,
  ],
  [
    ChangeKind.MarkRemoved,
    (earlier, goal) =>
      goal.markRemoval !== undefined &&
      goal.markRemoval.removedAt !== earlier?.markRemoval?.removedAt,
  ],
  [
    ChangeKind.PriorityChanged,
    (earlier, goal) => earlier?.prioritySetting?.value !== goal.prioritySetting?.value,
  ],
  [
    ChangeKind.DependencyChanged,
    (earlier, goal) => earlier?.dependencySetting?.value !== goal.dependencySetting?.value,
  ],
  [
    ChangeKind.Cleared,
    (earlier, goal) => !isOpen(goal) && (earlier === undefined || isOpen(earlier)),
  ],
]

/**
 * The changes of the goals from the copy `before` of a board to the later copy `after`, in the
 * order of the numbers of the goals. A goal is never removed from a board, so only the goals in
 * `after` are compared.
 */
export function changesBetween(before: Board, after: Board): GoalChange[] {
  const inBefore = new Map(before.goals.map(goal => [goal.id, goal]))

  return sortedByNumber(after.goals).flatMap(goal => {
    const earlier = inBefore.get(goal.id)

    return CHANGE_TESTS.flatMap(([kind, isChanged]) =>
      isChanged(earlier, goal) ? [{ goal, kind }] : [],
    )
  })
}

/**
 * `board` with each goal changed between the copies `before` and `after` set back to the goal in
 * `before`, or left out when `before` does not have it. Goals changed after `after` stay as `board`
 * has them.
 */
export function boardWithChangesTakenBack(board: Board, before: Board, after: Board): Board {
  const inBefore = new Map(before.goals.map(goal => [goal.id, goal]))
  const changed = new Set(changesBetween(before, after).map(({ goal }) => goal.id))

  return {
    goals: board.goals.flatMap(goal => {
      if (!changed.has(goal.id)) {
        return [goal]
      }
      const earlier = inBefore.get(goal.id)

      return earlier === undefined ? [] : [earlier]
    }),
  }
}
