import type { RenderElement } from 'claude-code'

import type { DoneMark, GoalInPane } from '../../types'
import { drawCardWithFields } from '../cardFields'
import type { FieldUnderCard } from '../cardFields'
import { paneModuleOf } from '../paneModule'
import type { PaneElements } from '../paneElements'
import type { PaneMachine, PaneSurface } from '../paneModule'
import { DONE_LABEL } from '../paneTexts'
import { PaneElement, fieldKeyOf, newGoalFieldKeyOf, rowElementKeyOf } from './goalKeys'
import { BoardShown, GoalPaneActionKind } from './goalPaneMessages'
import type {
  GoalPaneAction,
  GoalSaveResult,
  GoalsPaneView,
  PaneGoal,
} from './goalPaneMessages'
import {
  ADD_LABEL,
  BLANK_TEXT_WARNING,
  BOARD_LOADING,
  FIELDS_IN_TERMINAL_ONLY,
  NEW_GOAL_PLACEHOLDER,
  REASON_PLACEHOLDER,
  UNMARK_SUBMIT_LABEL,
  describeClearQuestion,
  describeDependencyBadge,
  describeDoneMarkForPerson,
  describeNotRead,
  describeSaveRunning,
  nameGoal,
} from './goalPaneTexts'
import { drawGoalPickers, openGoalsOf } from './goalPickers'
import type { OpenGoals } from './goalPickers'
import { ButtonPlace, rowButtonsOf } from './goalRowButtons'
import type { RowButton } from './goalRowButtons'
import { RowMode, editActionOf, editFieldKeyOfRow, isInMode, settleRow } from './goalRowState'
import type { GoalInMode, GoalsPaneControls } from './goalRowState'
import { describePriority } from './priority'
import { describeEntry } from './todoEntry'

// The Goals pane, drawn on the drawing thread. A press, the typed text, the question to clear a
// goal and the field of a goal change the state of this module at once. Each save goes on the
// queue, and the row it changes is drawn dim with what runs, without its controls, until its
// result arrives. The other rows can still be pressed, and their saves go on the queue.

/** The saves on the queue that add goals, and the saves that change the goal of a row. */
type QueuedSaves = { adds: readonly GoalPaneAction[]; onRows: readonly GoalPaneAction[] }

function queuedSavesOf(saves: readonly GoalPaneAction[]): QueuedSaves {
  return {
    adds: saves.filter(save => save.kind === GoalPaneActionKind.Add),
    onRows: saves.filter(save => save.kind !== GoalPaneActionKind.Add),
  }
}

function drawGoalsPane(
  view: GoalsPaneView,
  pane: GoalsPaneControls,
  surface: PaneSurface,
): RenderElement {
  const { Box, Text } = surface.elements
  switch (view.board) {
    case BoardShown.Loading:
      return <Text dimColor>{BOARD_LOADING}</Text>
    case BoardShown.NotRead:
      return <Text color="warning">{describeNotRead(view.failure)}</Text>
    case BoardShown.Read: {
      const { adds, onRows } = queuedSavesOf(pane.saves)
      const open = openGoalsOf(view.goals)

      return (
        <Box flexDirection="column">
          {view.goals.map(goal =>
            drawGoal(surface, goalRowOf(pane, goal, onRows, surface.drawsFields), open),
          )}
          {surface.drawsFields ? (
            drawNewGoalField(surface.elements, pane, view.nextNumber, adds)
          ) : (
            <Text dimColor>{FIELDS_IN_TERMINAL_ONLY}</Text>
          )}
        </Box>
      )
    }
  }
}

/**
 * The goal of `row`, the goal pressed in the pane, when `goal` is that goal and is drawn in the
 * mode of `row`. A surface without input fields does not draw a field. A goal whose done mark was
 * removed or replaced since Unmark was pressed is drawn with its buttons.
 */
function drawnRowOf(
  goal: PaneGoal,
  row: GoalInPane | null,
  drawsFields: boolean,
): GoalInPane | null {
  if (row?.goal !== goal.number) {
    return null
  }
  switch (row.mode) {
    case RowMode.WaitingForYes:
      return row
    case RowMode.Editing:
      return drawsFields ? row : null
    case RowMode.Unmarking:
      return drawsFields && goal.doneMark?.markedAt === row.shown.markedAt ? row : null
  }
}

/**
 * A goal row as drawn: its goal, its pressed mode, its buttons, and the saves on its goal on the
 * queue. A row with saves on the queue is drawn without its controls.
 */
type GoalRow = {
  goal: PaneGoal
  drawn: GoalInPane | null
  pane: GoalsPaneControls
  buttons: readonly RowButton[]
  saving: readonly GoalPaneAction[]
}

