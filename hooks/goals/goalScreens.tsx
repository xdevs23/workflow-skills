import type {
  ButtonProps,
  ElementTable,
  EngineInterface,
  MatchedHook,
  RenderElement,
  ResolveInput,
  UiOpenResult,
} from 'claude-code'

import type { Board, DoneMark, Goal, RowInPane, UnreadBoard } from '../../types'
import { drawCardWithFields } from '../cardFields'
import type { FieldUnderCard, FieldsWithWarning } from '../cardFields'
import { DONE_LABEL } from '../paneTexts'
import { drawsFields } from '../surfaces'
import type { SurfaceWithFields } from '../surfaces'
import { Outcome, nextGoalNumberOf, openGoalsByIdOf, openGoalsByPriorityOf } from './board'
import type { Read } from './board'
import { doneMarkOf } from './doneMark'
import { dependedGoalOf } from './dependency'
import type { OpenGoals } from './dependency'
import { loadBoardIntoState } from './goalActions'
import { GOALS_PANE } from './goalNames'
import { drawGoalPickers } from './goalPickers'
import {
  addOnScreen,
  askToClear,
  clearOnScreen,
  editFieldKeyOf,
  finishEditing,
  newGoalFieldKeyOf,
  reasonFieldKeyOf,
  saveOnce,
  startEditing,
  startUnmarking,
  submitEdit,
  unmarkOnScreen,
} from './goalPresses'
import {
  RowMode,
  dropGoalInPane,
  readBoardInState,
  readGoalInPane,
  recordTypedText,
} from './goalState'
import {
  ADD_LABEL,
  BLANK_TEXT_WARNING,
  BOARD_LOADING,
  CANCEL_LABEL,
  CLEAR_LABEL,
  EDIT_LABEL,
  FIELDS_IN_TERMINAL_ONLY,
  KEEP_LABEL,
  NEW_GOAL_PLACEHOLDER,
  PANE_TITLE,
  REASON_PLACEHOLDER,
  UNMARK_LABEL,
  UNMARK_SUBMIT_LABEL,
  YES_CLEAR_LABEL,
  describeClearQuestion,
  describeDependencyBadge,
  describeDoneMarkForPerson,
  describeNotRead,
  nameGoal,
} from './goalTexts'
import { describePriority, priorityOf } from './priority'
import { describeEntry } from './todoEntry'

/** The elements every surface draws, which the rows of the goals use. */
type GoalElements = Pick<ElementTable, 'Box' | 'Button' | 'Text'>

/**
 * The fields of a goal: the field that edits its text, the field for the reason to remove its done
 * mark `shown`, the pickers of its priority and its dependency, and the row of the goal drawn with
 * fields under it. Only a surface with fields has them, so the Goals pane draws Edit only there,
 * Unmark removes the mark at once elsewhere, and elsewhere the priority and the dependency show as
 * badges before the text.
 */
type GoalFields = {
  textFieldOf: (goal: Goal, field: EditedField) => FieldUnderCard
  reasonFieldOf: (goal: Goal, shown: DoneMark) => FieldUnderCard
  drawPickers: (goal: Goal) => RenderElement
  drawUnderRow: (row: RenderElement, under: readonly FieldsWithWarning[]) => RenderElement
}

/** The part of the key and the text of the field drawn for a goal being edited. */
type EditedField = Pick<Extract<RowInPane, { mode: RowMode.Editing }>, 'fieldId' | 'drawn'>

/** The priority and the dependency of a goal: in its pickers, or as badges before its text. */
type SettingsInRow = { pickers: RenderElement } | { badges: readonly string[] }

/** The board of the session read again from the store, and the Goals pane opened on it. */
type PaneOnFreshBoard = { loaded: Read | UnreadBoard; opened: UiOpenResult }

/**
 * Reads the board of the session again into the state, and opens the Goals pane, which shows it.
 */
export async function openGoalsPaneOnFreshBoard($: EngineInterface): Promise<PaneOnFreshBoard> {
  const loaded = await loadBoardIntoState($, await $.session.id())
  const opened = await $.ui.open({ id: GOALS_PANE, title: PANE_TITLE, focus: true })

  return { loaded, opened }
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
  const open = openGoalsByIdOf(board)
  const fields: GoalFields | undefined = drawsFields(e)
    ? {
        textFieldOf: (goal, field) => goalTextFieldOf($, sessionId, goal, field),
        reasonFieldOf: (goal, shown) => reasonFieldOf($, sessionId, goal, shown),
        drawPickers: goal => drawGoalPickers($, e, sessionId, open, goal),
        drawUnderRow: (row, under) => drawCardWithFields($.ui.resolve(e), row, under),
      }
    : undefined

  return (
    <Box flexDirection="column">
      {openGoalsByPriorityOf(board).map(goal => {
        const row = goal.id === goalInPane?.goalId ? goalInPane : undefined
        const settings: SettingsInRow =
          fields === undefined
            ? { badges: badgesOf(open, goal) }
            : { pickers: fields.drawPickers(goal) }

        return drawGoal($, elements, sessionId, goal, drawnRowOf(goal, row, fields), settings)
      })}
      {drawsFields(e) ? (
        drawNewGoalField($, e, sessionId, board)
      ) : (
        <Text dimColor>{FIELDS_IN_TERMINAL_ONLY}</Text>
      )}
    </Box>
  )
}

