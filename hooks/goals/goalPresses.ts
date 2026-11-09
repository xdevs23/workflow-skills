import type { EngineInterface } from 'claude-code'

import type { DoneMark, Goal } from '../../types'
import { showFailure } from '../failureToast'
import { Outcome, Refusal, nextGoalNumberOf, openGoalsByIdOf } from './board'
import type {
  Changed,
  EditRefused,
  GoalEdit,
  LoopRefused,
  NotChanged,
  NotOpenRefused,
  Unchanged,
  UnmarkRefused,
} from './board'
import type { Failed } from './boardStore'
import { MarkRemover } from './doneMark'
import {
  addGoalToSession,
  clearGoalOfSession,
  editGoalOfSession,
  loadBoardShowingFailure,
  removeDoneMarkInSession,
  setGoalDependencyInSession,
  setGoalPriorityInSession,
} from './goalActions'
import { focusElement } from './goalFocus'
import { PaneElement, editFieldKeyOf, newGoalFieldKeyOf, rowElementKeyOf } from './goalKeys'
import {
  RowMode,
  dropGoalInPane,
  endSaving,
  readBoardInState,
  readEdit,
  recordTypedText,
  redrawEditField,
  refuseBlankText,
  setGoalInPane,
  startSaving,
} from './goalState'
import {
  describeDependencyLoop,
  describeDependencyNotSet,
  describeEditedElsewhere,
  describeMarkNoLongerShown,
  describeNoLongerOpen,
  describeNotAdded,
  describeNotCleared,
  describeNotEdited,
  describeNotUnmarked,
  describePriorityNotSet,
} from './goalTexts'
import type { Priority } from './priority'

// What a press or an entry in the Goals pane does. The pane draws what the state and the board
// have after it.

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
 * Runs `act` with the goal as the board of the session `sessionId` has it once read again from the
 * store, unless the goal is no longer open on it, which a toast then shows.
 */
async function actOnOpenGoal(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  act: (open: Goal) => Promise<void>,
): Promise<void> {
  const loaded = await loadBoardShowingFailure($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    return
  }
  const open = openGoalsByIdOf(loaded.board).get(goal.id)
  if (open !== undefined) {
    await act(open)
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
  await actOnOpenGoal($, sessionId, goal, async open => {
    const fieldId = crypto.randomUUID()
    await setGoalInPane($, sessionId, open.id, {
      mode: RowMode.Editing,
      fieldId,
      drawn: open.text,
      editedFrom: open.text,
      isBlankTextRefused: false,
    })
    await recordTypedText($, sessionId, open.id, open.text)
    await focusElement($, editFieldKeyOf(open, fieldId), {
      element: PaneElement.GoalText,
      number: open.number,
    })
  })
}

/** Saves `text`, the whole text of the field for `goal` at the Enter pressed in it, as Done does. */
export async function submitEdit(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  text: string,
): Promise<void> {
  await recordTypedText($, sessionId, goal.id, text)
  await finishEditing($, sessionId, goal)
}

/**
 * Saves the text typed into the field for `goal`, while `goal` is edited, and draws the goal with
 * its text again once the text is saved or was the text of the goal already. A blank text shows a
 * warning under the field, and a failed save draws the field anew with the typed text. A text saved
 * elsewhere since the edit started is named in a toast, and the edit then starts from it, so the
 * next save replaces it.
 */
export async function finishEditing(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
): Promise<void> {
  const edit = await readEdit($, goal.id)
  if (edit === undefined) {
    return
  }
  const edited = await editGoalOfSession($, sessionId, goal.number, edit)
  switch (edited.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotEdited(edited))

      return redrawEditField($, goal.id, edit, crypto.randomUUID())
    case Outcome.Refused:
      return showEditRefusal($, goal, edit, edited)
    case Outcome.Changed:
    case Outcome.Unchanged:
      return dropGoalInPane($, goal.id, RowMode.Editing)
  }
}

