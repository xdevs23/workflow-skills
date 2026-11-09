import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Board, FollowedGoal, Goal, GoalInPane, SessionBoard } from '../../types'
import type { PLUGIN } from '../names'
import { Outcome, openGoalsByIdOf, openGoalsByPriorityOf, openGoalsOf } from './board'
import type { GoalEdit } from './board'
import { doneMarkOf } from './doneMark'
import {
  ELEMENTS_KEYED_BY_GOAL,
  PaneElement,
  editFieldKeyOf,
  movedElementKeyOf,
  rowElementKeyOf,
} from './goalKeys'
import type { FollowedElement } from './goalKeys'
import { GOALS_PANE } from './goalNames'
import {
  RowMode,
  readBoardInState,
  readEdit,
  readFollowedGoal,
  readGoalInPane,
  redrawEditField,
  setFollowedGoal,
} from './goalState'
import { describeFocusNotMoved } from './goalTexts'
import type { FocusTarget } from './goalTexts'

// Claude Code 2.1.316 sets the focus of a pane to a position among the elements drawn in it, and
// does not move the focus when the elements are drawn in another order. Once the goals are drawn in
// another order, or a row above draws one button more or less, the focus is on an element of
// another goal, and a dropdown opens its list when the focus moves onto it. So the pane records the
// goal whose row has the focus, and moves the focus to that row again once a change of the board
// moved the row. Once Claude Code sets the focus to the element and not to its position, the record
// of the followed goal, the reaction to a change of the board and the new keys per move are
// deleted.

/** The goal followed by the focus, without its session. */
type Followed = Omit<FollowedGoal, 'sessionId'>

/** A key the row of a goal can draw, with the goal and its element followed from that key. */
type KeyInRow = { key: string; followed: Followed }

/** A move of the focus to the element of the followed row drawn under `key`. */
type AskedMove = { sessionId: string; key: string; target: FocusTarget }

/**
 * A goal row as drawn up to its focusable elements: the goal, and the time of its done mark, which
 * draws an Unmark.
 */
type RowPlace = { goalId: string; markedAt: number | undefined }

/**
 * Records the goal whose row has the element moved to by the focus of the Goals pane, or null for
 * an element outside the rows, once the engine has moved the focus.
 */
export const recordFollowedGoal: MatchedHook<
  'ui.focus',
  { component: 'Pane'; requestId: typeof GOALS_PANE }
> = async ($, e, next) => {
  const moved = await next(e)
  if (moved.deny === undefined) {
    await setFollowedGoal($, await $.session.id(), await followedGoalWith($, e.element))
  }

  return moved
}

/** The open goal whose row draws the element with the key `key`, and that element, if any. */
async function followedGoalWith(
  $: EngineInterface,
  key: string | undefined,
): Promise<Followed | null> {
  const [inState, inPane, followed] = await Promise.all([
    readBoardInState($),
    readGoalInPane($),
    readFollowedGoal($),
  ])
  if (key === undefined || inState?.outcome !== Outcome.Read) {
    return null
  }
  const keys = openGoalsOf(inState.board).flatMap(goal => keysInRowOf(goal, inPane, followed))

  return keys.find(inRow => inRow.key === key)?.followed ?? null
}

/**
 * The keys the row of `goal` can draw: its pickers, buttons and field for the reason under their
 * own keys, the field that edits it while `inPane` edits it, and the element moved to by the focus
 * while `followed` follows it.
 */
function keysInRowOf(
  goal: Goal,
  inPane: GoalInPane | null,
  followed: FollowedGoal | null,
): KeyInRow[] {
  const followedFrom = (element: FollowedElement): Followed => ({ goalId: goal.id, element })

  return [
    ...ELEMENTS_KEYED_BY_GOAL.map(element => ({
      key: rowElementKeyOf(goal, element),
      followed: followedFrom(
        element === PaneElement.UnmarkReason ? element : PaneElement.FirstButton,
      ),
    })),
    ...(inPane?.goalId === goal.id && inPane.mode === RowMode.Editing
      ? [
          {
            key: editFieldKeyOf(goal, inPane.fieldId),
            followed: followedFrom(PaneElement.GoalText),
          },
        ]
      : []),
    ...(followed?.goalId === goal.id && followed.keyId !== undefined
      ? [
          {
            key: movedElementKeyOf(goal, followed.keyId),
            followed: { ...followedFrom(followed.element), keyId: followed.keyId },
          },
        ]
      : []),
  ]
}

