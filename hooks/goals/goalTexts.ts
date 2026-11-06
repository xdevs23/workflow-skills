import type { DoneMark, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { NUMBER_ARGUMENT } from '../inputs'
import { Refusal, doneMarkOf } from './board'
import type { EditRefused, UnmarkRefused } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { ADD_WORD, CLEAR_WORD, EDIT_WORD, GOALS_COMMAND, UNMARK_WORD } from './goalNames'
import { describeEntry } from './todoEntry'

// The texts of the goals read by the person at the prompt, with the commands they contain.

const TEXT_ARGUMENT = '<text>'
const EXAMPLE_GOAL = 'Ship the tablet layout'

/** The forms of /goals that change a goal. */
export enum GoalsForm {
  Add = 'add',
  Edit = 'edit',
  Unmark = 'unmark',
  Clear = 'clear',
}

/** How the texts write a form of /goals: its word, its arguments and its verb. */
type FormText = {
  word: string
  arguments: string
  /** The verb as in "Only a command typed by the user adds a goal." */
  presentTense: string
  /** The verb as in "whether the goal was added". */
  pastParticiple: string
  /** The verb as in "Open the goals, add, edit or clear one". */
  imperative: string
  /** The start of the sentence that offers the form, as in "Add with /goals add <text>." */
  offer: string
}

/** The forms of /goals, listed by every text in the order of this table. */
const FORM_TEXTS: Record<GoalsForm, FormText> = {
  [GoalsForm.Add]: {
    word: ADD_WORD,
    arguments: TEXT_ARGUMENT,
    presentTense: 'adds',
    pastParticiple: 'added',
    imperative: 'add',
    offer: 'Add',
  },
  [GoalsForm.Edit]: {
    word: EDIT_WORD,
    arguments: `${NUMBER_ARGUMENT} ${TEXT_ARGUMENT}`,
    presentTense: 'edits',
    pastParticiple: 'edited',
    imperative: 'edit',
    offer: 'Edit',
  },
  [GoalsForm.Unmark]: {
    word: UNMARK_WORD,
    arguments: NUMBER_ARGUMENT,
    presentTense: 'unmarks',
    pastParticiple: 'unmarked',
    imperative: 'unmark',
    offer: 'Remove a done mark',
  },
  [GoalsForm.Clear]: {
    word: CLEAR_WORD,
    arguments: NUMBER_ARGUMENT,
    presentTense: 'clears',
    pastParticiple: 'cleared',
    imperative: 'clear',
    offer: 'Clear',
  },
}

const LISTED_FORMS = Object.values(FORM_TEXTS)

/** Joins the forms in a text, as in "adds, edits or clears", without a comma before the "or". */
const FORMS_IN_TEXT = new Intl.ListFormat('en-GB', { type: 'disjunction' })

/** The form of /goals whose word is `word`, or undefined for a word of no form. */
export function formOfWord(word: string): GoalsForm | undefined {
  return Object.values(GoalsForm).find(form => FORM_TEXTS[form].word === word)
}

function usageOf(form: FormText): string {
  return `/${GOALS_COMMAND} ${form.word} ${form.arguments}`
}

function listedForms(verbOf: (form: FormText) => string): string {
  return FORMS_IN_TEXT.format(LISTED_FORMS.map(verbOf))
}

const ADD_USAGE = usageOf(FORM_TEXTS[GoalsForm.Add])
const EDIT_USAGE = usageOf(FORM_TEXTS[GoalsForm.Edit])

export const GOALS_ARGUMENTS =
  `[${LISTED_FORMS.map(form => `${form.word} ${form.arguments}`).join(' | ')}]`
export const GOALS_DESCRIPTION =
  `Open the goals of this session, ${listedForms(form => form.imperative)} one`

export const ADD_USAGE_PROBLEM =
  `Write ${ADD_USAGE}, such as /${GOALS_COMMAND} ${ADD_WORD} ${EXAMPLE_GOAL}.`
export const EDIT_USAGE_PROBLEM =
  `Write ${EDIT_USAGE}, such as /${GOALS_COMMAND} ${EDIT_WORD} 2 ${EXAMPLE_GOAL}.`
export const GOALS_USAGE_PROBLEM =
  `Write ${FORMS_IN_TEXT.format([`/${GOALS_COMMAND}`, ...LISTED_FORMS.map(usageOf)])}, ` +
  `such as /${GOALS_COMMAND} ${CLEAR_WORD} 2.`
/** What the commands that change a goal return when the command was not typed by the user. */
export const CHANGE_NOT_TYPED =
  'The goals were not changed. Only a command typed by the user at the prompt ' +
  `${listedForms(form => form.presentTense)} a goal.`

/** The commands that replace the Goals pane where it cannot open. */
export const COMMANDS_IN_PLACE_OF_PANE = LISTED_FORMS.map(
  form => `${form.offer} with ${usageOf(form)}.`,
).join(' ')
/** The commands that replace the field of the Goals pane on a surface without input fields. */
export const COMMANDS_IN_PLACE_OF_FIELD =
  `Add with ${ADD_USAGE}. Edit with ${EDIT_USAGE}. List with /${GOALS_COMMAND}.`

export const PANE_TITLE = 'Goals'
/** The button in the prompt footer that opens the Goals pane, named as the pane. */
export const GOALS_BUTTON_LABEL = PANE_TITLE
export const NEW_GOAL_PLACEHOLDER = 'Add a goal'
export const ADD_LABEL = 'add'
export const EDIT_LABEL = 'Edit'
export const SAVE_LABEL = 'save'
export const CANCEL_LABEL = 'Cancel'
export const BLANK_TEXT_WARNING = `A goal needs a text. Type one, or press ${CANCEL_LABEL}.`
export const UNMARK_LABEL = 'Unmark'
export const CLEAR_LABEL = 'Clear'
export const YES_CLEAR_LABEL = 'Yes, clear'
export const KEEP_LABEL = 'Keep'
export const BOARD_LOADING = 'Reading the goals of this session…'

/** The goals as written in the texts about a failed hook of the goals. */
export const GOALS_SUBJECT: HookSubject = {
  name: 'goals',
  checkBeforeRetry:
    `Run /${GOALS_COMMAND} to see whether the goal was ` +
    `${listedForms(form => form.pastParticiple)}, before you try again.`,
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

/** The open goals, each with its done mark and its TODO entries below it, one to a line. */
export function describeOpenGoals(open: readonly Goal[]): string[] {
  return open.flatMap(goal => {
    const mark = doneMarkOf(goal)

    return [
      `#${goal.number} ${goal.text}`,
      ...(mark === undefined ? [] : [`  ${describeDoneMarkForPerson(mark)}`]),
      ...goal.todos.map(todo => `  ${describeEntry(todo)}`),
    ]
  })
}

/** The done mark of a goal as the person reads it, with the evidence given by Claude. */
export function describeDoneMarkForPerson(mark: DoneMark): string {
  return `Marked done by Claude: ${mark.evidence}`
}

export function describeAdded(goal: Goal): string {
  return `Added goal #${goal.number}.`
}

export function describeEdited(number: number): string {
  return `Edited goal #${number}.`
}

/** What /goals edit returns for the text already on the goal. */
export function describeTextUnchanged(number: number): string {
  return `Goal #${number} already has this text.`
}

/** What /goals edit returns for a refused edit, by the cause. */
export function describeEditRefused(refused: EditRefused): string {
  switch (refused.refusal) {
    case Refusal.BlankText:
      return EDIT_USAGE_PROBLEM
    case Refusal.GoalNotOpen:
      return describeNotOpen(refused.goal)
  }
}

/** What /goals unmark returns for a removed done mark. */
export function describeMarkRemovedForPerson(number: number): string {
  return `Removed the done mark from goal #${number}.`
}

/** What /goals unmark returns for a refused removal, by the cause. */
export function describeUnmarkRefused(refused: UnmarkRefused): string {
  switch (refused.refusal) {
    case Refusal.NotMarkedDone:
      return `Goal #${refused.goal} is not marked as done.`
    case Refusal.GoalNotOpen:
      return describeNotOpen(refused.goal)
  }
}

export function describeCleared(number: number): string {
  return `Cleared goal #${number}.`
}

/** What /goals edit, unmark and clear return for a number that is not an open goal. */
export function describeNotOpen(number: number): string {
  return `Goal #${number} is not open: it is cleared or was never added.`
}

/** What a press in the Goals pane shows for a goal cleared since the pane drew it. */
export function describeNoLongerOpen(goal: Goal): string {
  return `Goal #${goal.number} is no longer open.`
}

/** What a press of Unmark shows for a done mark removed or replaced since the pane drew it. */
export function describeMarkNoLongerShown(goal: Goal, shown: DoneMark): string {
  return `Goal #${goal.number} is no longer marked done with ${shown.evidence}.`
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

/**
 * The line in the debug log when the engine denies moving the focus to the field that edits the
 * goal `edited` or, without one, to the field that adds a goal.
 */
export function describeFocusNotMoved(reason: string, edited: Goal | undefined): string {
  const field =
    edited === undefined
      ? 'the field that adds a goal'
      : `the field that edits goal #${edited.number}`

  return `The focus did not move to ${field}: ${reason}`
}

/** The text for a board that could not be read, with the reason and the next step of the store. */
export function describeNotRead(storeFailure: string): string {
  return `The goals of this session could not be read. ${storeFailure}`
}
