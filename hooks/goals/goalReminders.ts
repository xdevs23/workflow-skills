import type { Board, DoneMark, Goal } from '../../types'
import { AND_LIST } from '../listFormat'
import type { TextWithLine } from '../sendToModel'
import { openGoalsByIdOf, openGoalsByPriorityOf, openGoalsOf } from './board'
import { ChangeKind, changesBetween } from './boardChanges'
import { MarkRemover, doneMarkOf } from './doneMark'
import { dependedGoalOf, unfinishedDependencyOf } from './dependency'
import type { OpenGoals } from './dependency'
import { describeUnfinishedDependency, nameGoalWithPriority, priorityTagOf } from './goalListTexts'
import { PANE_TITLE, nameGoal } from './goalTexts'
import { describePriority, priorityOf } from './priority'
import { GoalsReader, describeDoneMarkForModel } from './goalToolTexts'
import { describeEntry, describeTodoNumber } from './todoEntry'

/** The toast for a board that could not be read for a reminder, with the failure from the store. */
export function describeReminderNotRead(storeFailure: string): string {
  return `The goals could not be read, so Claude was not reminded of them. ${storeFailure}`
}

/** The toast for open goals left unsent by a reminder, with the reason or the failure message. */
export function describeOpenGoalsNotSent(reason: string): string {
  return (
    `The open goals could not be sent to Claude: ${reason}. ` +
    'Ask Claude to list the goals to send them now.'
  )
}

const OPEN_GOALS_HEADING = '# Open goals, by priority (P0 most important)'

/**
 * The text sent to the main conversation after it compacts: the open goals by priority, with
 * their priorities, the goals each of them depends on, their done marks and their TODO entries.
 */
export function describeOpenGoalsAfterCompaction(board: Board): string | undefined {
  const goals = openGoalsByPriorityOf(board)
  const open = openGoalsByIdOf(board)

  return goals.length === 0
    ? undefined
    : [OPEN_GOALS_HEADING, ...goals.flatMap(goal => describeGoalWithTodos(open, goal))].join('\n')
}

/**
 * The first paragraph of the reminder sent after the idle minutes, while a goal is open without a
 * done mark. It tells the model to work on the goals.
 */
const IDLE_WITH_UNFINISHED_GOALS =
  'You are idle while goals are open. Pick up the work on them in this turn, P0 first. Do not ' +
  'end the turn on a status report.'

/**
 * The reminder sent once the model has been idle for a while opens with
 * `IDLE_WITH_UNFINISHED_GOALS` and then has one paragraph per open goal, in priority order. Goals
 * marked as done are left out of the opening, so the reminder does not ask for more work on a board
 * with only those goals.
 */
export function describeOpenGoalsAfterIdle(board: Board): string | undefined {
  const goals = openGoalsByPriorityOf(board)
  if (goals.length === 0) {
    return undefined
  }
  const opening = goals.some(goal => doneMarkOf(goal) === undefined)
    ? [IDLE_WITH_UNFINISHED_GOALS]
    : []
  const open = openGoalsByIdOf(board)

  return [...opening, ...goals.map(goal => describeUnsatisfiedGoal(open, goal))].join('\n\n')
}

/**
 * The open goals on `now` as `describeList` writes them, followed by the note on the goals added,
 * edited, unmarked, prioritized, made dependent and cleared by the user since the model saw the
 * board as `seen`. The list contains only open goals, so the note goes with it.
 */
export function describeOpenGoalsSent(
  now: Board,
  seen: Board | null,
  describeList: (board: Board) => string | undefined,
): TextWithLine | undefined {
  return describeSent(now, describeList(now), seen === null ? [] : changesSince(seen, now))
}

/**
 * The note on the goals added, edited, unmarked, prioritized, made dependent and cleared by the
 * user since the model saw the board as `seen`, or the open goals on `now` for a model that has
 * not seen a board yet.
 */
export function describeGoalChangesSent(seen: Board | null, now: Board): TextWithLine | undefined {
  return seen === null
    ? describeOpenGoalsSent(now, seen, describeOpenGoalsAfterCompaction)
    : describeSent(now, undefined, changesSince(seen, now))
}

function describeGoalWithTodos(open: OpenGoals, goal: Goal): string[] {
  const label = `${goal.number}. `
  const indent = ' '.repeat(label.length)
  const tag = priorityTagOf(goal)
  const unfinished = unfinishedDependencyOf(open, goal)
  const mark = doneMarkOf(goal)

  return [
    `${label}${tag === undefined ? '' : `${tag} `}${goal.text}`,
    ...(unfinished === undefined ? [] : [`${indent}${describeUnfinishedDependency(unfinished)}`]),
    ...(mark === undefined ? [] : [`${indent}${describeMarkToMainConversation(mark)}`]),
    ...goal.todos.map(todo => `${indent}${describeEntry(todo)}`),
  ]
}

function describeUnsatisfiedGoal(open: OpenGoals, goal: Goal): string {
  const unfinished = unfinishedDependencyOf(open, goal)
  const mark = doneMarkOf(goal)
  const attached = goal.todos
    .map(todo => `${describeTodoNumber(todo.number)} (${todo.title})`)
    .join(', ')

  return [
    `${nameGoalWithPriority(goal)} is not satisfied yet: ${asSentence(goal.text)}`,
    ...(unfinished === undefined ? [] : [describeUnfinishedDependency(unfinished)]),
    ...(mark === undefined ? [] : [asSentence(describeMarkToMainConversation(mark))]),
    ...(goal.todos.length === 0 ? [] : [`Attached: ${attached}.`]),
  ].join(' ')
}

