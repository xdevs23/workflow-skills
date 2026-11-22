import type { Board, DoneMark, Goal } from '../../types'
import { describeElapsedTime } from '../elapsedTime'
import type { HookSubject } from '../hookFailure'
import { LOOK_UP_TERMS_AND_RULES } from '../lookUpTermsAndRules'
import { sortedByNumber } from '../numbered'
import {
  Refusal,
  clearedGoalsOf,
  openGoalsByIdOf,
  openGoalsByPriorityOf,
  openGoalsOf,
} from './board'
import type { ChangeRefused } from './board'
import { doneMarkOf } from './doneMark'
import { unfinishedDependencyOf } from './dependency'
import type { OpenGoals } from './dependency'
import { describeGoalWithPriority, describeUnfinishedDependency } from './goalListTexts'
import { LIST_GOALS_TOOL } from './goalNames'
import { PANE_TITLE, nameGoal } from './goalPaneTexts'
import { describeGoal } from './goalTexts'
import { describeEntry, describeTodoNumber } from './todoEntry'
import type { TodoEntry } from './todoEntry'

// The texts of the goals read by the model, with the tool that lists them.

export const LIST_GOALS_DESCRIPTION = [
  'Lists the goals set by the user on the goals board of this session: each open goal with its',
  'number, its priority if the user set one, how long it has been open, the goal it depends on',
  'while that goal is not marked as done, its done mark if the open goal has one, and the TODO',
  'entries attached to the open goal, then the goals cleared by the user. The open goals are',
  'listed by priority, P0 the most important and goals',
  'without a priority last. Only the user adds, edits, prioritizes and clears goals, and sets',
  'which goal depends on which. Goals of other sessions are not listed. The open goals are work',
  'the user needs done. Check them before you report work as finished. After you have been idle',
  'for a while, a fresh agent checks the open goals against the project and marks each goal it',
  'finds done.',
].join(' ')

export const ATTACH_TODO_DESCRIPTION = [
  'Attaches a TODO entry to an open goal of the goals board of this session, to record that the',
  'goal needs that entry built. Give the number of the goal, and the entry with its number and',
  'title as its heading in TODO.md shows the entry. An entry may be needed by several goals.',
  'Attached',
  'again under the same number, an entry gets the new text. You cannot add or clear a goal: only',
  'the user does.',
].join(' ')

export const DETACH_TODO_DESCRIPTION = [
  'Detaches a TODO entry from an open goal of the goals board of this session, once the entry is',
  'deleted from TODO.md or is no longer needed by the goal. Give the number of the goal, and the',
  'entry by its number, such as #12 or #12.3. Every entry in TODO.md has a number.',
].join(' ')

/** The goals board, as written in the texts about a failed hook of a goal tool. */
export const GOAL_TOOLS_SUBJECT: HookSubject = {
  name: 'goals board',
  checkBeforeRetry: 'List the goals before you try again.',
}

export const SUBAGENT_DENIAL =
  'Only the main conversation attaches and detaches TODO entries, since it keeps TODO.md. Name ' +
  'the entry and the goal in your result instead.'

const NO_OPEN_GOAL =
  'The board of this session does not have an open goal. Only the user adds goals, in the ' +
  `${PANE_TITLE} pane.`

const SEE_OPEN_GOALS =
  `Call ${LIST_GOALS_TOOL} to see the open goals and the entries attached to them.`

/**
 * Added wherever the goals are sent to the model of the main conversation, so the model keeps the
 * work that is not on the board in view.
 */
const GOALS_NOT_EXHAUSTIVE =
  'The goals are not exhaustive. Requests from the conversation, entries in TODO.md and rules ' +
  'still apply. Continue working on tasks where you left off and keep working towards the goals.'

const NOTES_ON_OPEN_GOALS = [GOALS_NOT_EXHAUSTIVE, LOOK_UP_TERMS_AND_RULES]

