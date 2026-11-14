import type { DoneMark, Goal } from '../../types'
import { GoalPaneActionKind } from './goalPaneMessages'

// The texts of the Goals pane, drawn by its surface module and by the hooks module.

export const PANE_TITLE = 'Goals'
export const NEW_GOAL_PLACEHOLDER = 'Add a goal'
export const ADD_LABEL = 'add'
export const EDIT_LABEL = 'Edit'
export const CANCEL_LABEL = 'Cancel'
export const BLANK_TEXT_WARNING = `A goal needs a text. Type one, or press ${CANCEL_LABEL}.`
export const UNMARK_LABEL = 'Unmark'
/** The word beside the field for the reason, for what Enter does there. */
export const UNMARK_SUBMIT_LABEL = 'unmark'
export const REASON_PLACEHOLDER = 'Reason (optional)'
export const NUDGE_LABEL = 'Nudge'
export const CLEAR_LABEL = 'Clear'
export const YES_CLEAR_LABEL = 'Yes, clear'
export const KEEP_LABEL = 'Keep'
export const PRIORITY_LABEL = 'Priority'
export const DEPENDENCY_LABEL = 'After'
/** What a picker shows for a goal without its setting, and the choice that removes the setting. */
export const NO_CHOICE_LABEL = '–'
export const BOARD_LOADING = 'Reading the goals of this session…'
/** The line in place of the field that adds a goal, on a surface without input fields. */
export const FIELDS_IN_TERMINAL_ONLY = `Add and edit goals in the ${PANE_TITLE} pane in a terminal.`

/**
 * The name of goal `number` in every text, such as "Goal 2". A hash sign before a number names an
 * entry of TODO.md.
 */
export function nameGoal(number: number): string {
  return `Goal ${number}`
}

/** What the Goals pane draws while the save of a press on the goal named `goal` runs. */
const SAVE_RUNNING_TEXTS: Record<GoalPaneActionKind, (goal: string) => string> = {
  [GoalPaneActionKind.Add]: goal => `Adding ${goal}…`,
  [GoalPaneActionKind.Clear]: goal => `Clearing ${goal}…`,
  [GoalPaneActionKind.Nudge]: goal => `Nudging ${goal}…`,
  [GoalPaneActionKind.Edit]: goal => `Saving ${goal}…`,
  [GoalPaneActionKind.Unmark]: goal => `Saving ${goal}…`,
  [GoalPaneActionKind.Prioritize]: goal => `Saving ${goal}…`,
  [GoalPaneActionKind.Depend]: goal => `Saving ${goal}…`,
}

/** What the Goals pane draws while the save `kind` of goal `number` runs. */
export function describeSaveRunning(kind: GoalPaneActionKind, number: number): string {
  return SAVE_RUNNING_TEXTS[kind](nameGoal(number))
}

export function describeClearQuestion(goal: Pick<Goal, 'number'>): string {
  return `Clear ${nameGoal(goal.number)}?`
}

/** The badge before the text of a goal depending on `dependsOn`, on a surface without pickers. */
export function describeDependencyBadge(dependsOn: Pick<Goal, 'number'>): string {
  return `after ${nameGoal(dependsOn.number)}`
}

/** The done mark of a goal as the person reads it, with the evidence given by Claude. */
export function describeDoneMarkForPerson(mark: DoneMark): string {
  return `Marked done by Claude: ${mark.evidence}`
}

/** The text for a board that could not be read, with the reason and the next step of the store. */
export function describeNotRead(storeFailure: string): string {
  return `The goals of this session could not be read. ${storeFailure}`
}