/** The kinds of change sent to the model: the changes made by the user. */
type NotedKind =
  | ChangeKind.Added
  | ChangeKind.Edited
  | ChangeKind.MarkRemoved
  | ChangeKind.PriorityChanged
  | ChangeKind.DependencyChanged
  | ChangeKind.Cleared

/**
 * How a change of each kind is written in the note to the model and in the transcript line, for the
 * goal as the board `now` has it.
 */
const CHANGE_TEXTS: Record<
  NotedKind,
  {
    describeNote: (goal: Goal, now: Board) => string
    describeInLine: (goal: Goal, now: Board) => string
  }
> = {
  [ChangeKind.Added]: {
    describeNote: goal => `The user added ${nameGoal(goal.number)}: ${asSentence(goal.text)}`,
    describeInLine: goal => `${nameGoal(goal.number)} added`,
  },
  [ChangeKind.Edited]: {
    describeNote: goal => `The user edited ${nameGoal(goal.number)}: ${asSentence(goal.text)}`,
    describeInLine: goal => `${nameGoal(goal.number)} edited`,
  },
  [ChangeKind.MarkRemoved]: {
    describeNote: describeMarkRemovedNote,
    describeInLine: goal => `${nameGoal(goal.number)} unmarked`,
  },
  [ChangeKind.PriorityChanged]: {
    describeNote: describePriorityNote,
    describeInLine: goal =>
      `${nameGoal(goal.number)} priority ${priorityOf(goal) === undefined ? 'removed' : 'set'}`,
  },
  [ChangeKind.DependencyChanged]: {
    describeNote: describeDependencyNote,
    describeInLine: (goal, now) =>
      `${nameGoal(goal.number)} dependency ${
        dependedGoalOf(openGoalsByIdOf(now), goal) === undefined ? 'removed' : 'set'
      }`,
  },
  [ChangeKind.Cleared]: {
    describeNote: goal => `The user cleared ${nameGoal(goal.number)}.`,
    describeInLine: goal => `${nameGoal(goal.number)} cleared`,
  },
}

/**
 * The note on a done mark removed by the user, with the reason the user gave, or removed because
 * its dependency was not done.
 */
function describeMarkRemovedNote(goal: Goal): string {
  const name = nameGoal(goal.number)
  const removal = goal.markRemoval
  if (removal?.removedBy === MarkRemover.Dependency) {
    const dependsOn = nameGoal(removal.dependencyNumber)

    return (
      `Your done mark on ${name} was removed, since ${name} depends on ${dependsOn}, which was ` +
      'not marked as done.'
    )
  }
  const removed = `The user removed your done mark from ${name}`
  const reason = removal?.removedBy === MarkRemover.User ? removal.reason : undefined

  return reason === undefined
    ? `${removed}.`
    : `${removed}, with the reason: ${asSentence(reason)}`
}

/** The note on the priority the user set on a goal or removed from it. */
function describePriorityNote(goal: Goal): string {
  const priority = priorityOf(goal)
  const name = nameGoal(goal.number)

  return priority === undefined
    ? `The user removed the priority of ${name}.`
    : `The user set the priority of ${name} to ${describePriority(priority)}.`
}

/** The note on the dependency of a goal, set or removed by the user. */
function describeDependencyNote(goal: Goal, now: Board): string {
  const dependsOn = dependedGoalOf(openGoalsByIdOf(now), goal)
  const name = nameGoal(goal.number)

  return dependsOn === undefined
    ? `The user removed the dependency of ${name}.`
    : `The user made ${name} depend on ${nameGoal(dependsOn.number)}.`
}

/** A change sent to the model. */
type NotedChange = { goal: Goal; kind: NotedKind }

/**
 * The changes made by the user since the model last saw the board as `seen`, with the marks
 * removed with them. The model sets and removes its own marks, so the note leaves those out.
 */
function changesSince(seen: Board, now: Board): NotedChange[] {
  return changesBetween(seen, now).flatMap(({ goal, kind }): NotedChange[] => {
    switch (kind) {
      case ChangeKind.MarkSet:
        return []
      case ChangeKind.MarkRemoved:
        return goal.markRemoval?.removedBy === MarkRemover.Model ? [] : [{ goal, kind }]
      case ChangeKind.Added:
      case ChangeKind.Edited:
      case ChangeKind.PriorityChanged:
      case ChangeKind.DependencyChanged:
      case ChangeKind.Cleared:
        return [{ goal, kind }]
    }
  })
}

/** The open goals on `now` listed as `list`, if given, and the changes `changes` sent with them. */
function describeSent(
  now: Board,
  list: string | undefined,
  changes: readonly NotedChange[],
): TextWithLine | undefined {
  const texts = [list, describeChangeNote(now, changes)].filter(text => text !== undefined)
  if (texts.length === 0) {
    return undefined
  }
  const listedCount = list === undefined ? 0 : openGoalsOf(now).length

  return { text: texts.join('\n\n'), line: describeSentLine(now, listedCount, changes) }
}

function describeChangeNote(now: Board, changes: readonly NotedChange[]): string | undefined {
  if (changes.length === 0) {
    return undefined
  }
  const notes = changes.map(({ goal, kind }) => CHANGE_TEXTS[kind].describeNote(goal, now))
  const closing = openGoalsOf(now).length === 0 ? ['No goal is open now.'] : []

  return [...notes, ...closing].join(' ')
}

/**
 * The transcript line for `listedCount` open goals and the changes `changes` sent to the model, for
 * the board `now`.
 */
function describeSentLine(
  now: Board,
  listedCount: number,
  changes: readonly NotedChange[],
): string {
  const changed = AND_LIST.format(
    changes.map(({ goal, kind }) => CHANGE_TEXTS[kind].describeInLine(goal, now)))
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
