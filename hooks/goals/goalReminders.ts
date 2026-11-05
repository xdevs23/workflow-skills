import type { Board, Goal } from '../../types'
import { sortedByNumber } from '../numbered'
import { isOpen, openGoalsOf } from './board'

/** The toast for a board that could not be read for a reminder, with the failure from the store. */
export function describeReminderNotRead(storeFailure: string): string {
  return `The goals could not be read, so Claude was not reminded of them. ${storeFailure}`
}

/** The toast for an idle reminder that failed, with the message of the failure. */
export function describeIdleReminderFailed(message: string): string {
  return (
    `The open goals could not be sent to Claude after the idle minutes: ${message}. ` +
    'Claude reads them after the next compaction, or when you ask it to list the goals.'
  )
}

/** The block added to the context after a compaction: the open goals with their TODO entries. */
export function describeOpenGoalsAfterCompaction(board: Board): string | undefined {
  const goals = sortedByNumber(openGoalsOf(board))

  return goals.length === 0
    ? undefined
    : ['# Open goals', ...goals.flatMap(describeGoalWithTodos)].join('\n')
}

/** The reminder sent once the model has been idle for a while: one paragraph per open goal. */
export function describeOpenGoalsAfterIdle(board: Board): string | undefined {
  const goals = sortedByNumber(openGoalsOf(board))

  return goals.length === 0 ? undefined : goals.map(describeUnsatisfiedGoal).join('\n\n')
}

/**
 * The note on the goals added and cleared since the model last saw the board as `seen`. A goal is
 * never removed from a board, so only the goals in `now` are compared.
 */
export function describeGoalChanges(seen: Board, now: Board): string | undefined {
  const seenGoals = new Map(seen.goals.map(goal => [goal.id, goal]))
  const notes = sortedByNumber(now.goals).flatMap(
    goal => describeChangesOf(goal, seenGoals.get(goal.id)))
  if (notes.length === 0) {
    return undefined
  }
  const closing = openGoalsOf(now).length === 0 ? ['No goal is open now.'] : []

  return [...notes, ...closing].join(' ')
}

function describeGoalWithTodos(goal: Goal): string[] {
  const label = `${goal.number}. `
  const indent = ' '.repeat(label.length)

  return [
    `${label}${goal.text}`,
    ...goal.todos.map(todo => `${indent}#${todo.number} - ${todo.title}`),
  ]
}

function describeUnsatisfiedGoal(goal: Goal): string {
  const unsatisfied = `Goal #${goal.number} is not satisfied yet: ${asSentence(goal.text)}`
  if (goal.todos.length === 0) {
    return unsatisfied
  }
  const attached = goal.todos.map(todo => `#${todo.number} (${todo.title})`).join(', ')

  return `${unsatisfied} Attached: ${attached}.`
}

/** `seen` is the goal on the board the model last saw, if the goal was there. */
function describeChangesOf(goal: Goal, seen: Goal | undefined): string[] {
  const added =
    seen === undefined ? [`The user added goal #${goal.number}: ${asSentence(goal.text)}`] : []
  const isNewlyCleared = !isOpen(goal) && (seen === undefined || isOpen(seen))
  const cleared = isNewlyCleared ? [`The user cleared goal #${goal.number}.`] : []

  return [...added, ...cleared]
}

function asSentence(text: string): string {
  return /[.!?]$/u.test(text) ? text : `${text}.`
}