function goalRowOf(
  pane: GoalsPaneControls,
  goal: PaneGoal,
  onRows: readonly GoalPaneAction[],
  drawsFields: boolean,
): GoalRow {
  const saving = onRows.filter(save => save.goal === goal.number)
  const drawn = saving.length === 0 ? drawnRowOf(goal, pane.local, drawsFields) : null

  return {
    goal,
    drawn,
    pane,
    buttons: saving.length === 0 ? rowButtonsOf(pane, goal, drawn, drawsFields) : [],
    saving,
  }
}

function buttonsAt({ Button }: PaneElements, { goal, buttons }: GoalRow, place: ButtonPlace) {
  return buttons
    .filter(button => button.place === place)
    .map(button => <Button key={rowElementKeyOf(goal, button.element)} {...button.props} />)
}

/**
 * The badges before the text of `goal` where its pickers are not drawn: its priority, and the goal
 * depended on by it.
 */
function badgesOf({ priority, dependsOn }: PaneGoal): string[] {
  return [
    ...(priority === undefined ? [] : [describePriority(priority)]),
    ...(dependsOn === undefined ? [] : [describeDependencyBadge({ number: dependsOn })]),
  ]
}

/**
 * Draws the row of one of the open goals `open`: its number, its text with its badges, its
 * pickers, its done mark, the question to clear it, its TODO entries and the buttons of the mode
 * the row is in, and under the row the field that edits its text, in place of the text, with the
 * warning on a blank text after it, or the field for the reason to unmark it. A row with saves on
 * the queue is drawn dim with what runs, with its badges in place of its pickers.
 */
function drawGoal(surface: PaneSurface, row: GoalRow, open: OpenGoals) {
  const { Box, Text } = surface.elements
  const { goal, drawn, saving } = row
  const isPressable = saving.length === 0
  const hasPickers = surface.drawsFields && isPressable

  const card = (
    <Box
      key={`goal-${goal.number}`}
      borderStyle="round"
      borderColor={isPressable ? borderColorOf(drawn, goal.doneMark) : 'subtle'}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${goal.number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {drawn?.mode !== RowMode.Editing &&
          drawGoalText(surface.elements, goal, hasPickers ? [] : badgesOf(goal), !isPressable)}
        {hasPickers && drawGoalPickers(surface.elements, row.pane, goal, open)}
        {goal.doneMark !== undefined &&
          drawDoneMark(
            surface.elements,
            goal.doneMark,
            buttonsAt(surface.elements, row, ButtonPlace.DoneMark),
          )}
        {drawn?.mode === RowMode.WaitingForYes &&
          drawClearQuestion(
            surface.elements,
            goal,
            buttonsAt(surface.elements, row, ButtonPlace.ClearQuestion),
          )}
        {saving.map(save => (
          <Text dimColor>{describeSaveRunning(save.kind, save.goal)}</Text>
        ))}
        {goal.todos.map(todo => (
          <Text dimColor>{describeEntry(todo)}</Text>
        ))}
      </Box>
      {drawButtonRow(surface.elements, buttonsAt(surface.elements, row, ButtonPlace.BesideRow))}
    </Box>
  )

  return drawUnderRow(surface.elements, card, row.pane, drawn)
}

/** `card`, the box of a goal, with the fields drawn under it in the mode of `row`. */
function drawUnderRow(
  elements: PaneElements,
  card: RenderElement,
  pane: GoalsPaneControls,
  row: GoalInPane | null,
): RenderElement {
  switch (row?.mode) {
    case RowMode.Editing:
      return drawCardWithFields(elements, card, [
        {
          fields: [goalTextFieldOf(pane, row)],
          warning: row.isBlankTextRefused ? BLANK_TEXT_WARNING : undefined,
        },
      ])
    case RowMode.Unmarking:
      return drawCardWithFields(elements, card, [
        { fields: [reasonFieldOf(pane, row)], warning: undefined },
      ])
    case RowMode.WaitingForYes:
    case undefined:
      return card
  }
}

/** The text of `goal`, after `badges`, each drawn inverse and set apart by a space. */
function drawGoalText(
  { Text }: PaneElements,
  goal: PaneGoal,
  badges: readonly string[],
  isDim: boolean,
) {
  if (badges.length === 0) {
    return (
      <Text bold dimColor={isDim}>
        {goal.text}
      </Text>
    )
  }

  return (
    <Text bold dimColor={isDim}>
      {badges.flatMap((badge, index) => [
        ...(index === 0 ? [] : [' ']),
        <Text inverse>{` ${badge} `}</Text>,
      ])}
      {` ${goal.text}`}
    </Text>
  )
}

/** The border of a row: by its mode, and for a row not pressed, by its done mark. */
function borderColorOf(row: GoalInPane | null, mark: DoneMark | undefined) {
  switch (row?.mode) {
    case RowMode.WaitingForYes:
      return 'warning'
    case RowMode.Editing:
      return row.isBlankTextRefused ? 'warning' : 'suggestion'
    case RowMode.Unmarking:
      return 'suggestion'
    case undefined:
      return mark === undefined ? 'subtle' : 'success'
  }
}

/** The done mark `mark` in the color of success, with `buttons`: Unmark on a row not pressed. */
function drawDoneMark(
  { Box, Text }: PaneElements,
  mark: DoneMark,
  buttons: readonly RenderElement[],
) {
  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="success">{describeDoneMarkForPerson(mark)}</Text>
      {buttons}
    </Box>
  )
}

