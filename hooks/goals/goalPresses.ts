import type { EngineInterface } from 'claude-code'

import type { Goal } from '../../types'
import { showFailure } from '../failureToast'
import { Outcome, Refusal, openGoalsByIdOf } from './board'
import type { Changed, LoopRefused, NotChanged, NotOpenRefused, Unchanged } from './board'
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
import { nudgeOpenGoal } from './goalNudge'
import { GoalPaneActionKind, GoalSaveOutcome } from './goalPaneMessages'
import type { GoalPaneAction, GoalSaveResult } from './goalPaneMessages'
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

// What a save made in the Goals pane does.

/** Runs `action`, a save of the Goals pane, on the board of the session. */
export async function saveGoalPaneAction(
  $: EngineInterface,
  action: GoalPaneAction,
): Promise<GoalSaveResult> {
  const sessionId = await $.session.id()
  switch (action.kind) {
    case GoalPaneActionKind.Add:
      return addOnScreen($, sessionId, action.goal, action.text)
    case GoalPaneActionKind.Edit:
      return editOnScreen($, sessionId, action.goal, action)
    case GoalPaneActionKind.Clear:
      return clearOnScreen($, sessionId, action.goal)
    case GoalPaneActionKind.Unmark:
      return unmarkOnScreen($, sessionId, action.goal, action.shown, action.reason)
    case GoalPaneActionKind.Prioritize: {
      const set = await setGoalPriorityInSession($, sessionId, action.goal, action.priority)

      return showChangeNotSaved($, set, describePriorityNotSet, describeNotOpenRefusal)
    }
    case GoalPaneActionKind.Depend: {
      const set = await setGoalDependencyInSession($, sessionId, action.goal, action.dependsOn)

      return showChangeNotSaved($, set, describeDependencyNotSet, describeDependencyRefusal)
    }
    case GoalPaneActionKind.Nudge:
      return nudgeGoal($, sessionId, action.goal)
  }
}

/** The result of a save whose hook failed. */
export const FAILED_GOAL_SAVE: GoalSaveResult = { outcome: GoalSaveOutcome.Failed }

const SAVED: GoalSaveResult = { outcome: GoalSaveOutcome.Saved }
const REFUSED: GoalSaveResult = { outcome: GoalSaveOutcome.Refused }

/** Shows `text`, the failure of the store to save, and returns the result of a failed save. */
function failedWith($: EngineInterface, text: string): GoalSaveResult {
  showFailure($, text)

  return FAILED_GOAL_SAVE
}

/** Shows `text`, the reason for a refused save, and returns the result of a refused save. */
function refusedWith($: EngineInterface, text: string): GoalSaveResult {
  $.ui.toast(text)

  return REFUSED
}

/**
 * Nudges the model to finish goal `number`, while it is open on the board of the session
 * `sessionId` once read again from the store, and a toast shows a goal no longer open.
 */
async function nudgeGoal(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<GoalSaveResult> {
  const loaded = await loadBoardShowingFailure($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    return FAILED_GOAL_SAVE
  }
  const open = openGoalsByIdOf(loaded.board)
  const goal = [...open.values()].find(each => each.number === number)
  if (goal === undefined) {
    return refusedWith($, describeNoLongerOpen({ number }))
  }
  await nudgeOpenGoal($, sessionId, goal)

  return SAVED
}

/**
 * Saves the text of `edit` for goal `number`. A text saved elsewhere since the edit started is
 * named in a toast.
 */
async function editOnScreen(
  $: EngineInterface,
  sessionId: string,
  number: number,
  edit: { text: string; editedFrom: string },
): Promise<GoalSaveResult> {
  const edited = await editGoalOfSession($, sessionId, number, edit)
  switch (edited.outcome) {
    case Outcome.Failed:
      return failedWith($, describeNotEdited(edited))
    case Outcome.Changed:
    case Outcome.Unchanged:
      return SAVED
    case Outcome.Refused:
      switch (edited.refusal) {
        case Refusal.BlankText:
          return { outcome: GoalSaveOutcome.BlankText }
        case Refusal.GoalNotOpen:
          return refusedWith($, describeNoLongerOpen({ number }))
        case Refusal.TextChangedElsewhere:
          $.ui.toast(describeEditedElsewhere(edited))

          return { outcome: GoalSaveOutcome.TextChangedElsewhere, text: edited.text }
      }
  }
}

/**
 * Removes the done mark `shown` from goal `number`, as removed by the user with `reason`, if any. A
 * mark removed or replaced since the pane drew it is not touched, and a toast shows the mark that
 * was shown. A blank reason removes the mark without one.
 */
async function unmarkOnScreen(
  $: EngineInterface,
  sessionId: string,
  number: number,
  shown: { evidence: string; markedAt: number },
  reason: string | undefined,
): Promise<GoalSaveResult> {
  const removed = await removeDoneMarkInSession(
    $,
    sessionId,
    number,
    { removedBy: MarkRemover.User, ...(reason === undefined ? {} : { reason }) },
    shown.markedAt,
  )
  switch (removed.outcome) {
    case Outcome.Failed:
      return failedWith($, describeNotUnmarked(removed))
    case Outcome.Changed:
      return SAVED
    case Outcome.Refused:
      switch (removed.refusal) {
        case Refusal.GoalNotOpen:
          return refusedWith($, describeNoLongerOpen({ number }))
        case Refusal.NotMarkedDone:
          return refusedWith($, describeMarkNoLongerShown({ number }, shown))
      }
  }
}

/**
 * Shows a change made in the pane that was not saved: a failure of the store as `describeFailure`
 * writes it, and a refusal in a toast as `describeRefusal` writes it.
 */
function showChangeNotSaved<Refused extends NotChanged & { outcome: Outcome.Refused }>(
  $: EngineInterface,
  set: Changed<Goal> | Unchanged | Refused | Failed,
  describeFailure: (failed: Failed) => string,
  describeRefusal: (refused: Refused) => string,
): GoalSaveResult {
  switch (set.outcome) {
    case Outcome.Failed:
      return failedWith($, describeFailure(set))
    case Outcome.Refused:
      return refusedWith($, describeRefusal(set))
    case Outcome.Changed:
    case Outcome.Unchanged:
      return SAVED
  }
}

function describeNotOpenRefusal(refused: NotOpenRefused): string {
  return describeNoLongerOpen({ number: refused.goal })
}

function describeDependencyRefusal(refused: NotOpenRefused | LoopRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return describeNotOpenRefusal(refused)
    case Refusal.DependencyLoop:
      return describeDependencyLoop(refused)
  }
}

/** Clears goal `number` on the board of the session `sessionId`. */
async function clearOnScreen(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<GoalSaveResult> {
  return showChangeNotSaved(
    $,
    await clearGoalOfSession($, sessionId, number),
    describeNotCleared,
    () => describeNoLongerOpen({ number }),
  )
}

/**
 * Adds the goal entered in the field drawn for the goal numbered `fieldNumber`. An entry made after
 * another goal took that number adds nothing.
 */
async function addOnScreen(
  $: EngineInterface,
  sessionId: string,
  fieldNumber: number,
  text: string,
): Promise<GoalSaveResult> {
  const added = await addGoalToSession($, sessionId, text, fieldNumber)
  switch (added.outcome) {
    case Outcome.Changed:
      return SAVED
    case Outcome.Refused:
      return REFUSED
    case Outcome.Failed:
      return failedWith($, describeNotAdded(added))
  }
}
