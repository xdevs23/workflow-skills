import type { Goal } from '../../types'

// The keys of the pickers, buttons and fields of the Goals pane, which presses and moves of the
// focus name.

/**
 * The elements drawn in the row of a goal and under it, each under a key of its own made of its
 * name and the number of the goal.
 */
export enum RowElement {
  Priority = 'priority',
  Dependency = 'dependency',
  Unmark = 'unmark',
  UnmarkReason = 'unmark-reason',
  YesClear = 'confirm-clear',
  Keep = 'keep',
  Edit = 'edit',
  Clear = 'clear',
  DoneEditing = 'done-edit',
  CancelEditing = 'cancel-edit',
  CancelUnmarking = 'cancel-unmark',
}

export function rowElementKeyOf(goal: Goal, element: RowElement): string {
  return `${element}-${goal.number}`
}

/** The key of the field for `goal` drawn under `fieldId`, new each time the field is drawn anew. */
export function editFieldKeyOf(goal: Goal, fieldId: string): string {
  return `edit-goal-${goal.number}-${fieldId}`
}

/**
 * The key of the field that adds the goal numbered `number`, the next number of the board. A goal
 * added from anywhere changes the key, so the pane draws an empty field, while a failed add leaves
 * the typed text in the field.
 */
export function newGoalFieldKeyOf(number: number): string {
  return `new-goal-${number}`
}