/** The question to clear `goal`, with `buttons`: its yes and its keep. */
function drawClearQuestion(
  { Box, Text }: PaneElements,
  goal: PaneGoal,
  buttons: readonly RenderElement[],
) {
  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="warning">{describeClearQuestion(goal)}</Text>
      {buttons}
    </Box>
  )
}

/**
 * `buttons` side by side at the end of a row, each in a box that never shrinks, so a narrow row
 * does not break its label. Nothing where `buttons` is empty.
 */
function drawButtonRow({ Box }: PaneElements, buttons: readonly RenderElement[]) {
  if (buttons.length === 0) {
    return null
  }

  return (
    <Box columnGap={1} flexWrap="wrap" justifyContent="flex-end">
      {buttons.map(button => (
        <Box flexShrink={0}>{button}</Box>
      ))}
    </Box>
  )
}

/**
 * The field that edits the goal of `row`, drawn as `row` sets it. Done saves the text typed into
 * it, and Enter saves the text submitted from it.
 */
function goalTextFieldOf(
  pane: GoalsPaneControls,
  row: GoalInMode<RowMode.Editing>,
): FieldUnderCard {
  const { goal, drawn } = row
  const key = editFieldKeyOfRow(row)

  return {
    key,
    label: nameGoal(goal),
    value: drawn,
    submitLabel: DONE_LABEL.toLowerCase(),
    autoFocus: true,
    onInput: typed => pane.type(key, typed),
    onSubmit: text =>
      pane.act(local =>
        isInMode(local, goal, RowMode.Editing)
          ? { save: editActionOf(local, { [key]: text }) }
          : {},
      ),
  }
}

/**
 * The field for the reason to remove the done mark shown in `row`, which removes the mark with the
 * reason entered in it.
 */
function reasonFieldOf(
  pane: GoalsPaneControls,
  row: GoalInMode<RowMode.Unmarking>,
): FieldUnderCard {
  const { goal, shown, fieldId } = row

  return {
    key: fieldKeyOf({ number: goal }, PaneElement.UnmarkReason, fieldId),
    label: nameGoal(goal),
    placeholder: REASON_PLACEHOLDER,
    submitLabel: UNMARK_SUBMIT_LABEL,
    autoFocus: true,
    onSubmit: reason =>
      pane.act(local =>
        isInMode(local, goal, RowMode.Unmarking)
          ? { local: null, save: { kind: GoalPaneActionKind.Unmark, goal, shown, reason } }
          : {},
      ),
  }
}

/**
 * The field that adds the next goal, with what runs under it for each goal added there that is not
 * saved yet. Each of those goals gets the next number, so the field adds the goal numbered after
 * them.
 */
function drawNewGoalField(
  { Box, TextInput, Text }: PaneElements,
  pane: GoalsPaneControls,
  nextNumber: number,
  adds: readonly GoalPaneAction[],
) {
  const number = nextNumber + adds.length

  return (
    <Box flexDirection="column">
      <TextInput
        key={newGoalFieldKeyOf(number)}
        placeholder={NEW_GOAL_PLACEHOLDER}
        submitLabel={ADD_LABEL}
        autoFocus
        onSubmit={text =>
          pane.act(() => ({ save: { kind: GoalPaneActionKind.Add, goal: number, text } }))
        }
      />
      {adds.map(add => (
        <Text dimColor>{describeSaveRunning(add.kind, add.goal)}</Text>
      ))}
    </Box>
  )
}

export const GOALS_PANE_MACHINE: PaneMachine<
  GoalsPaneView,
  GoalInPane | null,
  GoalPaneAction,
  GoalSaveResult
> = { initial: null, settle: settleRow, draw: drawGoalsPane }

export default paneModuleOf(GOALS_PANE_MACHINE)
