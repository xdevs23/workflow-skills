import type { DoneMark, GoalInPane } from '../../types'
import type { PaneControls, TypedTexts } from '../paneModule'
import { PaneElement, fieldKeyOf } from './goalKeys'
import { GoalPaneActionKind, GoalSaveOutcome } from './goalPaneMessages'
import type { GoalPaneAction, GoalSaveResult, PaneGoal } from './goalPaneMessages'

// What a press in the Goals pane changes, stored by its surface module, and what the result of a
// save changes. Only one goal at a time is pressed.

/** What the Goals pane does with a pressed goal. */
export enum RowMode {
  WaitingForYes = 'waiting-for-yes',
  Editing = 'editing',
  Unmarking = 'unmarking',
}

/** What the drawing of the Goals pane reads and acts on. */
export type GoalsPaneControls = PaneControls<GoalInPane | null, GoalPaneAction>

export type GoalInMode<Mode extends RowMode> = Extract<GoalInPane, { mode: Mode }>

type EditAction = Extract<GoalPaneAction, { kind: GoalPaneActionKind.Edit }>

export function isInMode<Mode extends RowMode>(
  row: GoalInPane | null,
  goal: number,
  mode: Mode,
): row is GoalInMode<Mode> {
  return row?.goal === goal && row.mode === mode
}

/** `row` with the mode `mode` of goal `goal` ended, while the goal is in that mode. */
export function endedRow(row: GoalInPane | null, goal: number, mode: RowMode): GoalInPane | null {
  return isInMode(row, goal, mode) ? null : row
}

/**
 * `row` once the save `action` ended as `result`. The press of a clear or of a removal of a mark
 * ends the question or the field. One not saved by the store draws them again, unless another goal
 * was pressed since.
 */
export function settleRow(
  row: GoalInPane | null,
  action: GoalPaneAction,
  result: GoalSaveResult,
): GoalInPane | null {
  switch (action.kind) {
    case GoalPaneActionKind.Clear:
      return result.outcome === GoalSaveOutcome.Failed
        ? (row ?? { goal: action.goal, mode: RowMode.WaitingForYes })
        : row
    case GoalPaneActionKind.Unmark:
      return result.outcome === GoalSaveOutcome.Failed
        ? (row ?? unmarkingRowOf(action.goal, action.shown))
        : row
    case GoalPaneActionKind.Edit:
      return isInMode(row, action.goal, RowMode.Editing) ? settledEdit(row, action, result) : row
    case GoalPaneActionKind.Add:
    case GoalPaneActionKind.Prioritize:
    case GoalPaneActionKind.Depend:
    case GoalPaneActionKind.Nudge:
      return row
  }
}

/**
 * The edited goal `row` once the save `edit` ended as `result`. A blank text draws the warning
 * under the field, and a text not saved by the store, or refused for a text saved elsewhere, draws
 * the field anew with the text entered. The edit then starts from the text saved elsewhere, so the
 * next save replaces it.
 */
function settledEdit(
  row: GoalInMode<RowMode.Editing>,
  edit: EditAction,
  result: GoalSaveResult,
): GoalInPane | null {
  switch (result.outcome) {
    case GoalSaveOutcome.Saved:
    case GoalSaveOutcome.Refused:
      return null
    case GoalSaveOutcome.BlankText:
      return { ...row, drawn: '', isBlankTextRefused: true }
    case GoalSaveOutcome.Failed:
      return fieldDrawnAnew(row, edit.text, edit.editedFrom)
    case GoalSaveOutcome.TextChangedElsewhere:
      return fieldDrawnAnew(row, edit.text, result.text)
  }
}

/**
 * The edited goal `row` with its field drawn anew under a new key with `text`, for an edit started
 * from `editedFrom`. The engine empties a field once its Enter was handled.
 */
function fieldDrawnAnew(
  row: GoalInMode<RowMode.Editing>,
  text: string,
  editedFrom: string,
): GoalInMode<RowMode.Editing> {
  const fieldId = crypto.randomUUID()

  return { ...row, fieldId, drawn: text, editedFrom, isBlankTextRefused: false }
}

/** Goal `goal` waiting for the reason to remove its done mark `shown`, in a field new to it. */
export function unmarkingRowOf(goal: number, shown: DoneMark): GoalInMode<RowMode.Unmarking> {
  return { goal, mode: RowMode.Unmarking, shown, fieldId: crypto.randomUUID() }
}

/** The key of the field that edits the goal of `row`. */
export function editFieldKeyOfRow({ goal, fieldId }: GoalInMode<RowMode.Editing>): string {
  return fieldKeyOf({ number: goal }, PaneElement.GoalText, fieldId)
}

/**
 * The edit that saves the text in the field of `row`: the text in `typed` under the key of the
 * field, or the text drawn into it where nothing was typed.
 */
export function editActionOf(row: GoalInMode<RowMode.Editing>, typed: TypedTexts): EditAction {
  const { goal, drawn, editedFrom } = row

  return {
    kind: GoalPaneActionKind.Edit,
    goal,
    text: typed[editFieldKeyOfRow(row)] ?? drawn,
    editedFrom,
  }
}

/** `goal` edited from its text, in a field new to the edit. */
export function editedRowOf({ number, text }: PaneGoal): GoalInMode<RowMode.Editing> {
  return {
    goal: number,
    mode: RowMode.Editing,
    fieldId: crypto.randomUUID(),
    drawn: text,
    editedFrom: text,
    isBlankTextRefused: false,
  }
}
