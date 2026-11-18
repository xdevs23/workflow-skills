import type { DoneMark, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { AND_LIST } from '../listFormat'
import { DONE_LABEL } from '../paneTexts'
import { SessionActivity } from '../sessionState'
import { Refusal } from './board'
import type { AddRefused, LoopRefused, TextChangedRefused } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { GOALS_COMMAND } from './goalNames'
import { PANE_TITLE, nameGoal } from './goalPaneTexts'

// The texts of the goals read by the person at the prompt.

/** The label of the button in the prompt footer that opens the Goals pane, named as the pane. */
export const GOALS_BUTTON_LABEL = PANE_TITLE

export const GOALS_DESCRIPTION =
  `Open the goals of this session in the ${PANE_TITLE} pane, or add the text after it as a goal`

/** The hint drawn after /goals for the text of a goal to add. */
export const GOALS_ARGUMENT_HINT = '[goal]'

/** The goals as written in the texts about a failed hook of /goals. */
export const GOALS_SUBJECT: HookSubject = { name: 'goals' }

/** The goals as written in the texts about a failed hook of /goals followed by a goal. */
export const GOALS_ADD_SUBJECT: HookSubject = {
  name: 'goals',
  checkBeforeRetry: `Run /${GOALS_COMMAND} to see whether the goal was added before you try again.`,
}

/** The reply to /goals followed by text from anywhere but the user, which adds nothing. */
export const GOAL_NOT_TYPED_BY_USER =
  `The goal was not added. Only /${GOALS_COMMAND} typed by the user adds a goal.`

/** The goals as written in the texts about a failed hook that saves a change made in the pane. */
export const GOALS_PANE_SUBJECT: HookSubject = {
  name: 'goals',
  checkBeforeRetry: `Check the goals in the ${PANE_TITLE} pane before you try again.`,
}

export const GOALS_LOST_WITHOUT_COMMAND = 'The goals of this session cannot be opened or changed.'

/** The goal as one line: its number, then its text. */
export function describeGoal(goal: Goal): string {
  return `${nameGoal(goal.number)}: ${goal.text}`
}

function describeNudgeWaitingForTurnEnd(goalName: string): string {
  return `The nudge for ${goalName} is sent to Claude once the current turn ends.`
}

const NUDGE_WAITING_BY_ACTIVITY: Record<SessionActivity, (goalName: string) => string> = {
  [SessionActivity.Idle]: describeNudgeWaitingForTurnEnd,
  [SessionActivity.TurnRunning]: describeNudgeWaitingForTurnEnd,
  [SessionActivity.StoppedByUser]: goalName =>
    `The nudge for ${goalName} is sent to Claude once you type a slash command, or once the turn ` +
    'started by your next message ends.',
}

/** The toast for the nudge for `goal` while it waits, in a session doing `activity`. */
export function describeNudgeWaiting(
  goal: Pick<Goal, 'number'>,
  activity: SessionActivity,
): string {
  return NUDGE_WAITING_BY_ACTIVITY[activity](nameGoal(goal.number))
}

/** What a press of Nudge shows for a goal marked as done since the pane drew it. */
export function describeAlreadyMarkedDone(goal: Pick<Goal, 'number'>): string {
  return `${nameGoal(goal.number)} is already marked as done.`
}

/** The toast for the nudge for `goals` left unsent, with the reason. */
export function describeNudgeNotSent(
  goals: readonly [Pick<Goal, 'number'>, ...Pick<Goal, 'number'>[]],
  reason: string,
): string {
  const named = AND_LIST.format(goals.map(goal => nameGoal(goal.number)))

  return `The nudge for ${named} was not sent to Claude: ${reason}.`
}

/** The toast for the waiting nudges left unsent once a stop by the user ended, with the reason. */
export function describeWaitingNudgesNotSent(reason: string): string {
  return (
    `The waiting nudges were not sent to Claude: ${reason}. ` +
    `Press Nudge again in the ${PANE_TITLE} pane.`
  )
}

/** What a press in the Goals pane shows for a goal cleared since the pane drew it. */
export function describeNoLongerOpen(goal: Pick<Goal, 'number'>): string {
  return `${nameGoal(goal.number)} is no longer open.`
}

/** What a save shows for a goal whose text was saved elsewhere since the edit of it started. */
export function describeEditedElsewhere(refused: TextChangedRefused): string {
  return (
    `${nameGoal(refused.goal)} was edited elsewhere to "${refused.text}". Press ${DONE_LABEL} ` +
    'again to save the text in the field instead.'
  )
}

/** What a press of Unmark shows for a done mark removed or replaced since the pane drew it. */
export function describeMarkNoLongerShown(goal: Pick<Goal, 'number'>, shown: DoneMark): string {
  return `${nameGoal(goal.number)} is no longer marked done with ${shown.evidence}.`
}

/** The reply to /goals with text once the text was added as `goal`. */
export function describeGoalAdded(goal: Goal): string {
  return `Added ${describeGoal(goal)}`
}

/** The reply to /goals followed by text whose goal the board rejected. */
export function describeAddRefused(refused: AddRefused): string {
  switch (refused.refusal) {
    case Refusal.BlankText:
      return 'The goal was not added because its text is blank.'
    case Refusal.NumberTaken:
      return `The goal was not added because another goal took ${nameGoal(refused.goal)} meanwhile.`
  }
}

export function describeNotAdded(failed: Failed): string {
  return `The goal was not added. ${describeStoreFailure(failed)}`
}

export function describeNotEdited(failed: Failed): string {
  return `The goal was not edited. ${describeStoreFailure(failed)}`
}

export function describeNotUnmarked(failed: Failed): string {
  return `The done mark was not removed. ${describeStoreFailure(failed)}`
}

export function describePriorityNotSet(failed: Failed): string {
  return `The priority was not set. ${describeStoreFailure(failed)}`
}

export function describeDependencyNotSet(failed: Failed): string {
  return `The dependency was not set. ${describeStoreFailure(failed)}`
}

/** What a pick of a dependency that closes a loop shows, with the next step. */
export function describeDependencyLoop(refused: LoopRefused): string {
  const goal = nameGoal(refused.goal)
  const dependsOn = nameGoal(refused.dependsOn)

  return (
    `${goal} cannot depend on ${dependsOn}: ${dependsOn} depends on ${goal}. Pick another goal, ` +
    `or remove the dependency of ${dependsOn} first.`
  )
}

export function describeNotCleared(failed: Failed): string {
  return `The goal was not cleared. ${describeStoreFailure(failed)}`
}
