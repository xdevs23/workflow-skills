import type { Board, DoneMark, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { sortedByNumber } from '../numbered'
import { MAX_EVIDENCE_LENGTH, Refusal, clearedGoalsOf, doneMarkOf, openGoalsOf } from './board'
import type { ChangeRefused, MarkRefused, UnmarkRefused } from './board'
import { ADD_WORD, GOALS_COMMAND, LIST_GOALS_TOOL, MARK_GOAL_DONE_TOOL } from './goalNames'
import { PANE_TITLE } from './goalTexts'
import { describeEntry } from './todoEntry'
import type { TodoEntry } from './todoEntry'

// The texts of the goals read by the model, with the tools they name.

export const LIST_GOALS_DESCRIPTION = [
  'Lists the goals set by the user on the goals board of this session: each open goal with its',
  'number, your done mark if it has one, and the TODO entries attached to it, then the goals',
  'cleared by the user. Only the user adds, edits and clears goals. Goals of other sessions are',
  'not listed. The open goals are work waited for by the user. Check them before you report work',
  `as finished, and mark a goal you consider done with ${MARK_GOAL_DONE_TOOL}.`,
].join(' ')

export const ATTACH_TODO_DESCRIPTION = [
  'Attaches a TODO entry to an open goal of the goals board of this session, to record that the',
  'goal needs that entry built. Give the number of the goal, and the entry with its number and',
  'title as its heading in TODO.md shows it. An entry may be needed by several goals. Attached',
  'again under the same number, an entry gets the new text. You cannot add or clear a goal: only',
  'the user does.',
].join(' ')

export const DETACH_TODO_DESCRIPTION = [
  'Detaches a TODO entry from an open goal of the goals board of this session, once the entry is',
  'deleted from TODO.md or is no longer needed by the goal. Give the number of the goal, and the',
  'entry by its number, such as #12 or #12.3. Every entry in TODO.md has a number.',
].join(' ')

/** The sentence on what evidence is, in every text on the evidence read by the model. */
export const EVIDENCE_EXAMPLES =
  'Evidence is what the user looks at to check the goal, such as an HTML file, a worktree, a ' +
  'branch or a version.'

export const MARK_GOAL_DONE_DESCRIPTION = [
  'Marks an open goal of the goals board of this session as done, so the user knows what to look',
  'at. Give the number of the goal, and the evidence in at most',
  `${MAX_EVIDENCE_LENGTH} characters. ${EVIDENCE_EXAMPLES} Marked again, the goal gets the new`,
  'evidence. The goal stays open and is still reminded until the user clears it: only the user',
  'does.',
].join(' ')

export const UNMARK_GOAL_DONE_DESCRIPTION = [
  'Removes your done mark from an open goal of the goals board of this session, once you find',
  'that the goal needs more work. Give the number of the goal.',
].join(' ')

/** The goals board, as written in the texts about a failed hook of a goal tool. */
export const GOAL_TOOLS_SUBJECT: HookSubject = {
  name: 'goals board',
  checkBeforeRetry: 'List the goals before you try again.',
}

export const SUBAGENT_DENIAL =
  'Only the main conversation attaches and detaches TODO entries, since it keeps TODO.md. Name ' +
  'the entry and the goal in your result instead.'

export const MARK_SUBAGENT_DENIAL =
  'Only the main conversation marks goals as done and removes the marks: subagents are not sent ' +
  'the goals, so they cannot judge whether one is met. Name the goal and the evidence in your ' +
  'result instead.'

/** What the model is told for an evidence that is blank or missing. */
export const EVIDENCE_BLANK = `The evidence is blank. ${EVIDENCE_EXAMPLES}`

const NO_OPEN_GOAL =
  'The board of this session does not have an open goal. Only the user adds goals, with ' +
  `/${GOALS_COMMAND} ${ADD_WORD} or in the ${PANE_TITLE} pane.`

const SEE_OPEN_GOALS =
  `Call ${LIST_GOALS_TOOL} to see the open goals and the entries attached to them.`

/**
 * Added wherever the goals are sent to the model of the main conversation, so the model keeps the
 * work that is not on the board in view.
 */
const GOALS_NOT_EXHAUSTIVE =
  'The goals are not exhaustive. Requests from the conversation, entries in TODO.md and rules ' +
  'still apply. Continue working on tasks where you left off and keep working towards the goals.'

/**
 * `text` followed by `GOALS_NOT_EXHAUSTIVE` while `board` has an open goal. Without one, the
 * sentence would tell the model to keep working towards goals that the user cleared.
 */
export function withGoalsNotExhaustive(board: Board, text: string): string {
  return openGoalsOf(board).length === 0 ? text : `${text}\n\n${GOALS_NOT_EXHAUSTIVE}`
}

/** Who reads the goals: the main conversation, whose model sets the done marks, or a subagent. */
export enum GoalsReader {
  MainConversation = 'main-conversation',
  Subagent = 'subagent',
}

/** The line that shows a done mark on a goal to the model, by who reads it. */
export function describeDoneMarkForModel(mark: DoneMark, reader: GoalsReader): string {
  switch (reader) {
    case GoalsReader.MainConversation:
      return `Marked as done by you: ${mark.evidence}`
    case GoalsReader.Subagent:
      return `Marked as done by the main conversation: ${mark.evidence}`
  }
}

export function describeAttached(goal: number, todo: TodoEntry): string {
  return `Attached ${describeEntry(todo)} to goal #${goal}.`
}

export function describeDetached(goal: number, todoNumber: string): string {
  return `Detached #${todoNumber} from goal #${goal}.`
}

export function describeMarkedDone(goal: number): string {
  return `Marked goal #${goal} as done. It stays open until the user clears it.`
}

export function describeMarkRemovedForModel(goal: number): string {
  return `Removed your done mark from goal #${goal}.`
}

/** What the model is told of a refused change of a goal by a tool, by the cause. */
export function describeRefusal(refused: ChangeRefused | MarkRefused | UnmarkRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return describeGoalNotOpen(refused.goal)
    case Refusal.TodoNotAttached:
      return `#${refused.todo} is not attached to goal #${refused.goal}. ${SEE_OPEN_GOALS}`
    case Refusal.NotTodoNumber:
      return (
        `#${refused.todo} is not the number of an entry in TODO.md, which has numbers such as ` +
        '#12 or #12.3. Give the entry as its heading in TODO.md shows it.'
      )
    case Refusal.BlankTitle:
      return (
        'Give the TODO entry with its title after its number, as its heading in TODO.md shows ' +
        'it.'
      )
    case Refusal.BlankEvidence:
      return EVIDENCE_BLANK
    case Refusal.EvidenceNotOneLine:
      return (
        'Give the evidence on one line, without line breaks, tabs or other control characters. ' +
        EVIDENCE_EXAMPLES
      )
    case Refusal.EvidenceTooLong:
      return `Give the evidence in at most ${MAX_EVIDENCE_LENGTH} characters. ${EVIDENCE_EXAMPLES}`
    case Refusal.NotMarkedDone:
      return `Goal #${refused.goal} is not marked as done. ${SEE_OPEN_GOALS}`
  }
}

