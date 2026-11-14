import type { Goal } from '../../types'

// The elements of the Goals pane and the keys they are drawn under, which presses use.

/**
 * The pickers, buttons and fields of the Goals pane. Each key is made of the name of the element
 * and the number of its goal, the next number of the board for the field that adds a goal.
 */
export enum PaneElement {
  NewGoal = 'new-goal',
  GoalText = 'edit-goal',
  Priority = 'priority',
  Dependency = 'dependency',
  Unmark = 'unmark',
  UnmarkReason = 'unmark-reason',
  YesClear = 'confirm-clear',
  Keep = 'keep',
  Edit = 'edit',
  Nudge = 'nudge',
  Clear = 'clear',
  DoneEditing = 'done-edit',
  CancelEditing = 'cancel-edit',
  CancelUnmarking = 'cancel-unmark',
}

/** The elements of a goal row drawn under their name and the number of the goal. */
export type KeyedByGoal = Exclude<
  PaneElement,
  PaneElement.NewGoal | PaneElement.GoalText | PaneElement.UnmarkReason
>

/** The buttons of a goal row. */
export type ButtonElement = Exclude<KeyedByGoal, PaneElement.Priority | PaneElement.Dependency>

/** A goal, as the keys of its elements name it. */
type KeyedGoal = Pick<Goal, 'number'>

export function rowElementKeyOf(goal: KeyedGoal, element: KeyedByGoal): string {
  return `${element}-${goal.number}`
}

/**
 * The key of the field `field` for `goal` drawn under `fieldId`, new each time the field is drawn
 * anew.
 */
export function fieldKeyOf(
  goal: KeyedGoal,
  field: PaneElement.GoalText | PaneElement.UnmarkReason,
  fieldId: string,
): string {
  return `${field}-${goal.number}-${fieldId}`
}

/**
 * The key of the field that adds the goal numbered `number`, the next number of the board. A goal
 * added from anywhere changes the key, so the pane draws an empty field, while a failed add leaves
 * the typed text in the field.
 */
export function newGoalFieldKeyOf(number: number): string {
  return `${PaneElement.NewGoal}-${number}`
}
