import type { AttachedTodo, Board, DoneMark, Goal, MarkRemoval } from '../../types'
import { sortedByNumber } from '../numbered'
import { isTodoNumber } from './todoEntry'

// The rules of a board: every goal has a number of its own, and no goal gets the number of another
// goal again, also after that goal was cleared, since cleared goals are never removed from the
// board. A goal has one entry for each TODO number. Only the model marks a goal as done, and the
// goal stays open with the mark until the user clears it.

// A product choice: the evidence is one thing for the user to look at, such as a file, a
// worktree, a branch or a version.
export const MAX_EVIDENCE_LENGTH = 80

/**
 * The characters that break the one line of an evidence or control the terminal it is shown in:
 * the control characters, tab and line feed among them, and the separators of lines and
 * paragraphs. Written as the inside of a character class, for the board and the tool input alike.
 */
export const LINE_BREAKING_CHARACTERS = '\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029'

const LINE_BREAKING = new RegExp(`[${LINE_BREAKING_CHARACTERS}]`)

/** What became of a read or a change of a board. */
export enum Outcome {
  Read = 'read',
  Changed = 'changed',
  Unchanged = 'unchanged',
  Refused = 'refused',
  Failed = 'failed',
}

/** Why a change was refused. A refused change leaves the board as it was. */
export enum Refusal {
  BlankText = 'blank-text',
  BlankTitle = 'blank-title',
  BlankEvidence = 'blank-evidence',
  EvidenceNotOneLine = 'evidence-not-one-line',
  EvidenceTooLong = 'evidence-too-long',
  GoalNotOpen = 'goal-not-open',
  NotMarkedDone = 'not-marked-done',
  NotTodoNumber = 'not-todo-number',
  NumberTaken = 'number-taken',
  TodoNotAttached = 'todo-not-attached',
}

/** Who removed a done mark. */
export enum MarkRemover {
  User = 'user',
  Model = 'model',
}

/** The refusal of adding a goal, with the number expected for it. */
export type AddRefused = { outcome: Outcome.Refused } & (
  | { refusal: Refusal.BlankText }
  | { refusal: Refusal.NumberTaken; goal: number }
)

/** A refused change of a goal on the board, with the numbers named by it. */
export type ChangeRefused = { outcome: Outcome.Refused } & (
  | { refusal: Refusal.BlankTitle }
  | { refusal: Refusal.GoalNotOpen; goal: number }
  | { refusal: Refusal.NotTodoNumber; todo: string }
  | { refusal: Refusal.TodoNotAttached; goal: number; todo: string }
)

/** The refusal of a change of a goal whose number is not the number of an open goal. */
type NotOpenRefused = Extract<ChangeRefused, { refusal: Refusal.GoalNotOpen }>

/** The refusal of an edit of a goal: a blank text, or a number that is not of an open goal. */
export type EditRefused = Extract<AddRefused, { refusal: Refusal.BlankText }> | NotOpenRefused

/**
 * The refusal of a done mark: a blank evidence, one over several lines or too long, or a goal that
 * is not open.
 */
export type MarkRefused =
  | {
      outcome: Outcome.Refused
      refusal: Refusal.BlankEvidence | Refusal.EvidenceNotOneLine | Refusal.EvidenceTooLong
    }
  | NotOpenRefused

/**
 * The refusal of removing a done mark: a goal that is not open, or a goal without the mark to
 * remove.
 */
export type UnmarkRefused =
  | { outcome: Outcome.Refused; refusal: Refusal.NotMarkedDone; goal: number }
  | NotOpenRefused

export type Read = { outcome: Outcome.Read; board: Board }

/** The board after a change, with the goal as changed by it. */
export type Changed<Changing extends Goal = Goal> = {
  outcome: Outcome.Changed
  board: Board
  goal: Changing
}

export type Unchanged = { outcome: Outcome.Unchanged; board: Board }

export type BoardChange = Changed | Unchanged | ChangeRefused

/** Every outcome of a change of a goal other than the change itself. */
export type NotChanged = Unchanged | ChangeRefused | EditRefused | MarkRefused | UnmarkRefused

/** A goal with a done mark, removed or not, as a mark leaves it. */
export type MarkedGoal = Goal & { doneMark: DoneMark }

/** A goal with the removal of a done mark, as a removal leaves it. */
export type UnmarkedGoal = Goal & { markRemoval: MarkRemoval }

/** A goal as changed by a change of the board. */
type ChangedGoal<Changing extends Goal> = { outcome: Outcome.Changed; goal: Changing }

export const EMPTY_BOARD: Board = { goals: [] }

