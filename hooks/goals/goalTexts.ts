import type { DoneMark, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { doneMarkOf } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { GOALS_COMMAND } from './goalNames'
import { describeEntry } from './todoEntry'

// The texts of the goals read by the person at the prompt.

export const PANE_TITLE = 'Goals'
/** The label of the button in the prompt footer that opens the Goals pane, named as the pane. */
export const GOALS_BUTTON_LABEL = PANE_TITLE
export const NEW_GOAL_PLACEHOLDER = 'Add a goal'
export const ADD_LABEL = 'add'
export const EDIT_LABEL = 'Edit'
export const SAVE_LABEL = 'save'
export const CANCEL_LABEL = 'Cancel'
export const BLANK_TEXT_WARNING = `A goal needs a text. Type one, or press ${CANCEL_LABEL}.`
export const UNMARK_LABEL = 'Unmark'
/** The word beside the field for the reason, for what Enter does there. */
export const UNMARK_SUBMIT_LABEL = 'unmark'
export const REASON_PLACEHOLDER = 'Reason (optional)'
export const CLEAR_LABEL = 'Clear'
export const YES_CLEAR_LABEL = 'Yes, clear'
export const KEEP_LABEL = 'Keep'
export const BOARD_LOADING = 'Reading the goals of this session…'
/** The line in place of the field that adds a goal, on a surface without input fields. */
export const FIELDS_IN_TERMINAL_ONLY = `Add and edit goals in the ${PANE_TITLE} pane in a terminal.`

export const GOALS_DESCRIPTION = `Open the goals of this session in the ${PANE_TITLE} pane`

/** The goals as written in the texts about a failed hook of /goals, which saves nothing. */
export const GOALS_SUBJECT: HookSubject = { name: 'goals' }

/**
 * The name of goal `number` in every text, such as "Goal 2". A hash sign before a number names an
 * entry of TODO.md.
 */
export function nameGoal(number: number): string {
  return `Goal ${number}`
}

export function describeClearQuestion(goal: Goal): string {
  return `Clear ${nameGoal(goal.number)}?`
}

export function describePaneNotOpened(reason: string): string {
  return `The Goals pane could not open: ${reason}.`
}

export function describeNotRegistered(reason: string): string {
  return (
    `/${GOALS_COMMAND} could not be registered, so the goals of this session cannot be opened ` +
    `or changed: ${reason}. The debug log has this too.`
  )
}

/** The goal as one line: its number, then its text. */
export function describeGoal(goal: Goal): string {
  return `${nameGoal(goal.number)}: ${goal.text}`
}

/** The open goals, each with its done mark and its TODO entries below it, one to a line. */
export function describeOpenGoals(open: readonly Goal[]): string[] {
  return open.flatMap(goal => {
    const mark = doneMarkOf(goal)

    return [
      describeGoal(goal),
      ...(mark === undefined ? [] : [`  ${describeDoneMarkForPerson(mark)}`]),
      ...goal.todos.map(todo => `  ${describeEntry(todo)}`),
    ]
  })
}

/** The done mark of a goal as the person reads it, with the evidence given by Claude. */
export function describeDoneMarkForPerson(mark: DoneMark): string {
  return `Marked done by Claude: ${mark.evidence}`
}

/** What a press in the Goals pane shows for a goal cleared since the pane drew it. */
export function describeNoLongerOpen(goal: Goal): string {
  return `${nameGoal(goal.number)} is no longer open.`
}

/** What a press of Unmark shows for a done mark removed or replaced since the pane drew it. */
export function describeMarkNoLongerShown(goal: Goal, shown: DoneMark): string {
  return `${nameGoal(goal.number)} is no longer marked done with ${shown.evidence}.`
}

export function describeNotAdded(failed: Failed): string {
  return `The goal was not added. ${describeStoreFailure(failed)}`
}

export function describeNotEdited(failed: Failed): string {
  return `The goal was not edited. ${describeStoreFailure(failed)}`
}

export function describeNotUnmarked(failed: Failed): string {
  return `The done mark was not removed. ${describeStoreFailure(failed)}`
}

export function describeNotCleared(failed: Failed): string {
  return `The goal was not cleared. ${describeStoreFailure(failed)}`
}

/** The fields of the Goals pane that a press moves the focus to. */
export enum PaneField {
  NewGoal = 'new-goal',
  GoalText = 'goal-text',
  UnmarkReason = 'unmark-reason',
}

/** A field of the Goals pane, with the goal it belongs to. */
export type FocusTarget =
  | { field: PaneField.NewGoal }
  | { field: PaneField.GoalText; goal: Goal }
  | { field: PaneField.UnmarkReason; goal: Goal }

/** The line in the debug log when the engine denies moving the focus to the field `target`. */
export function describeFocusNotMoved(denial: string, target: FocusTarget): string {
  return `The focus did not move to ${describeField(target)}: ${denial}`
}

function describeField(target: FocusTarget): string {
  switch (target.field) {
    case PaneField.NewGoal:
      return 'the field that adds a goal'
    case PaneField.GoalText:
      return `the field that edits ${nameGoal(target.goal.number)}`
    case PaneField.UnmarkReason:
      return `the field for the reason to unmark ${nameGoal(target.goal.number)}`
  }
}

/** The text for a board that could not be read, with the reason and the next step of the store. */
export function describeNotRead(storeFailure: string): string {
  return `The goals of this session could not be read. ${storeFailure}`
}
