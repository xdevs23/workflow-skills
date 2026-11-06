import type {
  ElementTable,
  EngineInterface,
  MatchedHook,
  RenderElement,
  ResolveInput,
  UiOpenResult,
} from 'claude-code'

import type { Board, DoneMark, Goal, RowInPane } from '../../types'
import { drawsInputFields } from '../surfaces'
import type { SurfaceWithInputFields } from '../surfaces'
import { Outcome, doneMarkOf, nextGoalNumberOf, openGoalsOf } from './board'
import { GOALS_PANE } from './goalNames'
import {
  addOnScreen,
  askToClear,
  clearOnScreen,
  editFieldKeyOf,
  editOnScreen,
  newGoalFieldKeyOf,
  saveOnce,
  startEditing,
  unmarkOnScreen,
} from './goalPresses'
import { RowMode, dropGoalInPane, readBoardInState, readGoalInPane } from './goalState'
import {
  ADD_LABEL,
  BLANK_TEXT_WARNING,
  BOARD_LOADING,
  CANCEL_LABEL,
  CLEAR_LABEL,
  COMMANDS_IN_PLACE_OF_FIELD,
  EDIT_LABEL,
  KEEP_LABEL,
  NEW_GOAL_PLACEHOLDER,
  PANE_TITLE,
  SAVE_LABEL,
  UNMARK_LABEL,
  YES_CLEAR_LABEL,
  describeClearQuestion,
  describeDoneMarkForPerson,
  describeNotRead,
} from './goalTexts'
import { describeEntry } from './todoEntry'

/** The elements every surface draws, which the rows of the goals use. */
type GoalElements = Pick<ElementTable, 'Box' | 'Button' | 'Text'>

/**
 * Draws the field that edits the text of `goal`. Only a surface with input fields has one, so the
 * goals offer Edit only there.
 */
type DrawEditField = (goal: Goal, isBlankTextRefused: boolean) => RenderElement

export function openGoalsPane($: EngineInterface): Promise<UiOpenResult> {
  return $.ui.open({ id: GOALS_PANE, title: PANE_TITLE, focus: true })
}

export const drawGoalsPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof GOALS_PANE }
> = async ($, e) => {
  const [inState, goalInPane] = await Promise.all([readBoardInState($), readGoalInPane($)])
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  if (inState === null) {
    return <Text dimColor>{BOARD_LOADING}</Text>
  }
  if (inState.outcome === Outcome.Failed) {
    return <Text color="warning">{describeNotRead(inState.failure)}</Text>
  }
  const { sessionId, board } = inState
  const drawEditField: DrawEditField | undefined = drawsInputFields(e)
    ? (goal, isBlankTextRefused) => drawGoalTextField($, e, sessionId, goal, isBlankTextRefused)
    : undefined

  return (
    <Box flexDirection="column">
      {openGoalsOf(board).map(goal => {
        const row = goal.id === goalInPane?.goalId ? goalInPane : undefined

        return drawGoal($, elements, sessionId, goal, drawnRowOf(goal, row, drawEditField))
      })}
      {drawsInputFields(e) ? (
        drawNewGoalField($, e, sessionId, board)
      ) : (
        <Text color="suggestion">{COMMANDS_IN_PLACE_OF_FIELD}</Text>
      )}
    </Box>
  )
}

/**
 * How the row of a goal is drawn: with its buttons, waiting for a yes to clear it, or with its
 * text in a field.
 */
type DrawnRow =
  | { mode: undefined; drawEditField: DrawEditField | undefined }
  | { mode: RowMode.WaitingForYes }
  | { mode: RowMode.Editing; field: RenderElement; isBlankTextRefused: boolean }

/**
 * How the row of `goal` is drawn, for `row`, the goal pressed in the pane when it is this goal. A
 * surface without input fields draws a goal edited on another surface with its buttons.
 */
function drawnRowOf(
  goal: Goal,
  row: RowInPane | undefined,
  drawEditField: DrawEditField | undefined,
): DrawnRow {
  switch (row?.mode) {
    case RowMode.WaitingForYes:
      return { mode: RowMode.WaitingForYes }
    case RowMode.Editing:
      return drawEditField === undefined
        ? { mode: undefined, drawEditField }
        : {
            mode: RowMode.Editing,
            field: drawEditField(goal, row.isBlankTextRefused),
            isBlankTextRefused: row.isBlankTextRefused,
          }
    case undefined:
      return { mode: undefined, drawEditField }
  }
}

/**
 * The row of one open goal: its number, its text or the field that edits it, its done mark, the
 * question to clear it, its TODO entries and the buttons of its mode.
 */
