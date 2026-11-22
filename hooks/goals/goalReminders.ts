import type { Board, Goal } from '../../types'
import { AND_LIST } from '../listFormat'
import type { TextWithLine } from '../sendToModel'
import { openGoalsByIdOf, openGoalsByPriorityOf, openGoalsOf } from './board'
import { ChangeKind, changesBetween } from './boardChanges'
import { MarkRemover } from './doneMark'
import { dependedGoalOf } from './dependency'
import type { OpenGoals } from './dependency'
import { nameGoalWithPriority, priorityTagOf } from './goalListTexts'
import { MARK_GOAL_DONE_TOOL } from './goalNames'
import { PANE_TITLE, nameGoal } from './goalPaneTexts'
import { describePriority, priorityOf } from './priority'
import { describeOpenGoalDetails } from './goalToolTexts'

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
 * The open goals of `board` as every list sent to the main conversation at `readAt` shows them: by
 * priority, with their priorities, their ages, the goals each of them depends on, their done marks
 * and the TODO entries attached to them.
 */
export function describeOpenGoalsList(board: Board, readAt: number): string | undefined {
  const goals = openGoalsByPriorityOf(board)
  const open = openGoalsByIdOf(board)

  return goals.length === 0
    ? undefined
    : [
        OPEN_GOALS_HEADING,
        ...goals.flatMap(goal => describeGoalWithTodos(open, goal, readAt)),
      ].join('\n')
}

/**
 * The open goals on `now` as `describeOpenGoalsList` returns them at `readAt`, followed by the note
 * on the goals added, edited, unmarked, prioritized, made dependent and cleared by the user since
 * the model saw the board as `seen`. The list contains only open goals, so the note is sent with
 * it.
 */
export function describeOpenGoalsSent(
  now: Board,
  seen: Board | null,
  readAt: number,
): TextWithLine | undefined {
  return describeSent(
    now,
    describeOpenGoalsList(now, readAt),
    seen === null ? [] : changesSince(seen, now),
  )
}

/**
 * The note on the goals added, edited, unmarked, prioritized, made dependent and cleared by the
 * user since the model saw the board as `seen`, or, for a model that has not seen a board yet, the
 * open goals on `now` read at `readAt`.
 */
export function describeGoalChangesSent(
  seen: Board | null,
  now: Board,
  readAt: number,
): TextWithLine | undefined {
  return seen === null
    ? describeOpenGoalsSent(now, seen, readAt)
    : describeSent(now, undefined, changesSince(seen, now))
}

function describeGoalWithTodos(open: OpenGoals, goal: Goal, readAt: number): string[] {
  const label = `${goal.number}. `
  const indent = ' '.repeat(label.length)
  const tag = priorityTagOf(goal)

  return [
    `${label}${tag === undefined ? '' : `${tag} `}${goal.text}`,
    ...describeOpenGoalDetails(open, goal, readAt).map(line => `${indent}${line}`),
  ]
}

function describeUnsatisfiedGoal(open: OpenGoals, goal: Goal, readAt: number): string {
  return [
    `${nameGoalWithPriority(goal)} is not satisfied yet: ${asSentence(goal.text)}`,
    ...describeOpenGoalDetails(open, goal, readAt).map(asSentence),
  ].join(' ')
}

/** The goals nudged in one prompt, at least one. */
export type GoalsToNudge = readonly [Goal, ...Goal[]]

/** The request to finish the goals and how to finish them, around the goals of a nudge. */
type NudgeTexts = { opening: string; closing: string }

const NUDGE_FOR_ONE_GOAL: NudgeTexts = {
  opening:
    'The user has noticed that the following goal has not been marked as done for quite a ' +
    'while, and would like you to work on it and bring it to completion.',
  closing:
    'Start working on the goal as soon as possible, without interrupting the current work. ' +
    'Either finish the goal cleanly and properly, as the rules require, or mark it as done with ' +
    `${MARK_GOAL_DONE_TOOL}, so the user can check the result. If the result of the goal is a ` +
    'draft, open the draft now. The user will not tolerate more delays that you cannot ' +
    'seriously explain and back with clear evidence of why you cannot complete the goal.',
}

const NUDGE_FOR_SEVERAL_GOALS: NudgeTexts = {
  opening:
    'The user has noticed that the following goals have not been marked as done for quite a ' +
    'while, and would like you to work on them and bring them to completion.',
  closing:
    'Start working on the goals as soon as possible, without interrupting the current work. ' +
    'Either finish each goal cleanly and properly, as the rules require, or mark that goal as ' +
    `done with ${MARK_GOAL_DONE_TOOL}, so the user can check the result. If the result of a goal ` +
    'is a draft, open the draft now. The user will not tolerate more delays that you cannot ' +
    'seriously explain and back with clear evidence of why you cannot complete the goals.',
}

/**
 * The prompt sent at `readAt` when the user presses Nudge on `goals`: one paragraph for each goal,
 * with its age, its dependency, its done mark and the TODO entries attached to it, between the
 * request to finish the goals and how to finish them.
 */
export function describeNudge(open: OpenGoals, goals: GoalsToNudge, readAt: number): string {
  const texts = goals.length === 1 ? NUDGE_FOR_ONE_GOAL : NUDGE_FOR_SEVERAL_GOALS

  return [
    texts.opening,
    ...goals.map(goal => describeUnsatisfiedGoal(open, goal, readAt)),
    texts.closing,
  ].join('\n\n')
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
      `The done mark on ${name} was removed, since ${name} depends on ${dependsOn}, which was ` +
      'not marked as done.'
    )
  }
  const removed = `The user removed the done mark from ${name}`
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
 * removed with them. The note contains changes by the user alone, so it leaves out the marks set by
 * the goal checker, and the removals by the model on a board stored before the goal checker.
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

function asSentence(text: string): string {
  return /[.!?]$/u.test(text) ? text : `${text}.`
}
