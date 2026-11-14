import type { DoneMark, GoalInPane } from '../../types'
import type { PaneButtonProps } from '../paneElements'
import { DONE_LABEL } from '../paneTexts'
import { PaneElement } from './goalKeys'
import type { ButtonElement } from './goalKeys'
import { GoalPaneActionKind } from './goalPaneMessages'
import type { PaneGoal } from './goalPaneMessages'
import {
  CANCEL_LABEL,
  CLEAR_LABEL,
  EDIT_LABEL,
  KEEP_LABEL,
  NUDGE_LABEL,
  UNMARK_LABEL,
  YES_CLEAR_LABEL,
} from './goalPaneTexts'
import {
  RowMode,
  editActionOf,
  editedRowOf,
  endedRow,
  isInMode,
  unmarkingRowOf,
} from './goalRowState'
import type { GoalsPaneControls } from './goalRowState'

export enum ButtonPlace {
  DoneMark = 'done-mark',
  ClearQuestion = 'clear-question',
  BesideRow = 'beside-row',
}

export type RowButton = {
  element: ButtonElement
  place: ButtonPlace
  props: Omit<PaneButtonProps, 'key'>
}

/**
 * The buttons of the row of `goal`, pressed as `row`, in the order they are drawn: in a row not
 * pressed, Unmark in its done mark, then Edit where the surface draws input fields, Clear, and
 * Nudge while it is not marked as done; the yes and the keep of the question to clear it; Done and
 * Cancel while it is edited; Cancel while it is unmarked.
 */
export function rowButtonsOf(
  pane: GoalsPaneControls,
  goal: PaneGoal,
  row: GoalInPane | null,
  drawsFields: boolean,
): RowButton[] {
  const { number, doneMark } = goal
  switch (row?.mode) {
    case RowMode.WaitingForYes:
      return [
        {
          element: PaneElement.YesClear,
          place: ButtonPlace.ClearQuestion,
          props: {
            label: YES_CLEAR_LABEL,
            variant: 'primary',
            onPress: () =>
              pane.act(local =>
                isInMode(local, number, RowMode.WaitingForYes)
                  ? { local: null, save: { kind: GoalPaneActionKind.Clear, goal: number } }
                  : {},
              ),
          },
        },
        {
          element: PaneElement.Keep,
          place: ButtonPlace.ClearQuestion,
          props: {
            label: KEEP_LABEL,
            autoFocus: true,
            onPress: () =>
              pane.act(local => ({ local: endedRow(local, number, RowMode.WaitingForYes) })),
          },
        },
      ]
    case RowMode.Editing:
      return [
        {
          element: PaneElement.DoneEditing,
          place: ButtonPlace.BesideRow,
          props: {
            label: DONE_LABEL,
            onPress: () =>
              pane.act((local, typed) =>
                isInMode(local, number, RowMode.Editing)
                  ? { save: editActionOf(local, typed) }
                  : {},
              ),
          },
        },
        cancelButtonOf(pane, number, RowMode.Editing, PaneElement.CancelEditing),
      ]
    case RowMode.Unmarking:
      return [cancelButtonOf(pane, number, RowMode.Unmarking, PaneElement.CancelUnmarking)]
    case undefined:
      return [
        ...(doneMark === undefined ? [] : [unmarkButtonOf(pane, number, doneMark, drawsFields)]),
        ...(drawsFields
          ? [
              rowButtonOf(PaneElement.Edit, EDIT_LABEL, () =>
                pane.act(() => ({ local: editedRowOf(goal) })),
              ),
            ]
          : []),
        rowButtonOf(PaneElement.Clear, CLEAR_LABEL, () =>
          pane.act(() => ({ local: { goal: number, mode: RowMode.WaitingForYes } })),
        ),
        ...(doneMark === undefined
          ? [
              rowButtonOf(PaneElement.Nudge, NUDGE_LABEL, () =>
                pane.act(() => ({ save: { kind: GoalPaneActionKind.Nudge, goal: number } })),
              ),
            ]
          : []),
      ]
  }
}

/** A dim button beside a row not pressed, drawn as `element` with `label`. */
function rowButtonOf(
  element: ButtonElement,
  label: string,
  onPress: PaneButtonProps['onPress'],
): RowButton {
  return { element, place: ButtonPlace.BesideRow, props: { label, dimColor: true, onPress } }
}

/**
 * Unmark in the done mark `shown` of goal `goal`, which draws the field for a reason where the
 * surface has input fields, and removes the mark at once elsewhere.
 */
function unmarkButtonOf(
  pane: GoalsPaneControls,
  goal: number,
  shown: DoneMark,
  drawsFields: boolean,
): RowButton {
  return {
    element: PaneElement.Unmark,
    place: ButtonPlace.DoneMark,
    props: {
      label: UNMARK_LABEL,
      dimColor: true,
      onPress: () =>
        pane.act(() =>
          drawsFields
            ? { local: unmarkingRowOf(goal, shown) }
            : { save: { kind: GoalPaneActionKind.Unmark, goal, shown } },
        ),
    },
  }
}

/** Cancel beside the row of goal `goal` in the mode `mode`, drawn as `element`, which ends it. */
function cancelButtonOf(
  pane: GoalsPaneControls,
  goal: number,
  mode: RowMode.Editing | RowMode.Unmarking,
  element: PaneElement.CancelEditing | PaneElement.CancelUnmarking,
): RowButton {
  return {
    element,
    place: ButtonPlace.BesideRow,
    props: {
      label: CANCEL_LABEL,
      onPress: () => pane.act(local => ({ local: endedRow(local, goal, mode) })),
    },
  }
}