async function showEditRefusal(
  $: EngineInterface,
  goal: Goal,
  edit: GoalEdit,
  refused: EditRefused,
): Promise<void> {
  switch (refused.refusal) {
    case Refusal.BlankText:
      return refuseBlankText($, goal.id)
    case Refusal.GoalNotOpen:
      $.ui.toast(describeNoLongerOpen(goal))

      return dropGoalInPane($, goal.id, RowMode.Editing)
    case Refusal.TextChangedElsewhere:
      $.ui.toast(describeEditedElsewhere(refused))

      return redrawEditField(
        $,
        goal.id,
        { text: edit.text, editedFrom: refused.text },
        crypto.randomUUID(),
      )
  }
}

/**
 * Draws a field for the reason to remove the done mark `shown` of the goal, while the goal is open,
 * and moves the focus to it.
 */
export async function startUnmarking(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  shown: DoneMark,
): Promise<void> {
  await actOnOpenGoal($, sessionId, goal, async () => {
    await setGoalInPane($, sessionId, goal.id, { mode: RowMode.Unmarking, shown })
    await focusElement($, rowElementKeyOf(goal, PaneElement.UnmarkReason), {
      element: PaneElement.UnmarkReason,
      number: goal.number,
    })
  })
}

/**
 * Removes the done mark `shown` from the goal, as removed by the user with the reason in `given`, if
 * any, and draws the goal without the field for the reason once the mark is removed or no longer
 * shown. A mark removed or replaced since the pane drew it is not touched, and a toast shows the
 * mark that was shown. A blank reason removes the mark without one, and a failed save shows the
 * field again with the entered reason.
 */
export async function unmarkOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  shown: DoneMark,
  given: { reason?: string } = {},
): Promise<void> {
  const removed = await removeDoneMarkInSession(
    $,
    sessionId,
    goal.number,
    { removedBy: MarkRemover.User, ...given },
    shown.markedAt,
  )
  switch (removed.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotUnmarked(removed))

      return
    case Outcome.Refused:
      $.ui.toast(describeUnmarkRefusal(goal, shown, removed))
      break
    case Outcome.Changed:
      break
  }
  await dropGoalInPane($, goal.id, RowMode.Unmarking)
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
 * Gives the goal the priority picked in the pane, or removes its priority when `priority` is
 * undefined. A goal cleared since the pane drew it is left as it is, and a toast shows it.
 */
export async function prioritizeOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  priority: Priority | undefined,
): Promise<void> {
  const set = await setGoalPriorityInSession($, sessionId, goal.number, priority)
  showSettingNotSet($, set, describePriorityNotSet, () => describeNoLongerOpen(goal))
}

/**
 * Makes the goal depend on `dependsOn`, picked in the pane, or removes its dependency when
 * `dependsOn` is undefined. A goal cleared since the pane drew it, and a dependency that closes a
 * loop set after the pane drew it, are left as they are, and a toast shows them.
 */
export async function setDependencyOnScreen(
  $: EngineInterface,
  sessionId: string,
  goal: Goal,
  dependsOn: Goal | undefined,
): Promise<void> {
  const set = await setGoalDependencyInSession($, sessionId, goal.number, dependsOn?.number)
  showSettingNotSet($, set, describeDependencyNotSet, describeDependencyRefusal)
}

/**
 * Shows a setting picked in the pane that was not saved: a failure of the store as
 * `describeFailure` writes it, and a refusal in a toast as `describeRefusal` writes it.
 */
function showSettingNotSet<Refused extends NotChanged & { outcome: Outcome.Refused }>(
  $: EngineInterface,
  set: Changed<Goal> | Unchanged | Refused | Failed,
  describeFailure: (failed: Failed) => string,
  describeRefusal: (refused: Refused) => string,
): void {
  switch (set.outcome) {
    case Outcome.Failed:
      showFailure($, describeFailure(set))
      break
    case Outcome.Refused:
      $.ui.toast(describeRefusal(set))
      break
    case Outcome.Changed:
    case Outcome.Unchanged:
      break
  }
}

function describeDependencyRefusal(refused: NotOpenRefused | LoopRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return describeNoLongerOpen({ number: refused.goal })
    case Refusal.DependencyLoop:
      return describeDependencyLoop(refused)
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
  const number = nextGoalNumberOf(inState.board)
  await focusElement($, newGoalFieldKeyOf(number), { element: PaneElement.NewGoal, number })
}