/**
 * How the row of a goal is drawn: with its buttons, with the question to clear it, with its text in
 * a field, or with a field for the reason to remove its done mark.
 */
type DrawnRow =
  | { mode: undefined; fields: GoalFields | undefined }
  | { mode: RowMode.WaitingForYes }
  | {
      mode: RowMode.Editing
      fields: GoalFields
      field: FieldUnderCard
      isBlankTextRefused: boolean
    }
  | { mode: RowMode.Unmarking; fields: GoalFields; field: FieldUnderCard }

/**
 * How the row of `goal` is drawn, for `row`, the goal pressed in the pane when it is this goal. A
 * surface without input fields draws a goal edited or unmarked on another surface with its buttons.
 * A goal whose done mark was removed or replaced since Unmark was pressed is drawn with its buttons.
 */
function drawnRowOf(
  goal: Goal,
  row: RowInPane | undefined,
  fields: GoalFields | undefined,
): DrawnRow {
  if (row?.mode === RowMode.WaitingForYes) {
    return { mode: RowMode.WaitingForYes }
  }
  if (fields === undefined || row === undefined) {
    return { mode: undefined, fields }
  }
  switch (row.mode) {
    case RowMode.Editing:
      return {
        mode: RowMode.Editing,
        fields,
        field: fields.textFieldOf(goal, row),
        isBlankTextRefused: row.isBlankTextRefused,
      }
    case RowMode.Unmarking:
      return doneMarkOf(goal)?.markedAt === row.shown.markedAt
        ? { mode: RowMode.Unmarking, fields, field: fields.reasonFieldOf(goal, row.shown) }
        : { mode: undefined, fields }
  }
}

/**
 * The badges before the text of `goal` on a surface without pickers: its priority, and the goal
 * among the open goals `open` depended on by it.
 */
function badgesOf(open: OpenGoals, goal: Goal): string[] {
  const priority = priorityOf(goal)
  const dependsOn = dependedGoalOf(open, goal)

  return [
    ...(priority === undefined ? [] : [describePriority(priority)]),
    ...(dependsOn === undefined ? [] : [describeDependencyBadge(dependsOn)]),
  ]
}

/**
 * Draws the row of one open goal: its number, its text with its badges, its pickers, its done mark,
 * the question to clear it, its TODO entries and the buttons of the mode the row is in, and under
 * the row the field that edits its text, in place of the text, with the warning on a blank text
 * after it, or the field for the reason to unmark it.
 */
