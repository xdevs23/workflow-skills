import type { DoneMark, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { AND_LIST } from '../listFormat'
import { DONE_LABEL } from '../paneTexts'
import type { LoopRefused, TextChangedRefused } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { GOALS_COMMAND } from './goalNames'
import { PANE_TITLE, nameGoal } from './goalPaneTexts'

// The texts of the goals read by the person at the prompt.

/** The label of the button in the prompt footer that opens the Goals pane, named as the pane. */
export const GOALS_BUTTON_LABEL = PANE_TITLE

export const GOALS_DESCRIPTION = `Open the goals of this session in the ${PANE_TITLE} pane`

/** The goals as written in the texts about a failed hook of /goals. */
export const GOALS_SUBJECT: HookSubject = { name: 'goals' }

/** The goals as written in the texts about a failed hook that saves a change made in the pane. */
export const GOALS_PANE_SUBJECT: HookSubject = {
  name: 'goals',
  checkBeforeRetry: `Check the goals in the ${PANE_TITLE} pane before you try again.`,
}

export function describeNotRegistered(reason: string): string {
  return (
    `/${GOALS_COMMAND} could not be registered, so the goals of this session cannot be opened ` +
    `or changed: ${reason}. The debug log has this too.`
  )
}

/** The goal as one line: its number, then its text. */
export function describeGoal(goal: Goal): string {
  return `${nameGoal(goal.number)}: ${goal.text}`
}

/** What a press of Nudge shows while the nudge for `goal` waits for the current turn to end. */
export function describeNudgeWaiting(goal: Pick<Goal, 'number'>): string {
  return `The nudge for ${nameGoal(goal.number)} is sent to Claude once the current turn ends.`
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