/** The Goals pane, as the events of a press, a pick and an entry in it match it. */
type InGoalsPane = { component: 'Pane'; requestId: typeof GOALS_PANE }

/**
 * Moves the focus with the goal it follows in the Goals pane, when `e`, a write of the board, moves
 * the row of that goal while the pane has the keyboard. The element moved to is drawn under a key
 * new to the move, written before the board, so the first drawing of the board has it.
 */
export const followGoalWithFocus: MatchedHook<
  'state.set',
  { plugin: typeof PLUGIN; key: 'sessionBoard' }
> = async ($, e, next) => {
  const asked = await drawMoveOfFocus($, e.previous ?? null, e.value)
  const written = await next(e)
  if (asked !== undefined) {
    await moveFocus($, asked)
  }

  return written
}

// Claude Code 2.1.316 does not raise the `state.set` hooks of a plugin for a write made by one of
// its handler closures, so a board written by a press, a pick or an entry in the pane does not
// reach followGoalWithFocus. The hooks below follow the goal once the closure has run, so for these
// the key of the move is written after the board, and the pane is drawn in the new order once
// before the focus moves.

export const followGoalAfterPress: MatchedHook<'ui.press', InGoalsPane> = ($, e, next) =>
  followGoalAfter($, () => next(e))

export const followGoalAfterPick: MatchedHook<'ui.select', InGoalsPane> = ($, e, next) =>
  followGoalAfter($, () => next(e))

export const followGoalAfterEntry: MatchedHook<'ui.input', InGoalsPane> = ($, e, next) =>
  followGoalAfter($, () => next(e))

/** Runs `act`, and moves the focus with the followed goal once `act` moved the row of the goal. */
async function followGoalAfter<Acted>(
  $: EngineInterface,
  act: () => Promise<Acted>,
): Promise<Acted> {
  const shown = await readBoardInState($)
  const acted = await act()
  const asked = await drawMoveOfFocus($, shown, await readBoardInState($))
  if (asked !== undefined) {
    await moveFocus($, asked)
  }

  return acted
}

/**
 * Draws the element of the followed row that the focus moves to under a key new to the move, and
 * returns the move, when the board `written` in place of `shown` moves that row, or the field that
 * edits the followed goal is no longer drawn, while the pane has the keyboard. Once the pane has
 * lost the keyboard, the goal is no longer followed.
 */
async function drawMoveOfFocus(
  $: EngineInterface,
  shown: SessionBoard | null,
  written: SessionBoard | null,
): Promise<AskedMove | undefined> {
  const followed = await readFollowedGoal($)
  if (
    followed === null ||
    written?.sessionId !== followed.sessionId ||
    written.outcome !== Outcome.Read
  ) {
    return undefined
  }
  const goal = openGoalsByIdOf(written.board).get(followed.goalId)
  if (goal === undefined) {
    return undefined
  }
  const edit = followed.element === PaneElement.GoalText ? await readEdit($, goal.id) : undefined
  const isFocusedFieldDrawn = followed.element !== PaneElement.GoalText || edit !== undefined
  if (isFocusedFieldDrawn && isRowInPlace(shown, written.board, goal)) {
    return undefined
  }
  if (!(await hasKeyboard($))) {
    await setFollowedGoal($, followed.sessionId, null)

    return undefined
  }

  return { sessionId: followed.sessionId, ...(await drawMovedElement($, followed, goal, edit)) }
}

