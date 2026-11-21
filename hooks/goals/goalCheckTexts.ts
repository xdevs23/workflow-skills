import type { TurnCompleteReason } from 'claude-code'

import type { Board, DefaultBranch, Goal, ListedGoal } from '../../types'
import { DEBUG_LOG_NOTE } from '../failureToast'
import { AND_LIST } from '../listFormat'
import type { TextWithLine } from '../sendToModel'
import { MAX_EVIDENCE_LENGTH, Refusal } from './board'
import type { EvidenceRefusal } from './board'
import { describeGoalWithPriority } from './goalListTexts'
import { PANE_TITLE, nameGoal } from './goalPaneTexts'
import { withNotesOnOpenGoals } from './goalToolTexts'
import { GoalVerdict } from './goalVerdicts'
import type { MissingWork, WaitingWork } from './goalVerdicts'

// The texts of the goal check: the prompt that starts the goal checker, the prompt that sends the
// goals found open to the main conversation, and the toasts on a check that failed.

/** The description shown for the task that runs the goal checker. */
export const GOAL_CHECK_DESCRIPTION = 'Check the open goals'

/** The final answer asked of the goal checker, which readCheckerAnswer reads. */
const ANSWER_EXAMPLE = JSON.stringify({
  goals: [
    { goal: 1, verdict: GoalVerdict.Done, evidence: '<evidence>' },
    { goal: 2, verdict: GoalVerdict.Open, missing: '<missing>' },
  ],
})

/** The prompt that starts the goal checker on `goals`, judged against `defaultBranch`. */
export function writeGoalCheckPrompt(
  goals: readonly ListedGoal[],
  defaultBranch: DefaultBranch | undefined,
): string {
  return [
    'The user set these open goals for this project, listed as a JSON array with the number and ' +
      `the text of each goal:\n\n${JSON.stringify(goals)}`,
    'A goal with "removedMark" had a done mark that the user removed at "removedAt". ' +
      '"removedMark" contains the evidence given for that mark, and the reason given by the ' +
      'user, if any.',
    defaultBranch === undefined
      ? 'Git found no default branch in this project.'
      : `The default branch is ${defaultBranch.ref}, at commit ${defaultBranch.head}.`,
    'Give your final answer as one JSON object with one verdict on every goal, with nothing ' +
      `before or after it and without a code fence: ${ANSWER_EXAMPLE}. Write the evidence on ` +
      `one line of at most ${MAX_EVIDENCE_LENGTH} characters.`,
  ].join('\n\n')
}

const MISSING_WORK_OPENING =
  'While you were idle, a fresh agent checked the open goals against the project and found these ' +
  'goals not done yet:'

const MISSING_WORK_CLOSING = 'Finish what is missing.'

/**
 * The note that sends `missing`, the goals of `board` judged open, to the main conversation, each
 * with the goals of `waiting` that wait for it, with its transcript line.
 */
export function describeMissingWork(
  board: Board,
  missing: readonly MissingWork[],
  waiting: readonly WaitingWork[],
): TextWithLine {
  const goals = missing.map(({ goal, missing: what }) =>
    [describeGoalWithPriority(goal), `Missing: ${what}`, ...describeWaiting(goal, waiting)].join(
      '\n',
    ),
  )
  const names = AND_LIST.format(missing.map(({ goal }) => nameGoal(goal.number)))

  return {
    text: withNotesOnOpenGoals(
      board,
      [MISSING_WORK_OPENING, ...goals, MISSING_WORK_CLOSING].join('\n\n'),
    ),
    line: `${PANE_TITLE}: ${names} found open by the goal checker, sent to Claude`,
  }
}

/** The lines on the goals of `waiting` that wait for `goal`, each followed by its own. */
function describeWaiting(goal: Goal, waiting: readonly WaitingWork[]): string[] {
  return waiting
    .filter(each => each.dependsOn === goal.number)
    .flatMap(each => [
      `Judged done, marked once ${nameGoal(goal.number)} is done: ` +
        describeGoalWithPriority(each.goal),
      ...describeWaiting(each.goal, waiting),
    ])
}

/**
 * The closing of a toast on a goal check that is not run again by itself. A check runs after the
 * idle minutes that follow a turn not started by the goals found open.
 */