export function isOpen(goal: Goal): boolean {
  return goal.clearedAt === undefined
}

export function openGoalsOf(board: Board): Goal[] {
  return board.goals.filter(isOpen)
}

export function clearedGoalsOf(board: Board): Goal[] {
  return board.goals.filter(goal => !isOpen(goal))
}

/** The done mark of `goal` while it has one: set by the model and not removed since. */
export function doneMarkOf(goal: Goal): DoneMark | undefined {
  const mark = goal.doneMark

  return mark?.markedAt === goal.markRemoval?.markedAt ? undefined : mark
}

/** Whether the goal with the id `goalId` is on the board and open. */
export function isGoalOpen(board: Board, goalId: string): boolean {
  return openGoalsOf(board).some(goal => goal.id === goalId)
}

/**
 * The board with every goal added, edited, marked or cleared in either of two copies of the board,
 * which may have been read in any order. For a goal open in `first`, the TODO entries come from
 * `second`, the text of the later edit, and the done mark changed later. Goals are never removed
 * and clears never undone, so no copy undoes a change.
 */
export function combinedBoardOf(first: Board, second: Board): Board {
  const inSecond = new Map(second.goals.map(goal => [goal.id, goal]))
  const inFirst = new Set(first.goals.map(goal => goal.id))

  return {
    goals: [
      ...first.goals.map(goal =>
        isOpen(goal) ? withLaterChangesOf(inSecond.get(goal.id) ?? goal, goal) : goal,
      ),
      ...second.goals.filter(goal => !inFirst.has(goal.id)),
    ],
  }
}

/**
 * `goal` with the text, the done mark and the removal of a done mark of `other`, each where `other`
 * changed it later.
 */
function withLaterChangesOf(goal: Goal, other: Goal): Goal {
  return withLaterRemovalOf(withLaterMarkOf(withLaterTextOf(goal, other), other), other)
}

/** `goal` with the text of `other` when `other` was edited after `goal`. */
function withLaterTextOf(goal: Goal, other: Goal): Goal {
  const { text, editedAt } = other
  if (editedAt === undefined || editedAt <= (goal.editedAt ?? -Infinity)) {
    return goal
  }

  return { ...goal, text, editedAt }
}

/** `goal` with the done mark of `other` when `other` was marked after `goal`. */
function withLaterMarkOf(goal: Goal, other: Goal): Goal {
  const { doneMark } = other
  if (doneMark === undefined || doneMark.markedAt <= (goal.doneMark?.markedAt ?? -Infinity)) {
    return goal
  }

  return { ...goal, doneMark }
}

/** `goal` with the removal of a done mark of `other` when `other` removed a mark after `goal`. */
function withLaterRemovalOf(goal: Goal, other: Goal): Goal {
  const { markRemoval } = other
  const removedBefore = goal.markRemoval?.removedAt ?? -Infinity
  if (markRemoval === undefined || markRemoval.removedAt <= removedBefore) {
    return goal
  }

  return { ...goal, markRemoval }
}

/** The kinds of change of a goal between two copies of a board. */
export enum ChangeKind {
  Added = 'added',
  Edited = 'edited',
  MarkSet = 'mark-set',
  MarkRemoved = 'mark-removed',
  Cleared = 'cleared',
}

/** A change of `goal`, which is the goal as the later copy of the board has it. */
export type GoalChange = { goal: Goal } & (
  | { kind: ChangeKind.Added | ChangeKind.Edited | ChangeKind.MarkSet | ChangeKind.Cleared }
  | { kind: ChangeKind.MarkRemoved; removedBy: MarkRemover }
)

/**
 * The changes of the goals from the copy `before` of a board to the later copy `after`, in the
 * order of the numbers of the goals. A goal is never removed from a board, so only the goals in
 * `after` are compared.
 */
export function changesBetween(before: Board, after: Board): GoalChange[] {
  const inBefore = new Map(before.goals.map(goal => [goal.id, goal]))

  return sortedByNumber(after.goals).flatMap(goal => changesOf(inBefore.get(goal.id), goal))
}