/**
 * `text` followed by `NOTES_ON_OPEN_GOALS` while `board` has an open goal. Without one, the model
 * would read the notes as a request to keep working towards goals that the user cleared.
 */
export function withNotesOnOpenGoals(board: Board, text: string): string {
  return openGoalsOf(board).length === 0 ? text : [text, ...NOTES_ON_OPEN_GOALS].join('\n\n')
}

/** The line that shows a done mark on a goal to the model. */
export function describeDoneMarkForModel(mark: DoneMark): string {
  return `Marked as done: ${mark.evidence}`
}

export function describeAttached(goal: number, todo: TodoEntry): string {
  return `Attached ${describeEntry(todo)} to ${nameGoal(goal)}.`
}

export function describeDetached(goal: number, todoNumber: string): string {
  return `Detached ${describeTodoNumber(todoNumber)} from ${nameGoal(goal)}.`
}

/** What the model is told of a refused change of a goal by a tool, by the cause. */
export function describeRefusal(refused: ChangeRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return describeGoalNotOpen(refused.goal)
    case Refusal.TodoNotAttached:
      return (
        `${describeTodoNumber(refused.todo)} is not attached to ${nameGoal(refused.goal)}. ` +
        SEE_OPEN_GOALS
      )
    case Refusal.NotTodoNumber:
      return (
        `${describeTodoNumber(refused.todo)} is not the number of an entry in TODO.md, which ` +
        'has numbers such as #12 or #12.3. Give the entry as its heading in TODO.md shows the ' +
        'entry.'
      )
    case Refusal.BlankTitle:
      return (
        'Give the TODO entry with its title after its number, as its heading in TODO.md shows ' +
        'the entry.'
      )
  }
}

function describeGoalNotOpen(goal: number): string {
  return `${nameGoal(goal)} is not open on the board of this session. ${SEE_OPEN_GOALS}`
}

/**
 * The line that shows the model how long an open goal has been open at `readAt`, such as "Open for
 * 13 days, since Nov 9." and "Open for less than a minute, since 06:10."
 */
export function describeAgeForModel(goal: Goal, readAt: number): string {
  const { elapsed, start } = describeElapsedTime(goal.addedAt, readAt)

  return `Open for ${elapsed}, since ${start}.`
}

/**
 * The lines that show the model `goal`, an open goal of `open`, below its text at `readAt`: its
 * age, the goal it depends on while that goal is not marked as done, its done mark and the TODO
 * entries attached to it.
 */
export function describeOpenGoalDetails(open: OpenGoals, goal: Goal, readAt: number): string[] {
  const unfinished = unfinishedDependencyOf(open, goal)
  const mark = doneMarkOf(goal)
  const attached = goal.todos.map(describeEntry).join(', ')

  return [
    describeAgeForModel(goal, readAt),
    ...(unfinished === undefined ? [] : [describeUnfinishedDependency(unfinished)]),
    ...(mark === undefined ? [] : [describeDoneMarkForModel(mark)]),
    ...(goal.todos.length === 0 ? [] : [`Attached: ${attached}`]),
  ]
}

/**
 * The open goals by priority at `readAt`, with their ages, the goals each of them depends on, their
 * done marks and the entries attached to them, then the cleared goals by number.
 */
export function describeGoals(board: Board, readAt: number): string {
  const open = openGoalsByPriorityOf(board)
  const cleared = sortedByNumber(clearedGoalsOf(board))
  const byId = openGoalsByIdOf(board)

  return [
    open.length === 0
      ? NO_OPEN_GOAL
      : open.map(goal => describeOpenGoal(byId, goal, readAt)).join('\n'),
    ...(cleared.length === 0
      ? []
      : [['Cleared by the user:', ...cleared.map(describeGoal)].join('\n')]),
  ].join('\n\n')
}

function describeOpenGoal(open: OpenGoals, goal: Goal, readAt: number): string {
  return [describeGoalWithPriority(goal), ...describeOpenGoalDetails(open, goal, readAt)].join('\n')
}
