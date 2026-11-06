import type { Board, DoneMark, Goal } from '../../types'
import { sortedByNumber } from '../numbered'
import { ChangeKind, MarkRemover, changesBetween, doneMarkOf, openGoalsOf } from './board'
import { PANE_TITLE } from './goalTexts'
import { GoalsReader, describeDoneMarkForModel } from './goalToolTexts'

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

/**
 * The block added to the context after a compaction: the open goals with their done marks and
 * their TODO entries.
 */
export function describeOpenGoalsAfterCompaction(board: Board): string | undefined {
  const goals = sortedByNumber(openGoalsOf(board))

  return goals.length === 0
    ? undefined
    : ['# Open goals', ...goals.flatMap(describeGoalWithTodos)].join('\n')
}

/**
 * The first paragraph of the reminder sent after the idle minutes, while a goal is open without a
 * done mark. It tells the model to work on the goals.
 */
const IDLE_WITH_UNFINISHED_GOALS =
  'You are idle while goals are open. Pick up the work on them in this turn. Do not end the turn ' +
  'on a status report.'

/**
 * The reminder sent once the model has been idle for a while: one paragraph per open goal, after
 * `IDLE_WITH_UNFINISHED_GOALS` while a goal is open without a done mark. Goals marked done wait for
 * the user, so a board of only those does not ask for more work.
 */
export function describeOpenGoalsAfterIdle(board: Board): string | undefined {
  const goals = sortedByNumber(openGoalsOf(board))
  if (goals.length === 0) {
    return undefined
  }
  const opening = goals.some(goal => doneMarkOf(goal) === undefined)
    ? [IDLE_WITH_UNFINISHED_GOALS]
    : []

  return [...opening, ...goals.map(describeUnsatisfiedGoal)].join('\n\n')
}

/**
 * The open goals on `now` as `describeList` writes them, followed by the note on the goals added,
 * edited, unmarked by the user and cleared since the model saw the board as `seen`. The list has no
 * cleared goal in it, so the note goes with it.
 */
export function describeOpenGoalsSent(
  now: Board,
  seen: Board | null,
  describeList: (board: Board) => string | undefined,
): GoalsSent | undefined {
  return describeSent(now, describeList(now), seen === null ? [] : changesSince(seen, now))
}

/**
 * The note on the goals added, edited, unmarked by the user and cleared since the model saw the
 * board as `seen`, or the open goals on `now` for a model that saw no board yet.
 */
export function describeGoalChangesSent(seen: Board | null, now: Board): GoalsSent | undefined {
  return seen === null
    ? describeOpenGoalsSent(now, seen, describeOpenGoalsAfterCompaction)
    : describeSent(now, undefined, changesSince(seen, now))
}

function describeGoalWithTodos(goal: Goal): string[] {
  const label = `${goal.number}. `
  const indent = ' '.repeat(label.length)

  const mark = doneMarkOf(goal)

  return [
    `${label}${goal.text}`,
    ...(mark === undefined ? [] : [`${indent}${describeMarkToMainConversation(mark)}`]),
    ...goal.todos.map(todo => `${indent}#${todo.number} - ${todo.title}`),
  ]
}

function describeUnsatisfiedGoal(goal: Goal): string {
  const mark = doneMarkOf(goal)
  const attached = goal.todos.map(todo => `#${todo.number} (${todo.title})`).join(', ')

  return [
    `Goal #${goal.number} is not satisfied yet: ${asSentence(goal.text)}`,
    ...(mark === undefined ? [] : [asSentence(describeMarkToMainConversation(mark))]),
    ...(goal.todos.length === 0 ? [] : [`Attached: ${attached}.`]),
  ].join(' ')
}

/** The kinds of change sent to the model: the changes made by the user. */
type NotedKind = ChangeKind.Added | ChangeKind.Edited | ChangeKind.MarkRemoved | ChangeKind.Cleared

/** How a change of each kind is written in the note to the model and in the transcript line. */
const CHANGE_TEXTS: Record<
  NotedKind,
  { describeNote: (goal: Goal) => string; describeInLine: (goal: Goal) => string }
> = {
  [ChangeKind.Added]: {
    describeNote: goal => `The user added goal #${goal.number}: ${asSentence(goal.text)}`,
    describeInLine: goal => `goal ${goal.number} added`,
  },
  [ChangeKind.Edited]: {
    describeNote: goal => `The user edited goal #${goal.number}: ${asSentence(goal.text)}`,
    describeInLine: goal => `goal ${goal.number} edited`,
  },
  [ChangeKind.MarkRemoved]: {
    describeNote: describeMarkRemovedNote,
    describeInLine: goal => `goal ${goal.number} unmarked`,
  },
  [ChangeKind.Cleared]: {
    describeNote: goal => `The user cleared goal #${goal.number}.`,
    describeInLine: goal => `goal ${goal.number} cleared`,
  },
}

/** The note on a done mark removed by the user, with the reason the user gave, if any. */
function describeMarkRemovedNote(goal: Goal): string {
  const removed = `The user removed your done mark from goal #${goal.number}`
  const removal = goal.markRemoval
  const reason = removal?.removedBy === MarkRemover.User ? removal.reason : undefined

  return reason === undefined
    ? `${removed}.`
    : `${removed}, with the reason: ${asSentence(reason)}`
}

/** Joins the changes in a transcript line, as in "goal 2 cleared and goal 3 added". */
const CHANGES_IN_LINE = new Intl.ListFormat('en', { type: 'conjunction' })

/** A change sent to the model. */
type NotedChange = { goal: Goal; kind: NotedKind }

/**
 * The changes made by the user since the model last saw the board as `seen`. The model sets and
 * removes its own marks, so the note leaves those out.
 */
function changesSince(seen: Board, now: Board): NotedChange[] {
  return changesBetween(seen, now).flatMap(({ goal, ...change }): NotedChange[] => {
    switch (change.kind) {
      case ChangeKind.MarkSet:
        return []
      case ChangeKind.MarkRemoved:
        return change.removedBy === MarkRemover.User ? [{ goal, kind: change.kind }] : []
      case ChangeKind.Added:
      case ChangeKind.Edited:
      case ChangeKind.Cleared:
        return [{ goal, kind: change.kind }]
    }
  })
}

/** The open goals on `now` listed as `list`, if given, and the changes `changes` sent with them. */
function describeSent(
  now: Board,
  list: string | undefined,
  changes: readonly NotedChange[],
): GoalsSent | undefined {
  const texts = [list, describeChangeNote(now, changes)].filter(text => text !== undefined)
  if (texts.length === 0) {
    return undefined
  }
  const listedCount = list === undefined ? 0 : openGoalsOf(now).length

  return { text: texts.join('\n\n'), line: describeSentLine(listedCount, changes) }
}

function describeChangeNote(now: Board, changes: readonly NotedChange[]): string | undefined {
  if (changes.length === 0) {
    return undefined
  }
  const notes = changes.map(({ goal, kind }) => CHANGE_TEXTS[kind].describeNote(goal))
  const closing = openGoalsOf(now).length === 0 ? ['No goal is open now.'] : []

  return [...notes, ...closing].join(' ')
}

/** The transcript line for `listedCount` open goals and the changes `changes` sent to the model. */
function describeSentLine(listedCount: number, changes: readonly NotedChange[]): string {
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

/** The done mark as the main conversation reads it, the only reader of the reminders. */
function describeMarkToMainConversation(mark: DoneMark): string {
  return describeDoneMarkForModel(mark, GoalsReader.MainConversation)
}

function asSentence(text: string): string {
  return /[.!?]$/u.test(text) ? text : `${text}.`
}
