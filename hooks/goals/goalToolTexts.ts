import type { Board, Goal } from '../../types'
import type { HookSubject } from '../hookFailure'
import { sortedByNumber } from '../numbered'
import { Refusal, clearedGoalsOf, openGoalsOf } from './board'
import type { ChangeRefused } from './board'
import { ADD_WORD, GOALS_COMMAND, LIST_GOALS_TOOL } from './goalNames'
import { PANE_TITLE } from './goalTexts'
import { describeEntry } from './todoEntry'
import type { TodoEntry } from './todoEntry'

// The texts of the goals read by the model, with the tools they name.

export const LIST_GOALS_DESCRIPTION = [
  'Lists the goals set by the user on the goals board of this session: each open goal with its',
  'number and the TODO entries attached to it, then the goals cleared by the user. Only the user',
  'adds and clears goals. Goals of other sessions are not listed. The open goals are work waited',
  'for by the user. Check them before you report work as finished.',
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

/** The goals board, as written in the texts about a failed hook of a goal tool. */
export const GOAL_TOOLS_SUBJECT: HookSubject = {
  name: 'goals board',
  checkBeforeRetry: 'List the goals before you try again.',
}

export const SUBAGENT_DENIAL =
  'Only the main conversation attaches and detaches TODO entries, since it keeps TODO.md. Name ' +
  'the entry and the goal in your result instead.'

const NO_OPEN_GOAL =
  'The board of this session does not have an open goal. Only the user adds goals, with ' +
  `/${GOALS_COMMAND} ${ADD_WORD} or in the ${PANE_TITLE} pane.`

const SEE_OPEN_GOALS =
  `Call ${LIST_GOALS_TOOL} to see the open goals and the entries attached to them.`

export function describeAttached(goal: number, todo: TodoEntry): string {
  return `Attached ${describeEntry(todo)} to goal #${goal}.`
}

export function describeDetached(goal: number, todoNumber: string): string {
  return `Detached #${todoNumber} from goal #${goal}.`
}

/** What the model is told of a refused change of the TODO entries of a goal, by the cause. */
export function describeRefusal(refused: ChangeRefused): string {
  switch (refused.refusal) {
    case Refusal.GoalNotOpen:
      return `Goal #${refused.goal} is not open on the board of this session. ${SEE_OPEN_GOALS}`
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
  }
}

/** The open goals with their entries, then the cleared goals, each in the order of the numbers. */
export function describeGoals(board: Board): string {
  const open = sortedByNumber(openGoalsOf(board))
  const cleared = sortedByNumber(clearedGoalsOf(board))

  return [
    open.length === 0 ? NO_OPEN_GOAL : open.map(describeOpenGoal).join('\n'),
    ...(cleared.length === 0
      ? []
      : [['Cleared by the user:', ...cleared.map(describeGoal)].join('\n')]),
  ].join('\n\n')
}

function describeOpenGoal(goal: Goal): string {
  return goal.todos.length === 0
    ? describeGoal(goal)
    : `${describeGoal(goal)}\nAttached: ${goal.todos.map(describeEntry).join(', ')}`
}

function describeGoal(goal: Goal): string {
  return `#${goal.number}: ${goal.text}`
}