/** The changes from `earlier`, the goal in the earlier copy if it was there, to `goal`. */
function changesOf(earlier: Goal | undefined, goal: Goal): GoalChange[] {
  const mark = goal.doneMark
  const removal = goal.markRemoval
  const isAdded = earlier === undefined
  const isEdited = earlier !== undefined && earlier.text !== goal.text
  const isMarkSet = mark !== undefined && mark.markedAt !== earlier?.doneMark?.markedAt
  const isMarkRemoved =
    removal !== undefined && removal.removedAt !== earlier?.markRemoval?.removedAt
  const isCleared = !isOpen(goal) && (earlier === undefined || isOpen(earlier))

  return [
    ...(isAdded ? [{ goal, kind: ChangeKind.Added } as const] : []),
    ...(isEdited ? [{ goal, kind: ChangeKind.Edited } as const] : []),
    ...(isMarkSet ? [{ goal, kind: ChangeKind.MarkSet } as const] : []),
    ...(isMarkRemoved
      ? [{ goal, kind: ChangeKind.MarkRemoved, removedBy: removal.removedBy } as const]
      : []),
    ...(isCleared ? [{ goal, kind: ChangeKind.Cleared } as const] : []),
  ]
}

/**
 * `board` with each goal changed between the copies `before` and `after` set back to the goal in
 * `before`, or left out when `before` does not have it. Goals changed after `after` stay as `board`
 * has them.
 */
export function boardWithChangesTakenBack(board: Board, before: Board, after: Board): Board {
  const inBefore = new Map(before.goals.map(goal => [goal.id, goal]))
  const changed = new Set(changesBetween(before, after).map(({ goal }) => goal.id))

  return {
    goals: board.goals.flatMap(goal => {
      if (!changed.has(goal.id)) {
        return [goal]
      }
      const earlier = inBefore.get(goal.id)

      return earlier === undefined ? [] : [earlier]
    }),
  }
}

/** The number of a new goal: one above the highest number on the board. */
export function nextGoalNumberOf(board: Board): number {
  return board.goals.reduce((highest, goal) => Math.max(highest, goal.number), 0) + 1
}

/**
 * Whether a goal listed before `goal` on the board has its number. Of two goals with one number,
 * the goal listed first has it.
 */
export function isNumberTaken(goal: Goal, board: Board): boolean {
  const position = board.goals.findIndex(other => other.id === goal.id)
  const listedBefore = position === -1 ? board.goals : board.goals.slice(0, position)

  return listedBefore.some(other => other.number === goal.number)
}

/**
 * The board without the goals whose number is taken. Such a goal was added at the same moment as
 * the goal holding its number, and the change that added it is still giving it the next free number.
 */
export function settledBoardOf(board: Board): Board {
  return { goals: board.goals.filter(goal => !isNumberTaken(goal, board)) }
}

/**
 * Adds the goal under the next number of the board. With `expectedNumber`, the add is refused
 * unless the goal gets that number.
 */
export function addGoal(
  board: Board,
  goal: Pick<Goal, 'id' | 'text'>,
  addedAt: number,
  expectedNumber?: number,
): Changed | AddRefused {
  const text = goal.text.trim()
  if (text === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankText }
  }
  const number = nextGoalNumberOf(board)
  if (expectedNumber !== undefined && expectedNumber !== number) {
    return { outcome: Outcome.Refused, refusal: Refusal.NumberTaken, goal: expectedNumber }
  }
  const added = { id: goal.id, number, text, addedAt, todos: [] }

  return { outcome: Outcome.Changed, board: { goals: [...board.goals, added] }, goal: added }
}

export function clearGoal(
  board: Board,
  number: number,
  clearedAt: number,
): Changed | ChangeRefused {
  return changeOpenGoal<ChangeRefused>(board, number, goal => ({
    outcome: Outcome.Changed,
    goal: { ...goal, clearedAt },
  }))
}

/**
 * Gives the open goal numbered `number` the text `text`. The goal keeps its number, its TODO
 * entries and its place on the board. A done mark of the goal was set for the text before the
 * edit, so the edit removes it, as removed by the user. An edit to the text already set changes
 * nothing.
 */
export function editGoal(
  board: Board,
  number: number,
  text: string,
  editedAt: number,
): Changed | Unchanged | EditRefused {
  const edited = text.trim()
  if (edited === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankText }
  }

  return changeOpenGoal<Unchanged>(board, number, goal =>
    goal.text === edited
      ? { outcome: Outcome.Unchanged, board }
      : {
          outcome: Outcome.Changed,
          goal: { ...withoutDoneMark(goal, editedAt), text: edited, editedAt },
        },
  )
}

/** `goal` with its done mark removed by the user at `removedAt`, if it has one. */
function withoutDoneMark(goal: Goal, removedAt: number): Goal {
  const mark = doneMarkOf(goal)
  if (mark === undefined) {
    return goal
  }
  const markRemoval = { markedAt: mark.markedAt, removedAt, removedBy: MarkRemover.User }

  return { ...goal, markRemoval }
}

/**
 * Marks the open goal numbered `number` as done with `evidence`, in place of any mark already on
 * it. A mark with the evidence already on the goal changes nothing.
 */
