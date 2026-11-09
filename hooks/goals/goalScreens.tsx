import type {
  ButtonProps,
  ElementTable,
  EngineInterface,
  MatchedHook,
  RenderElement,
  ResolveInput,
  UiOpenResult,
} from 'claude-code'

import type { Board, DoneMark, FollowedGoal, Goal, RowInPane, UnreadBoard } from '../../types'
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
import {
  PaneElement,
  editFieldKeyOf,
  movedElementKeyOf,
  newGoalFieldKeyOf,
  rowElementKeyOf,
} from './goalKeys'
import type { ButtonElement, FollowedElement } from './goalKeys'
import { GOALS_PANE } from './goalNames'
import { drawGoalPickers } from './goalPickers'
import {
  addOnScreen,
  askToClear,
  clearOnScreen,
  finishEditing,
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
  readFollowedGoal,
  readGoalInPane,
  recordTypedText,
  setFollowedGoal,
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
 * The focus follows a goal again only once the focus moves onto its row in the opened pane.
 */
export async function openGoalsPaneOnFreshBoard($: EngineInterface): Promise<PaneOnFreshBoard> {
  const sessionId = await $.session.id()
  await setFollowedGoal($, sessionId, null)
  const loaded = await loadBoardIntoState($, sessionId)
  const opened = await $.ui.open({ id: GOALS_PANE, title: PANE_TITLE, focus: true })

  return { loaded, opened }
}

export const drawGoalsPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof GOALS_PANE }
> = async ($, e) => {
  const [inState, goalInPane, followed] = await Promise.all([
    readBoardInState($),
    readGoalInPane($),
    readFollowedGoal($),
  ])
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
        const drawn = drawnRowOf(goal, row, fields)
        const buttons = rowButtonsOf($, sessionId, goal, drawn)
        const moved = movedTo(goal, followed)

        return drawGoal(elements, goalRowOf(goal, drawn, settings, buttons, moved))
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

/** Where in the row of a goal a button is drawn. */
enum ButtonPlace {
  DoneMark = 'done-mark',
  ClearQuestion = 'clear-question',
  BesideRow = 'beside-row',
}

/** A button of a goal row: the element it is, where in the row it is drawn, its label and press. */
type RowButton = { element: ButtonElement; place: ButtonPlace; props: ButtonProps }

/** A button of a goal row, with the key it is drawn under. */
type KeyedButton = RowButton & { key: string }

/**
 * The buttons of the row of `goal`, drawn as `row`, in the order they are drawn: in a row not
 * pressed, Unmark in its done mark, then Edit where the surface draws input fields, and Clear; the
 * yes and the keep of the question to clear it; Done and Cancel while it is edited; Cancel while it
 * is unmarked.
 */
function rowButtonsOf(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  row: DrawnRow,
): RowButton[] {
  switch (row.mode) {
    case RowMode.WaitingForYes:
      return [
        {
          element: PaneElement.YesClear,
          place: ButtonPlace.ClearQuestion,
          props: {
            label: YES_CLEAR_LABEL,
            variant: 'primary',
            onPress: () => saveOnce($, () => clearOnScreen($, sessionId, goal)),
          },
        },
        {
          element: PaneElement.Keep,
          place: ButtonPlace.ClearQuestion,
          props: {
            label: KEEP_LABEL,
            onPress: () => dropGoalInPane($, goal.id, RowMode.WaitingForYes),
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
            onPress: () => saveOnce($, () => finishEditing($, sessionId, goal)),
          },
        },
        cancelButtonOf($, goal, row.mode, PaneElement.CancelEditing),
      ]
    case RowMode.Unmarking:
      return [cancelButtonOf($, goal, row.mode, PaneElement.CancelUnmarking)]
    case undefined: {
      const mark = doneMarkOf(goal)
      const unmark: RowButton[] =
        mark === undefined
          ? []
          : [
              {
                element: PaneElement.Unmark,
                place: ButtonPlace.DoneMark,
                props: {
                  label: UNMARK_LABEL,
                  dimColor: true,
                  onPress: () =>
                    row.fields === undefined
                      ? saveOnce($, () => unmarkOnScreen($, sessionId, goal, mark))
                      : startUnmarking($, sessionId, goal, mark),
                },
              },
            ]
      const edit: RowButton[] =
        row.fields === undefined
          ? []
          : [
              {
                element: PaneElement.Edit,
                place: ButtonPlace.BesideRow,
                props: {
                  label: EDIT_LABEL,
                  dimColor: true,
                  onPress: () => startEditing($, sessionId, goal),
                },
              },
            ]

      return [
        ...unmark,
        ...edit,
        {
          element: PaneElement.Clear,
          place: ButtonPlace.BesideRow,
          props: {
            label: CLEAR_LABEL,
            dimColor: true,
            onPress: () => askToClear($, sessionId, goal),
          },
        },
      ]
    }
  }
}

/** Cancel beside the row of `goal` in the mode `mode`, drawn as `element`, which ends that mode. */
function cancelButtonOf(
  $: EngineInterface,
  goal: Goal,
  mode: RowMode.Editing | RowMode.Unmarking,
  element: PaneElement.CancelEditing | PaneElement.CancelUnmarking,
): RowButton {
  return {
    element,
    place: ButtonPlace.BesideRow,
    props: { label: CANCEL_LABEL, onPress: () => dropGoalInPane($, goal.id, mode) },
  }
}

/** The element of a goal row moved to by the focus, and the key of the move. */
type MovedElement = { element: FollowedElement; key: string }

/** The element of the row of `goal` moved to by the focus, while `followed` follows `goal`. */
function movedTo(goal: Goal, followed: FollowedGoal | null): MovedElement | undefined {
  return followed?.goalId === goal.id && followed.keyId !== undefined
    ? { element: followed.element, key: movedElementKeyOf(goal, followed.keyId) }
    : undefined
}

/** A goal row as drawn: its goal, its mode, its pickers or badges, and its buttons with keys. */
type GoalRow = {
  goal: Goal
  drawn: DrawnRow
  settings: SettingsInRow
  buttons: readonly KeyedButton[]
}

/**
 * The row of `goal`, drawn as `drawn`, with its buttons `buttons` under their keys, and the element
 * `moved` to by the focus under the key of the move: the field for the reason while the focus was
 * on it and the row draws it, and otherwise the first button other than the yes of the question to
 * clear the goal, which one Enter turns into a clear.
 */
function goalRowOf(
  goal: Goal,
  drawn: DrawnRow,
  settings: SettingsInRow,
  buttons: readonly RowButton[],
  moved: MovedElement | undefined,
): GoalRow {
  const keyed = buttons.map(button => ({ ...button, key: rowElementKeyOf(goal, button.element) }))
  if (moved === undefined) {
    return { goal, drawn, settings, buttons: keyed }
  }
  if (moved.element === PaneElement.UnmarkReason && drawn.mode === RowMode.Unmarking) {
    const field = { ...drawn.field, key: moved.key }

    return { goal, drawn: { ...drawn, field }, settings, buttons: keyed }
  }
  const focused = keyed.findIndex(button => button.element !== PaneElement.YesClear)

  return {
    goal,
    drawn,
    settings,
    buttons: keyed.map((button, index) =>
      index === focused ? { ...button, key: moved.key } : button,
    ),
  }
}

/** The buttons of `buttons` drawn at `place` in the row. */
function buttonsAt(buttons: readonly KeyedButton[], place: ButtonPlace): KeyedButton[] {
  return buttons.filter(button => button.place === place)
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
function drawGoal(elements: GoalElements, { goal, drawn, settings, buttons }: GoalRow) {
  const { Box, Text } = elements
  const mark = doneMarkOf(goal)
  const besideRow = buttonsAt(buttons, ButtonPlace.BesideRow)

  const card = (
    <Box
      key={`goal-${goal.number}`}
      borderStyle="round"
      borderColor={borderColorOf(drawn, mark)}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${goal.number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {drawn.mode !== RowMode.Editing &&
          drawGoalText(elements, goal, 'badges' in settings ? settings.badges : [])}
        {'pickers' in settings && settings.pickers}
        {mark !== undefined &&
          drawDoneMark(elements, mark, buttonsAt(buttons, ButtonPlace.DoneMark))}
        {drawn.mode === RowMode.WaitingForYes &&
          drawClearQuestion(elements, goal, buttonsAt(buttons, ButtonPlace.ClearQuestion))}
        {goal.todos.map(todo => (
          <Text dimColor>{describeEntry(todo)}</Text>
        ))}
      </Box>
      {besideRow.length > 0 && drawButtonRow(elements, besideRow)}
    </Box>
  )

  return drawUnderRow(card, drawn)
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
 * The done mark `mark` in the color of success, with `buttons`: Unmark on a row not pressed. Unmark
 * draws the field for a reason where the surface has input fields, and removes the mark at once
 * elsewhere.
 */
function drawDoneMark(elements: GoalElements, mark: DoneMark, buttons: readonly KeyedButton[]) {
  const { Box, Text } = elements

  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="success">{describeDoneMarkForPerson(mark)}</Text>
      {buttons.map(button => drawButton(elements, button))}
    </Box>
  )
}

/** The question to clear `goal`, with `buttons`: its yes and its keep. */
function drawClearQuestion(elements: GoalElements, goal: Goal, buttons: readonly KeyedButton[]) {
  const { Box, Text } = elements

  return (
    <Box columnGap={1} flexWrap="wrap">
      <Text color="warning">{describeClearQuestion(goal)}</Text>
      {buttons.map(button => drawButton(elements, button))}
    </Box>
  )
}

/**
 * `buttons` side by side at the end of a row, each in a box that never shrinks, so a narrow row does
 * not break its label.
 */
function drawButtonRow(elements: GoalElements, buttons: readonly KeyedButton[]) {
  const { Box } = elements

  return (
    <Box columnGap={1} flexWrap="wrap" justifyContent="flex-end">
      {buttons.map(button => (
        <Box flexShrink={0}>{drawButton(elements, button)}</Box>
      ))}
    </Box>
  )
}

function drawButton({ Button }: GoalElements, button: KeyedButton) {
  return <Button key={button.key} {...button.props} />
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
    key: rowElementKeyOf(goal, PaneElement.UnmarkReason),
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
