import type { Goal } from '../../types'

// The elements of the Goals pane and the keys they are drawn under, which presses and focus moves
// use.

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
  /** The first button of a goal row, as the focus moves to it. */
  FirstButton = 'first-button',
}

/** The elements whose key is not made of their name and the number of their goal alone. */
const KEYED_APART = new Set([PaneElement.NewGoal, PaneElement.GoalText, PaneElement.FirstButton])

/** The elements of a goal row drawn under their name and the number of the goal. */
export type KeyedByGoal = Exclude<
  PaneElement,
  PaneElement.NewGoal | PaneElement.GoalText | PaneElement.FirstButton
>

export const ELEMENTS_KEYED_BY_GOAL = Object.values(PaneElement).filter(
  (element): element is KeyedByGoal => !KEYED_APART.has(element),
)

/** The buttons of a goal row. */
export type ButtonElement = Exclude<
  KeyedByGoal,
  PaneElement.Priority | PaneElement.Dependency | PaneElement.UnmarkReason
>

/**
 * The elements of a goal row the focus is followed from: the field that edits the goal, the field
 * for the reason to unmark it, and the first button of the row for every other element.
 */
export type FollowedElement =
  | PaneElement.GoalText
  | PaneElement.UnmarkReason
  | PaneElement.FirstButton

/** The elements of the Goals pane the plugin moves the focus to. */
export type FocusedElement = PaneElement.NewGoal | FollowedElement

export function rowElementKeyOf(goal: Goal, element: KeyedByGoal): string {
  return `${element}-${goal.number}`
}

/** The key of the field for `goal` drawn under `fieldId`, new each time the field is drawn anew. */
export function editFieldKeyOf(goal: Goal, fieldId: string): string {
  return `${PaneElement.GoalText}-${goal.number}-${fieldId}`
}

/**
 * The key of the field that adds the goal numbered `number`, the next number of the board. A goal
 * added from anywhere changes the key, so the pane draws an empty field, while a failed add leaves
 * the typed text in the field.
 */
export function newGoalFieldKeyOf(number: number): string {
  return `${PaneElement.NewGoal}-${number}`
}

/** The key of the element of the row of `goal` that the focus moves to under the key id `keyId`. */
export function movedElementKeyOf(goal: Goal, keyId: string): string {
  return `focus-${goal.number}-${keyId}`
}
