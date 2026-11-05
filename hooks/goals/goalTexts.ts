import type { Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { NUMBER_ARGUMENT } from '../inputs'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { ADD_WORD, CLEAR_WORD, GOALS_COMMAND } from './goalNames'
import { describeEntry } from './todoEntry'

// The texts of the goals read by the person at the prompt, with the commands they contain.

const TEXT_ARGUMENT = '<text>'
const ADD_USAGE = `/${GOALS_COMMAND} ${ADD_WORD} ${TEXT_ARGUMENT}`
const CLEAR_USAGE = `/${GOALS_COMMAND} ${CLEAR_WORD} ${NUMBER_ARGUMENT}`
const EXAMPLE_GOAL = 'Ship the tablet layout'

export const GOALS_ARGUMENTS = `[${ADD_WORD} ${TEXT_ARGUMENT} | ${CLEAR_WORD} ${NUMBER_ARGUMENT}]`
export const GOALS_DESCRIPTION = 'Open the goals of this session, add one or clear one'

export const ADD_USAGE_PROBLEM =
  `Write ${ADD_USAGE}, such as /${GOALS_COMMAND} ${ADD_WORD} ${EXAMPLE_GOAL}.`
export const GOALS_USAGE_PROBLEM =
  `Write /${GOALS_COMMAND}, ${ADD_USAGE} or ${CLEAR_USAGE}, ` +
  `such as /${GOALS_COMMAND} ${CLEAR_WORD} 2.`
/** What /goals add and /goals clear reply to a command that the user did not type. */
export const CHANGE_NOT_TYPED =
  'The goals were not changed. Only a command typed by the user at the prompt adds or clears ' +
  'a goal.'

/** The commands that replace the Goals pane where it cannot open. */
export const COMMANDS_IN_PLACE_OF_PANE = `Add with ${ADD_USAGE}. Clear with ${CLEAR_USAGE}.`
/** The commands that replace the field of the Goals pane on a surface without input fields. */
export const COMMANDS_IN_PLACE_OF_FIELD = `Add with ${ADD_USAGE}. List with /${GOALS_COMMAND}.`

export const PANE_TITLE = 'Goals'
export const NEW_GOAL_PLACEHOLDER = 'Add a goal'
export const ADD_LABEL = 'add'
export const CLEAR_LABEL = 'Clear'
export const YES_CLEAR_LABEL = 'Yes, clear'
export const KEEP_LABEL = 'Keep'
export const BOARD_LOADING = 'Reading the goals of this session…'

/** The goals as written in the texts about a failed hook of the goals. */
export const GOALS_SUBJECT: HookSubject = {
  name: 'goals',
  checkBeforeRetry:
    `Run /${GOALS_COMMAND} to see whether the goal was added or cleared, before you try again.`,
}

export function describeClearQuestion(goal: Goal): string {
  return `Clear goal #${goal.number}?`
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

/** The open goals, each with its TODO entries below it, one to a line. */
export function describeOpenGoals(open: readonly Goal[]): string[] {
  return open.flatMap(goal => [
    `#${goal.number} ${goal.text}`,
    ...goal.todos.map(todo => `  ${describeEntry(todo)}`),
  ])
}

export function describeAdded(goal: Goal): string {
  return `Added goal #${goal.number}.`
}

export function describeCleared(number: number): string {
  return `Cleared goal #${number}.`
}

/** What /goals clear replies for a number that is not an open goal. */
export function describeNotOpen(number: number): string {
  return `Goal #${number} is not open: it is cleared or was never added.`
}

/** What a press in the Goals pane shows for a goal cleared since the pane drew it. */
export function describeNoLongerOpen(goal: Goal): string {
  return `Goal #${goal.number} is no longer open.`
}

export function describeNotAdded(failed: Failed): string {
  return `The goal was not added. ${describeStoreFailure(failed)}`
}

export function describeNotCleared(failed: Failed): string {
  return `The goal was not cleared. ${describeStoreFailure(failed)}`
}

/** The line in the debug log for a move of the focus to the field of the Goals pane denied. */
export function describeFocusNotMoved(reason: string): string {
  return `The focus did not move to the field that adds a goal: ${reason}`
}

/** The text for a board that could not be read, with the reason and the next step of the store. */
export function describeNotRead(storeFailure: string): string {
  return `The goals of this session could not be read. ${storeFailure}`
}