export function markGoalDone(
  board: Board,
  number: number,
  evidence: string,
  markedAt: number,
): Changed<MarkedGoal> | Unchanged | MarkRefused {
  const trimmed = evidence.trim()
  if (trimmed === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankEvidence }
  }
  if (LINE_BREAKING.test(trimmed)) {
    return { outcome: Outcome.Refused, refusal: Refusal.EvidenceNotOneLine }
  }
  // Counted in code points, as the length in a JSON schema is.
  if ([...trimmed].length > MAX_EVIDENCE_LENGTH) {
    return { outcome: Outcome.Refused, refusal: Refusal.EvidenceTooLong }
  }

  return changeOpenGoal<Unchanged, MarkedGoal>(board, number, goal =>
    doneMarkOf(goal)?.evidence === trimmed
      ? { outcome: Outcome.Unchanged, board }
      : { outcome: Outcome.Changed, goal: { ...goal, doneMark: { evidence: trimmed, markedAt } } },
  )
}

/**
 * Removes the done mark of the open goal numbered `number`. With `markedAt`, only the mark set at
 * that time is removed, so a press on a mark drawn before the model set a new one leaves the new
 * one.
 */
export function removeDoneMark(
  board: Board,
  number: number,
  removal: Omit<MarkRemoval, 'markedAt'>,
  markedAt?: number,
): Changed<UnmarkedGoal> | UnmarkRefused {
  return changeOpenGoal<UnmarkRefused, UnmarkedGoal>(board, number, goal => {
    const mark = doneMarkOf(goal)

    return mark === undefined || (markedAt !== undefined && mark.markedAt !== markedAt)
      ? { outcome: Outcome.Refused, refusal: Refusal.NotMarkedDone, goal: number }
      : {
          outcome: Outcome.Changed,
          goal: { ...goal, markRemoval: { ...removal, markedAt: mark.markedAt } },
        }
  })
}

/**
 * Attaches the TODO entry to the open goal numbered `goalNumber`. An entry attached under the same
 * TODO number is replaced in its place by the entry with the newer title.
 */
export function attachTodo(
  board: Board,
  goalNumber: number,
  todo: Pick<AttachedTodo, 'number' | 'title'>,
  attachedAt: number,
): BoardChange {
  if (!isTodoNumber(todo.number)) {
    return { outcome: Outcome.Refused, refusal: Refusal.NotTodoNumber, todo: todo.number }
  }
  if (todo.title.trim() === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankTitle }
  }

  return changeOpenGoal(board, goalNumber, goal => {
    const attached = goal.todos.find(each => each.number === todo.number)
    if (attached?.title === todo.title) {
      return { outcome: Outcome.Unchanged, board }
    }
    const entry = { number: todo.number, title: todo.title, attachedAt }
    const todos =
      attached === undefined
        ? [...goal.todos, entry]
        : goal.todos.map(each => (each.number === todo.number ? entry : each))

    return { outcome: Outcome.Changed, goal: { ...goal, todos } }
  })
}

export function detachTodo(board: Board, goalNumber: number, todoNumber: string): BoardChange {
  return changeOpenGoal<ChangeRefused>(board, goalNumber, goal =>
    goal.todos.some(each => each.number === todoNumber)
      ? {
          outcome: Outcome.Changed,
          goal: { ...goal, todos: goal.todos.filter(each => each.number !== todoNumber) },
        }
      : {
          outcome: Outcome.Refused,
          refusal: Refusal.TodoNotAttached,
          goal: goalNumber,
          todo: todoNumber,
        },
  )
}

/**
 * Passes the open goal numbered `number` to `change`, and puts the goal returned by `change` in its
 * place. Returns a refusal when no open goal has that number. Every other outcome of `change` is
 * returned as it is, so the outcomes of a change of the board are the ones `change` can return.
 */
function changeOpenGoal<Other extends NotChanged, Changing extends Goal = Goal>(
  board: Board,
  number: number,
  change: (goal: Goal) => ChangedGoal<Changing> | Other,
): Changed<Changing> | NotOpenRefused | Other {
  const goal = openGoalsOf(board).find(each => each.number === number)
  if (goal === undefined) {
    return { outcome: Outcome.Refused, refusal: Refusal.GoalNotOpen, goal: number }
  }
  const changed = change(goal)
  if (changed.outcome !== Outcome.Changed) {
    return changed
  }
  const goals = board.goals.map(each => (each.id === goal.id ? changed.goal : each))

  return { outcome: Outcome.Changed, board: { goals }, goal: changed.goal }
}