/**
 * Whether `board` draws the focusable elements of the row of `goal`, and every element before them,
 * where `shown` drew them.
 */
function isRowInPlace(shown: SessionBoard | null, board: Board, goal: Goal): boolean {
  if (shown?.outcome !== Outcome.Read) {
    return false
  }
  const before = rowPlacesUpToOf(shown.board, goal)
  const after = rowPlacesUpToOf(board, goal)

  return (
    before.length === after.length &&
    before.every((place, index) => {
      const other = after[index]

      return place.goalId === other?.goalId && place.markedAt === other.markedAt
    })
  )
}

/** The rows of `board` drawn before the row of `goal`, and that row, each as its place. */
function rowPlacesUpToOf(board: Board, goal: Goal): RowPlace[] {
  const rows = openGoalsByPriorityOf(board)
  const upTo = rows.slice(0, rows.findIndex(row => row.id === goal.id) + 1)

  return upTo.map(row => ({ goalId: row.id, markedAt: doneMarkOf(row)?.markedAt }))
}

/** Whether the user has given the Goals pane the keyboard. */
async function hasKeyboard($: EngineInterface): Promise<boolean> {
  const panes = await $.ui.panes()

  return panes.some(pane => pane.id === GOALS_PANE && pane.isFocused)
}

/**
 * Draws the element of the row of `goal` that the focus moves to under a key new to the move, and
 * returns that key: the field that edits the goal, drawn again from `edit`, the typed text, while
 * the focus was on that field, and otherwise the element drawn under the key of the move.
 */
async function drawMovedElement(
  $: EngineInterface,
  followed: FollowedGoal,
  goal: Goal,
  edit: GoalEdit | undefined,
): Promise<Omit<AskedMove, 'sessionId'>> {
  const keyId = crypto.randomUUID()
  if (edit !== undefined) {
    await redrawEditField($, goal.id, edit, keyId)

    return {
      key: editFieldKeyOf(goal, keyId),
      target: { element: PaneElement.GoalText, number: goal.number },
    }
  }
  const element =
    followed.element === PaneElement.UnmarkReason ? followed.element : PaneElement.FirstButton
  await setFollowedGoal($, followed.sessionId, { goalId: goal.id, element, keyId })

  return { key: movedElementKeyOf(goal, keyId), target: { element, number: goal.number } }
}

/** Moves the focus as `asked`, and stops following the goal once the engine denies the move. */
async function moveFocus($: EngineInterface, { sessionId, key, target }: AskedMove): Promise<void> {
  const moved = await focusElement($, key, target)
  if (moved.outcome === FocusOutcome.Denied) {
    await setFollowedGoal($, sessionId, null)
  }
}

/** Stops following a goal with the focus once the Goals pane closes. */
export const stopFollowingOnClose: MatchedHook<'ui.close', { id: typeof GOALS_PANE }> = async (
  $,
  e,
  next,
) => {
  const closed = await next(e)
  await setFollowedGoal($, await $.session.id(), null)

  return closed
}

/** Whether the engine moved the focus. */
export enum FocusOutcome {
  Moved = 'moved',
  Denied = 'denied',
}

/** A move of the focus as the engine made it, or the reason the engine gave for not making it. */
export type FocusMove =
  | { outcome: FocusOutcome.Moved }
  | { outcome: FocusOutcome.Denied; denial: string }

/**
 * Moves the focus to `target`, the element with the key `key` in the Goals pane, and returns
 * whether the engine moved it. A move denied by the engine is written to the debug log.
 */
export async function focusElement(
  $: EngineInterface,
  key: string,
  target: FocusTarget,
): Promise<FocusMove> {
  const focused = await $.ui.focus({ requestId: GOALS_PANE, key })
  if (focused.deny === undefined) {
    return { outcome: FocusOutcome.Moved }
  }
  $.ui.log(describeFocusNotMoved(focused.deny, target), { to: 'debug' })

  return { outcome: FocusOutcome.Denied, denial: focused.deny }
}