const CHECK_AGAIN = 'The goals are checked again once Claude is idle after your next message.'

/** The toast for a goal check stopped by the error with the message `reason`. */
export function describeGoalsNotChecked(reason: string): string {
  return `The open goals could not be checked: ${reason}. ${CHECK_AGAIN} ${DEBUG_LOG_NOTE}`
}

/** The toast for a goal checker that did not start, with the refusal of its start, if any. */
export function describeCheckerNotStarted(refusal: string | undefined): string {
  const opening =
    refusal === undefined
      ? 'The goal checker did not start, since a hook returned without starting it.'
      : `The goal checker did not start: ${refusal}.`

  return `${opening} ${CHECK_AGAIN} ${DEBUG_LOG_NOTE}`
}

const NOT_CHECKED = 'so the open goals were not checked.'

/** The toast for a goal checker that ended for each reason without an answer. */
const VERDICTS_NOT_REPORTED: Record<Exclude<TurnCompleteReason, 'answer'>, string> = {
  aborted: `The goal checker was stopped before it reported its verdicts, ${NOT_CHECKED} ` +
    CHECK_AGAIN,
  refusal: `The model refused the goal check, ${NOT_CHECKED} ${CHECK_AGAIN}`,
  error:
    `The goal checker stopped on an error of the API, ${NOT_CHECKED} They are checked again ` +
    'once Claude has been idle again.',
}

export function describeVerdictsNotReported(reason: Exclude<TurnCompleteReason, 'answer'>): string {
  return `${VERDICTS_NOT_REPORTED[reason]} ${DEBUG_LOG_NOTE}`
}

export const VERDICTS_NOT_READ_TOAST =
  'The goal checker gave its verdicts in another shape than asked for, so they were not ' +
  `applied. ${CHECK_AGAIN} ${DEBUG_LOG_NOTE}`

/** The toast for the goals numbered `goals`, which got no verdict, a malformed one or several. */
export function describeGoalsNotJudged(goals: readonly number[]): string {
  return (
    'The goal checker gave no usable verdict on these goals, so they were neither marked nor ' +
    `sent to Claude: ${AND_LIST.format(goals.map(nameGoal))}. ${CHECK_AGAIN} ${DEBUG_LOG_NOTE}`
  )
}

/** The evidence that each refusal of the board found on a goal judged done. */
const REFUSED_EVIDENCE: Record<EvidenceRefusal, string> = {
  [Refusal.BlankEvidence]: 'without evidence',
  [Refusal.EvidenceNotOneLine]: 'with evidence over several lines',
  [Refusal.EvidenceTooLong]: `with evidence longer than ${MAX_EVIDENCE_LENGTH} characters`,
}

/** The toast for goal `goal`, judged done with evidence that the board does not accept. */
export function describeEvidenceRefused(goal: number, refusal: EvidenceRefusal): string {
  return (
    `The goal checker judged ${nameGoal(goal)} done ${REFUSED_EVIDENCE[refusal]}, so it was not ` +
    `marked. ${CHECK_AGAIN} ${DEBUG_LOG_NOTE}`
  )
}

/** The toast for the done marks that the store did not save, with the failure. */
export function describeMarksNotSaved(storeFailure: string): string {
  return (
    `The goals judged done by the goal checker were not marked. ${storeFailure} ${CHECK_AGAIN} ` +
    DEBUG_LOG_NOTE
  )
}

/** The toast for goals found open that were not sent, with the reason given by the engine. */
export function describeMissingWorkNotSent(reason: string): string {
  return (
    `The goals found open by the goal checker could not be sent to Claude: ${reason}. Press ` +
    `Nudge on them in the ${PANE_TITLE} pane to send them now. ${DEBUG_LOG_NOTE}`
  )
}

export const MISSING_WORK_WAITING_AFTER_STOP =
  'The goals found open by the goal checker are sent to Claude once you type a slash command or ' +
  'send a message.'

export function describeMissingWorkWaitingForPane(paneTitle: string): string {
  return (
    'The goals found open by the goal checker are sent to Claude once you close the ' +
    `${paneTitle} pane or send a message.`
  )
}