function drawGoal(
  $: EngineInterface,
  elements: GoalElements,
  sessionId: string,
  goal: Goal,
  row: DrawnRow,
  settings: SettingsInRow,
) {
  const { Box, Text } = elements
  const mark = doneMarkOf(goal)

  const card = (
    <Box
      key={`goal-${goal.number}`}
      borderStyle="round"
      borderColor={borderColorOf(row, mark)}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${goal.number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {row.mode !== RowMode.Editing &&
          drawGoalText(elements, goal, 'badges' in settings ? settings.badges : [])}
        {'pickers' in settings && settings.pickers}
        {mark !== undefined && drawDoneMark($, elements, sessionId, goal, mark, row)}
        {row.mode === RowMode.WaitingForYes && drawClearQuestion($, elements, sessionId, goal)}
        {goal.todos.map(todo => (
          <Text dimColor>{describeEntry(todo)}</Text>
        ))}
      </Box>
      {drawRowButtons($, elements, sessionId, goal, row)}
    </Box>
  )

  return drawUnderRow(card, row)
}

/** `card`, the box of a goal, with the fields drawn under it in the mode of `row`. */
function drawUnderRow(card: RenderElement, row: DrawnRow): RenderElement {
  switch (row.mode) {
    case RowMode.Editing:
      return row.fields.drawUnderRow(card, [
        { fields: [row.field], warning: row.isBlankTextRefused ? BLANK_TEXT_WARNING : undefined },
      ])
    case RowMode.Unmarking:
      return row.fields.drawUnderRow(card, [{ fields: [row.field], warning: undefined }])
    case RowMode.WaitingForYes:
    case undefined:
      return card
  }
}

/** The text of `goal`, after `badges`, each drawn inverse and set apart by a space. */
function drawGoalText({ Text }: GoalElements, goal: Goal, badges: readonly string[]) {
  if (badges.length === 0) {
    return <Text bold>{goal.text}</Text>
  }

  return (
    <Text bold>
      {badges.flatMap((badge, index) => [
        ...(index === 0 ? [] : [' ']),
        <Text inverse>{` ${badge} `}</Text>,
      ])}
      {` ${goal.text}`}
    </Text>
  )
}

/** The border of a row: by its mode, and for a row not pressed, by its done mark. */
function borderColorOf(row: DrawnRow, mark: DoneMark | undefined) {
  switch (row.mode) {
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

/**
 * The done mark of `goal` in the color of success, with Unmark on a row not pressed. Unmark draws
 * the field for a reason where the surface has input fields, and removes the mark at once
 * elsewhere.
 */
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
          onPress={() =>
            row.fields === undefined
              ? saveOnce($, () => unmarkOnScreen($, sessionId, goal, mark))
              : startUnmarking($, sessionId, goal, mark)
          }
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
 * The buttons beside a row: Done and Cancel while the goal is edited, Cancel while it is unmarked,
 * none while it waits for a yes, and otherwise Clear, with Edit before it where the surface draws
 * input fields. In a narrow row, a button that does not fit shows on the next line, with its label
 * unbroken.
 */
function drawRowButtons(
  $: EngineInterface,
  elements: GoalElements,
  sessionId: string,
  goal: Goal,
  row: DrawnRow,
) {
  switch (row.mode) {
    case RowMode.WaitingForYes:
      return null
    case RowMode.Editing:
      return drawButtonRow(elements, [
        {
          key: `done-edit-${goal.number}`,
          label: DONE_LABEL,
          onPress: () => saveOnce($, () => finishEditing($, sessionId, goal)),
        },
        cancelButtonOf($, goal, row.mode, 'cancel-edit'),
      ])
    case RowMode.Unmarking:
      return drawButtonRow(elements, [cancelButtonOf($, goal, row.mode, 'cancel-unmark')])
    case undefined:
      return drawButtonRow(elements, [
        ...(row.fields === undefined
          ? []
          : [
              {
                key: `edit-${goal.number}`,
                label: EDIT_LABEL,
                dimColor: true,
                onPress: () => startEditing($, sessionId, goal),
              },
            ]),
        {
          key: `clear-${goal.number}`,
          label: CLEAR_LABEL,
          dimColor: true,
          onPress: () => askToClear($, sessionId, goal),
        },
      ])
  }
}

/** A button beside a row, with the key that addresses it. */
type RowButton = ButtonProps & { key: string }

/**
 * `buttons` side by side at the end of a row, each in a box that never shrinks, so a narrow row does
 * not break its label.
 */
function drawButtonRow({ Box, Button }: GoalElements, buttons: readonly RowButton[]) {
  return (
    <Box columnGap={1} flexWrap="wrap" justifyContent="flex-end">
      {buttons.map(button => (
        <Box flexShrink={0}>
          <Button {...button} />
        </Box>
      ))}
    </Box>
  )
}

/**
 * Cancel beside the row of `goal` in the mode `mode`, which ends that mode. Its key is `keyPrefix`
 * followed by the number of the goal.
 */
function cancelButtonOf(
  $: EngineInterface,
  goal: Goal,
  mode: RowMode.Editing | RowMode.Unmarking,
  keyPrefix: string,
): RowButton {
  return {
    key: `${keyPrefix}-${goal.number}`,
    label: CANCEL_LABEL,
    onPress: () => dropGoalInPane($, goal.id, mode),
  }
}

/**
 * The field that edits the text of `goal`, drawn as `field` sets it. Done saves the text typed into
 * it, and Enter saves the text submitted from it.
 */
function goalTextFieldOf(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  { fieldId, drawn }: EditedField,
): FieldUnderCard {
  return {
    key: editFieldKeyOf(goal, fieldId),
    label: nameGoal(goal.number),
    value: drawn,
    submitLabel: DONE_LABEL.toLowerCase(),
    onInput: typed => recordTypedText($, sessionId, goal.id, typed),
    onSubmit: text => saveOnce($, () => submitEdit($, sessionId, goal, text)),
  }
}

/**
 * The field for the reason to remove the done mark `shown` of `goal`, which removes the mark with
 * the reason entered in it.
 */
function reasonFieldOf(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  shown: DoneMark,
): FieldUnderCard {
  return {
    key: reasonFieldKeyOf(goal),
    label: nameGoal(goal.number),
    placeholder: REASON_PLACEHOLDER,
    submitLabel: UNMARK_SUBMIT_LABEL,
    onSubmit: reason => saveOnce($, () => unmarkOnScreen($, sessionId, goal, shown, { reason })),
  }
}

function drawNewGoalField(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
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