function drawGoal(
  $: EngineInterface,
  elements: GoalElements,
  sessionId: string,
  goal: Goal,
  row: DrawnRow,
) {
  const { Box, Text } = elements
  const mark = doneMarkOf(goal)

  return (
    <Box
      key={`goal-${goal.number}`}
      borderStyle="round"
      borderColor={borderColorOf(row, mark)}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${goal.number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {row.mode === RowMode.Editing ? row.field : <Text bold>{goal.text}</Text>}
        {row.mode === RowMode.Editing && row.isBlankTextRefused && (
          <Text color="warning">{BLANK_TEXT_WARNING}</Text>
        )}
        {mark !== undefined && drawDoneMark($, elements, sessionId, goal, mark, row)}
        {row.mode === RowMode.WaitingForYes && drawClearQuestion($, elements, sessionId, goal)}
        {goal.todos.map(todo => (
          <Text dimColor>{describeEntry(todo)}</Text>
        ))}
      </Box>
      {drawRowButtons($, elements, sessionId, goal, row)}
    </Box>
  )
}

/** The border of a row: by its mode, and for a row not pressed, by its done mark. */
function borderColorOf(row: DrawnRow, mark: DoneMark | undefined) {
  switch (row.mode) {
    case RowMode.WaitingForYes:
      return 'warning'
    case RowMode.Editing:
      return row.isBlankTextRefused ? 'warning' : 'suggestion'
    case undefined:
      return mark === undefined ? 'subtle' : 'success'
  }
}

/** The done mark of `goal` in the color of success, with Unmark on a row not pressed. */
function drawDoneMark(
  $: EngineInterface,
  { Box, Button, Text }: GoalElements,
  sessionId: string,
  goal: Goal,
  mark: DoneMark,
  row: DrawnRow,
) {
  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="success">{describeDoneMarkForPerson(mark)}</Text>
      {row.mode === undefined && (
        <Button
          key={`unmark-${goal.number}`}
          label={UNMARK_LABEL}
          dimColor
          onPress={() => saveOnce($, () => unmarkOnScreen($, sessionId, goal, mark))}
        />
      )}
    </Box>
  )
}

/** The question to clear `goal`, with its yes and its keep. */
function drawClearQuestion(
  $: EngineInterface,
  { Box, Button, Text }: GoalElements,
  sessionId: string,
  goal: Goal,
) {
  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="warning">{describeClearQuestion(goal)}</Text>
      <Button
        key={`confirm-clear-${goal.number}`}
        label={YES_CLEAR_LABEL}
        variant="primary"
        onPress={() => saveOnce($, () => clearOnScreen($, sessionId, goal))}
      />
      <Button
        key={`keep-${goal.number}`}
        label={KEEP_LABEL}
        onPress={() => dropGoalInPane($, goal.id, RowMode.WaitingForYes)}
      />
    </Box>
  )
}

/**
 * The buttons beside a row: Cancel while the goal is edited, none while it waits for a yes, and
 * otherwise Clear, with Edit before it where the surface draws input fields. In a narrow row, Clear
 * shows on the next line as a whole.
 */
function drawRowButtons(
  $: EngineInterface,
  elements: GoalElements,
  sessionId: string,
  goal: Goal,
  row: DrawnRow,
) {
  const { Box, Button } = elements
  switch (row.mode) {
    case RowMode.WaitingForYes:
      return null
    case RowMode.Editing:
      return drawWhole(
        elements,
        <Button
          key={`cancel-edit-${goal.number}`}
          label={CANCEL_LABEL}
          onPress={() => dropGoalInPane($, goal.id, RowMode.Editing)}
        />,
      )
    case undefined:
      return (
        <Box columnGap={1} flexWrap="wrap" justifyContent="flex-end">
          {row.drawEditField !== undefined &&
            drawWhole(
              elements,
              <Button
                key={`edit-${goal.number}`}
                label={EDIT_LABEL}
                dimColor
                onPress={() => startEditing($, sessionId, goal)}
              />,
            )}
          {drawWhole(
            elements,
            <Button
              key={`clear-${goal.number}`}
              label={CLEAR_LABEL}
              dimColor
              onPress={() => askToClear($, sessionId, goal)}
            />,
          )}
        </Box>
      )
  }
}

/** `button` in a box that never shrinks, so a narrow row does not break its label. */
function drawWhole({ Box }: GoalElements, button: RenderElement) {
  return <Box flexShrink={0}>{button}</Box>
}

/**
 * The field with the text of `goal`, which saves the text entered in it. After a blank text was
 * refused, the field is drawn empty under the warning.
 */
function drawGoalTextField(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithInputFields>,
  sessionId: string,
  goal: Goal,
  isBlankTextRefused: boolean,
) {
  const { Input } = $.ui.resolve(e)

  return (
    <Input
      key={editFieldKeyOf(goal)}
      value={isBlankTextRefused ? '' : goal.text}
      submitLabel={SAVE_LABEL}
      onSubmit={text => saveOnce($, () => editOnScreen($, sessionId, goal, text))}
    />
  )
}

function drawNewGoalField(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithInputFields>,
  sessionId: string,
  board: Board,
) {
  const { Input } = $.ui.resolve(e)
  const fieldNumber = nextGoalNumberOf(board)

  return (
    <Input
      key={newGoalFieldKeyOf(fieldNumber)}
      placeholder={NEW_GOAL_PLACEHOLDER}
      submitLabel={ADD_LABEL}
      autoFocus
      onSubmit={text => saveOnce($, () => addOnScreen($, sessionId, fieldNumber, text))}
    />
  )
}