function describeGoalNotOpen(goal: number): string {
  return `Goal #${goal} is not open on the board of this session. ${SEE_OPEN_GOALS}`
}

/**
 * The open goals with their done marks and the entries attached to them, then the cleared goals,
 * each sorted by number, as written for `reader`.
 */
export function describeGoals(board: Board, reader: GoalsReader): string {
  const open = sortedByNumber(openGoalsOf(board))
  const cleared = sortedByNumber(clearedGoalsOf(board))

  return [
    open.length === 0 ? NO_OPEN_GOAL : open.map(goal => describeOpenGoal(goal, reader)).join('\n'),
    ...(cleared.length === 0
      ? []
      : [['Cleared by the user:', ...cleared.map(describeGoal)].join('\n')]),
  ].join('\n\n')
}

function describeOpenGoal(goal: Goal, reader: GoalsReader): string {
  const mark = doneMarkOf(goal)
  const attached = goal.todos.map(describeEntry).join(', ')

  return [
    describeGoal(goal),
    ...(mark === undefined ? [] : [describeDoneMarkForModel(mark, reader)]),
    ...(goal.todos.length === 0 ? [] : [`Attached: ${attached}`]),
  ].join('\n')
}

function describeGoal(goal: Goal): string {
  return `#${goal.number}: ${goal.text}`
}
