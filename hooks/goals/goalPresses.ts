import type { EngineInterface } from 'claude-code'

import type { DoneMark, Goal } from '../../types'
import { showFailure } from '../failureToast'
import { MarkRemover, Outcome, Refusal, isGoalOpen, nextGoalNumberOf } from './board'
import type { EditRefused, UnmarkRefused } from './board'
import {
  addGoalToSession,
  clearGoalOfSession,
  editGoalOfSession,
  loadBoardShowingFailure,
  removeDoneMarkInSession,
} from './goalActions'
import { GOALS_PANE } from './goalNames'
import {
  RowMode,
  dropGoalInPane,
  endSaving,
  readBoardInState,
  refuseBlankText,
  setGoalInPane,
  startSaving,
} from './goalState'
import {
  describeFocusNotMoved,
  describeMarkNoLongerShown,
  describeNoLongerOpen,
  describeNotAdded,
  describeNotCleared,
  describeNotEdited,
  describeNotUnmarked,
} from './goalTexts'

// What a press or an entry in the Goals pane does. The pane draws what the state and the board
// have after it.

export function editFieldKeyOf(goal: Goal): string {
  return `edit-goal-${goal.number}`
}

/**
 * The key of the field that adds the goal numbered `number`, the next number of the board. A goal
 * added from anywhere changes the key, so the pane draws an empty field, while a failed add leaves
 * the typed text in the field.
 */
export function newGoalFieldKeyOf(number: number): string {
  return `new-goal-${number}`
}

/**
 * Runs `save` unless another save of the pane runs. Button and Input have no disabled state, so a
 * press or an entry that arrives meanwhile is ignored.
 */
export async function saveOnce($: EngineInterface, save: () => Promise<void>): Promise<void> {
  if (!(await startSaving($))) {
    return
  }
  try {
    await save()
  } finally {
    await endSaving($)
  }
}

/**
 * Runs `act` once the board of the session `sessionId` is read again from the store, unless the
 * goal is no longer open on it, which a toast then shows.
 */
async function actOnOpenGoal(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  act: () => Promise<void>,
): Promise<void> {
  const loaded = await loadBoardShowingFailure($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    return
  }
  if (isGoalOpen(loaded.board, goal.id)) {
    await act()
  } else {
    $.ui.toast(describeNoLongerOpen(goal))
  }
}

/** Shows the yes and the keep of a clear in place of the Clear of the goal, while it is open. */
export async function askToClear($: EngineInterface, sessionId: string, goal: Goal): Promise<void> {
  await actOnOpenGoal($, sessionId, goal, () =>
    setGoalInPane($, sessionId, goal.id, { mode: RowMode.WaitingForYes }),
  )
}

/**
 * Draws the text of the goal as a field with the text in the store, while the goal is open, and
 * moves the focus to it.
 */
export async function startEditing(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
): Promise<void> {
  await actOnOpenGoal($, sessionId, goal, async () => {
    await setGoalInPane($, sessionId, goal.id, {
      mode: RowMode.Editing,
      isBlankTextRefused: false,
    })
    await focusField($, editFieldKeyOf(goal), goal)
  })
}

/**
 * Saves the text entered in the field of `goal`, and draws the goal with its text again once the
 * text is saved or was the text of the goal already. A blank text keeps the field open with a
 * warning, and a failed save keeps it open with the entered text.
 */
export async function editOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  text: string,
): Promise<void> {
  const edited = await editGoalOfSession($, sessionId, goal.number, text)
  switch (edited.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotEdited(edited))

      return
    case Outcome.Refused:
      return showEditRefusal($, goal, edited)
    case Outcome.Changed:
    case Outcome.Unchanged:
      return dropGoalInPane($, goal.id, RowMode.Editing)
  }
}

async function showEditRefusal(
  $: EngineInterface,
  goal: Goal,
  refused: EditRefused,
): Promise<void> {
  switch (refused.refusal) {
    case Refusal.BlankText:
      return refuseBlankText($, goal.id)
    case Refusal.GoalNotOpen:
      $.ui.toast(describeNoLongerOpen(goal))

      return dropGoalInPane($, goal.id, RowMode.Editing)
  }
}

/**
 * Removes the done mark `shown` from the goal, as removed by the user. A mark removed or replaced
 * since the pane drew it is left as it is, and a toast shows the mark that was shown.
 */
export async function unmarkOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  shown: DoneMark,
): Promise<void> {
  const removed = await removeDoneMarkInSession(
    $,
    sessionId,
    goal.number,
    MarkRemover.User,
    shown.markedAt,
  )
  switch (removed.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotUnmarked(removed))
      break
    case Outcome.Refused:
      $.ui.toast(describeUnmarkRefusal(goal, shown, removed))
      break
    case Outcome.Changed:
      break
  }
}

function describeUnmarkRefusal(goal: Goal, shown: DoneMark, refused: UnmarkRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return describeNoLongerOpen(goal)
    case Refusal.NotMarkedDone:
      return describeMarkNoLongerShown(goal, shown)
  }
}

/**
 * Clears the goal on the board of the session `sessionId`, where the number matches only that
 * goal. A failed clear still shows the yes and the keep, so the person can press yes again.
 */
export async function clearOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
): Promise<void> {
  const cleared = await clearGoalOfSession($, sessionId, goal.number)
  switch (cleared.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotCleared(cleared))

      return
    case Outcome.Refused:
      $.ui.toast(describeNoLongerOpen(goal))
      break
    case Outcome.Changed:
      break
  }
  await dropGoalInPane($, goal.id, RowMode.WaitingForYes)
}

/**
 * Adds the goal entered in the field drawn for the goal numbered `fieldNumber`. The engine runs the
 * entries of one field one after another. An entry made while the goal from the entry before it
 * was being saved arrives after that goal has taken the number, so the entry adds nothing.
 */
export async function addOnScreen(
  $: EngineInterface,
  sessionId: string,
  fieldNumber: number,
  text: string,
): Promise<void> {
  const added = await addGoalToSession($, sessionId, text, fieldNumber)
  switch (added.outcome) {
    case Outcome.Changed:
      await focusNewGoalField($)
      break
    case Outcome.Refused:
      break
    case Outcome.Failed:
      showFailure($, describeNotAdded(added))
      break
  }
}

/**
 * Moves the focus to the field for the next goal. The engine denies the move for a pane that does
 * not hold the keys by now, and the focus then stays where the person put it.
 */
async function focusNewGoalField($: EngineInterface): Promise<void> {
  const inState = await readBoardInState($)
  if (inState?.outcome !== Outcome.Read) {
    return
  }
  const key = newGoalFieldKeyOf(nextGoalNumberOf(inState.board))
  await focusField($, key, undefined)
}

/**
 * Moves the focus to the field with the key `key` in the Goals pane, which edits the goal `edited`
 * or, without one, adds a goal. A move denied by the engine is written to the debug log.
 */
async function focusField(
  $: EngineInterface,
  key: string,
  edited: Goal | undefined,
): Promise<void> {
  const focused = await $.ui.focus({ requestId: GOALS_PANE, key })
  if (focused.deny !== undefined) {
    $.ui.log(describeFocusNotMoved(focused.deny, edited), { to: 'debug' })
  }
}
