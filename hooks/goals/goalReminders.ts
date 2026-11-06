import type { Board, Goal } from '../../types'
import { sortedByNumber } from '../numbered'
import { isOpen, openGoalsOf } from './board'
import { PANE_TITLE } from './goalTexts'

/**
 * A text that gives the goals to the model, and the line in the transcript that shows it was sent.
 * The model does not read the line.
 */
export type GoalsSent = { text: string; line: string }

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
 * The open goals on `now` as `describeList` writes them, followed by the note on the goals added
 * and cleared since the model saw the board as `seen`. The list has no cleared goal in it, so the
 * note goes with it.
 */
export function describeOpenGoalsSent(
  now: Board,
  seen: Board | null,
  describeList: (board: Board) => string | undefined,
): GoalsSent | undefined {
  return describeSent(now, describeList(now), seen === null ? [] : changesSince(seen, now))
}

/**
 * The note on the goals added and cleared since the model saw the board as `seen`, or the open
 * goals on `now` for a model that saw no board yet.
 */
export function describeGoalChangesSent(seen: Board | null, now: Board): GoalsSent | undefined {
  return seen === null
    ? describeOpenGoalsSent(now, seen, describeOpenGoalsAfterCompaction)
    : describeSent(now, undefined, changesSince(seen, now))
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

enum ChangeKind {
  Added = 'added',
  Cleared = 'cleared',
}

/** How a change of each kind is written in the note to the model and in the transcript line. */
const CHANGE_TEXTS: Record<
  ChangeKind,
  { describeNote: (goal: Goal) => string; describeInLine: (goal: Goal) => string }
> = {
  [ChangeKind.Added]: {
    describeNote: goal => `The user added goal #${goal.number}: ${asSentence(goal.text)}`,
    describeInLine: goal => `goal ${goal.number} added`,
  },
  [ChangeKind.Cleared]: {
    describeNote: goal => `The user cleared goal #${goal.number}.`,
    describeInLine: goal => `goal ${goal.number} cleared`,
  },
}

/** Joins the changes in a transcript line, as in "goal 2 cleared and goal 3 added". */
const CHANGES_IN_LINE = new Intl.ListFormat('en', { type: 'conjunction' })

type GoalChange = { goal: Goal; kind: ChangeKind }

/**
 * The goals added and cleared since the model last saw the board as `seen`, sorted by number. A
 * goal is never removed from a board, so only the goals in `now` are compared.
 */
function changesSince(seen: Board, now: Board): GoalChange[] {
  const seenGoals = new Map(seen.goals.map(goal => [goal.id, goal]))

  return sortedByNumber(now.goals).flatMap(goal => changesOf(goal, seenGoals.get(goal.id)))
}

/** `seen` is the goal on the board the model last saw, if the goal was there. */
function changesOf(goal: Goal, seen: Goal | undefined): GoalChange[] {
  const added = seen === undefined ? [{ goal, kind: ChangeKind.Added }] : []
  const isNewlyCleared = !isOpen(goal) && (seen === undefined || isOpen(seen))
  const cleared = isNewlyCleared ? [{ goal, kind: ChangeKind.Cleared }] : []

  return [...added, ...cleared]
}

/** The open goals on `now` listed as `list`, if given, and the changes `changes` sent with them. */
function describeSent(
  now: Board,
  list: string | undefined,
  changes: readonly GoalChange[],
): GoalsSent | undefined {
  const texts = [list, describeChangeNote(now, changes)].filter(text => text !== undefined)
  if (texts.length === 0) {
    return undefined
  }
  const listedCount = list === undefined ? 0 : openGoalsOf(now).length

  return { text: texts.join('\n\n'), line: describeSentLine(listedCount, changes) }
}

function describeChangeNote(now: Board, changes: readonly GoalChange[]): string | undefined {
  if (changes.length === 0) {
    return undefined
  }
  const notes = changes.map(({ goal, kind }) => CHANGE_TEXTS[kind].describeNote(goal))
  const closing = openGoalsOf(now).length === 0 ? ['No goal is open now.'] : []

  return [...notes, ...closing].join(' ')
}

/** The transcript line for `listedCount` open goals and the changes `changes` sent to the model. */
function describeSentLine(listedCount: number, changes: readonly GoalChange[]): string {
  const changed = CHANGES_IN_LINE.format(
    changes.map(({ goal, kind }) => CHANGE_TEXTS[kind].describeInLine(goal)))
  if (listedCount === 0) {
    return `${PANE_TITLE}: ${changed}, sent to Claude`
  }
  const listed = listedCount === 1
    ? 'the open goal was sent to Claude'
    : `the ${listedCount} open goals were sent to Claude`

  return changes.length === 0
    ? `${PANE_TITLE}: ${listed}`
    : `${PANE_TITLE}: ${listed}, with ${changed}`
}

function asSentence(text: string): string {
  return /[.!?]$/u.test(text) ? text : `${text}.`
}
