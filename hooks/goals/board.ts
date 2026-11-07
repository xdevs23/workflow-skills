import type { AttachedTodo, Board, Goal, Setting } from '../../types'
import {
  closesLoop,
  dependedGoalOf,
  goalsUnmarkedForDependency,
  unfinishedDependencyOf,
} from './dependency'
import type { OpenGoals } from './dependency'
import { MarkRemover, doneMarkOf, unmarkedGoalOf } from './doneMark'
import type { MarkRemovalAsked, MarkedGoal, UnmarkedGoal } from './doneMark'
import { priorityOf, sortedByPriority } from './priority'
import type { Priority } from './priority'
import { settingOf } from './setting'
import { isTodoNumber } from './todoEntry'

// The rules of a board: every goal has a number of its own, and no goal gets the number of another
// goal again, also after that goal was cleared, since cleared goals are never removed from the
// board. A goal has one entry for each TODO number.

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
  DependencyLoop = 'dependency-loop',
  DependencyNotDone = 'dependency-not-done',
  EvidenceNotOneLine = 'evidence-not-one-line',
  EvidenceTooLong = 'evidence-too-long',
  GoalNotOpen = 'goal-not-open',
  NotMarkedDone = 'not-marked-done',
  NotTodoNumber = 'not-todo-number',
  NumberTaken = 'number-taken',
  TextChangedElsewhere = 'text-changed-elsewhere',
  TodoNotAttached = 'todo-not-attached',
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
export type NotOpenRefused = Extract<ChangeRefused, { refusal: Refusal.GoalNotOpen }>

/**
 * The refusal of an edit of goal `goal`, whose text was changed to `text` since the edit started
 * from another text.
 */
export type TextChangedRefused = {
  outcome: Outcome.Refused
  refusal: Refusal.TextChangedElsewhere
  goal: number
  text: string
}

/**
 * The refusal of an edit of a goal: a blank text, a number that is not of an open goal, or a text
 * changed since the edit started.
 */
export type EditRefused =
  | Extract<AddRefused, { refusal: Refusal.BlankText }>
  | NotOpenRefused
  | TextChangedRefused

/** The new text `text` of a goal, and `editedFrom`, the text of the goal when the edit started. */
export type GoalEdit = { text: string; editedFrom: string }

/** The refusal of a done mark on goal `goal`, whose dependency `dependsOn` is not done yet. */
export type DependencyNotDoneRefused = {
  outcome: Outcome.Refused
  refusal: Refusal.DependencyNotDone
  goal: number
  dependsOn: number
}

/**
 * The refusal of a done mark: a blank evidence, one over several lines or too long, a goal that is
 * not open, or a goal whose dependency is not done.
 */
export type MarkRefused =
  | {
      outcome: Outcome.Refused
      refusal: Refusal.BlankEvidence | Refusal.EvidenceNotOneLine | Refusal.EvidenceTooLong
    }
  | NotOpenRefused
  | DependencyNotDoneRefused

/** The refusal of a dependency of goal `goal` on goal `dependsOn`, which depends on `goal`. */
export type LoopRefused = {
  outcome: Outcome.Refused
  refusal: Refusal.DependencyLoop
  goal: number
  dependsOn: number
}

/**
 * The refusal of removing a done mark: a goal that is not open, or a goal without the mark to
 * remove.
 */
export type UnmarkRefused =
  | { outcome: Outcome.Refused; refusal: Refusal.NotMarkedDone; goal: number }
  | NotOpenRefused

export type Read = { outcome: Outcome.Read; board: Board }

/**
 * The board after a change, with the goal as changed by the change itself, and the goals whose done
 * marks were removed with it, which are stored before the goal.
 */
export type Changed<Changing extends Goal = Goal> = {
  outcome: Outcome.Changed
  board: Board
  goal: Changing
  unmarked: readonly UnmarkedGoal[]
}

export type Unchanged = { outcome: Outcome.Unchanged; board: Board }

export type BoardChange = Changed | Unchanged | ChangeRefused

/** Every outcome of a change of a goal other than the change itself. */
export type NotChanged =
  | Unchanged
  | ChangeRefused
  | EditRefused
  | MarkRefused
  | UnmarkRefused
  | LoopRefused

/** A goal with a priority set or removed, as a change of its priority leaves it. */
export type PrioritizedGoal = Goal & { prioritySetting: Setting<Priority> }

/** A goal with a dependency set or removed, as a change of its dependency leaves it. */
export type DependentGoal = Goal & { dependencySetting: Setting<string> }

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

/** The open goals of `board` in the order of their priorities, as sortedByPriority orders them. */
export function openGoalsByPriorityOf(board: Board): Goal[] {
  return sortedByPriority(openGoalsOf(board))
}

/** The open goals of `board` by id, where a goal depended on is looked up. */
export function openGoalsByIdOf(board: Board): OpenGoals {
  return new Map(openGoalsOf(board).map(goal => [goal.id, goal]))
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

  return {
    outcome: Outcome.Changed,
    board: { goals: [...board.goals, added] },
    goal: added,
    unmarked: [],
  }
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
 * Gives the open goal numbered `number` the text of `edit`. The goal keeps its number, its TODO
 * entries and its place on the board. A done mark of the goal was set for the text before the
 * edit, so the edit removes it, as removed by the user, with the marks of the goals depending on
 * it. An edit to the text already set changes nothing. An edit started from a text other than the
 * current text of the goal is refused, so a text saved elsewhere since is not replaced unseen.
 */
export function editGoal(
  board: Board,
  number: number,
  edit: GoalEdit,
  editedAt: number,
): Changed | Unchanged | EditRefused {
  const edited = edit.text.trim()
  if (edited === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankText }
  }
  const changed = changeOpenGoal<Unchanged | TextChangedRefused>(board, number, goal => {
    if (goal.text === edited) {
      return { outcome: Outcome.Unchanged, board }
    }
    if (goal.text !== edit.editedFrom) {
      return {
        outcome: Outcome.Refused,
        refusal: Refusal.TextChangedElsewhere,
        goal: number,
        text: goal.text,
      }
    }

    return { outcome: Outcome.Changed, goal: { ...goal, text: edited, editedAt } }
  })
  if (changed.outcome !== Outcome.Changed) {
    return changed
  }
  const removal = { removedBy: MarkRemover.User, removedAt: editedAt } as const
  const unmarked = removeDoneMark(changed.board, number, removal)

  return unmarked.outcome === Outcome.Changed
    ? { ...unmarked, goal: changed.goal, unmarked: [unmarked.goal, ...unmarked.unmarked] }
    : changed
}

/**
 * `changed` with the done marks removed at `removedAt` from the open goals left waiting by it, as
 * goalsUnmarkedForDependency finds them.
 */
function withWaitingMarksRemoved<Changing extends Goal>(
  changed: Changed<Changing>,
  removedAt: number,
): Changed<Changing> {
  const unmarked = goalsUnmarkedForDependency(openGoalsByIdOf(changed.board), removedAt)
  const byId = new Map(unmarked.map(goal => [goal.id, goal]))

  return {
    ...changed,
    board: { goals: changed.board.goals.map(goal => byId.get(goal.id) ?? goal) },
    unmarked: [...changed.unmarked, ...unmarked],
  }
}

/**
 * Marks the open goal numbered `number` as done with `evidence`, in place of any mark already on
 * it. A goal whose dependency is not done yet is refused. A mark with the evidence already on the
 * goal changes nothing.
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

  return changeOpenGoal<Unchanged | DependencyNotDoneRefused, MarkedGoal>(board, number, goal => {
    const unfinished = unfinishedDependencyOf(openGoalsByIdOf(board), goal)
    if (unfinished !== undefined) {
      return {
        outcome: Outcome.Refused,
        refusal: Refusal.DependencyNotDone,
        goal: number,
        dependsOn: unfinished.number,
      }
    }

    return doneMarkOf(goal)?.evidence === trimmed
      ? { outcome: Outcome.Unchanged, board }
      : { outcome: Outcome.Changed, goal: { ...goal, doneMark: { evidence: trimmed, markedAt } } }
  })
}

/**
 * Removes the done mark of the open goal numbered `number`, with the marks of the goals depending
 * on it. With `markedAt`, only the mark set at that time is removed, so a press on a mark drawn
 * before the model set a new one does not remove the new one. The reason is trimmed, and a blank
 * reason is skipped.
 */
export function removeDoneMark(
  board: Board,
  number: number,
  removal: MarkRemovalAsked & { removedAt: number },
  markedAt?: number,
): Changed<UnmarkedGoal> | UnmarkRefused {
  const changed = changeOpenGoal<UnmarkRefused, UnmarkedGoal>(board, number, goal => {
    const mark = doneMarkOf(goal)

    return mark === undefined || (markedAt !== undefined && mark.markedAt !== markedAt)
      ? { outcome: Outcome.Refused, refusal: Refusal.NotMarkedDone, goal: number }
      : { outcome: Outcome.Changed, goal: unmarkedGoalOf(goal, mark, removal) }
  })

  return changed.outcome === Outcome.Changed
    ? withWaitingMarksRemoved(changed, removal.removedAt)
    : changed
}

/**
 * Gives the open goal numbered `number` the priority `priority`, or removes its priority when
 * `priority` is undefined. Setting the priority the goal has already changes nothing.
 */
export function setGoalPriority(
  board: Board,
  number: number,
  priority: Priority | undefined,
  setAt: number,
): Changed<PrioritizedGoal> | Unchanged | NotOpenRefused {
  return changeOpenGoal<Unchanged, PrioritizedGoal>(board, number, goal =>
    priorityOf(goal) === priority
      ? { outcome: Outcome.Unchanged, board }
      : {
          outcome: Outcome.Changed,
          goal: { ...goal, prioritySetting: settingOf(priority, setAt) },
        },
  )
}

/**
 * Makes the open goal numbered `number` depend on the open goal numbered `dependsOn`, or removes
 * its dependency when `dependsOn` is undefined. A dependency that closes a loop is refused. A goal
 * marked as done whose new dependency is not marked as done has its done mark removed, as do the
 * goals depending on it. Setting the dependency the goal has already changes nothing.
 */
export function setGoalDependency(
  board: Board,
  number: number,
  dependsOn: number | undefined,
  setAt: number,
): Changed<DependentGoal> | Unchanged | NotOpenRefused | LoopRefused {
  const open = openGoalsByIdOf(board)
  const depended = [...open.values()].find(goal => goal.number === dependsOn)
  if (dependsOn !== undefined && depended === undefined) {
    return { outcome: Outcome.Refused, refusal: Refusal.GoalNotOpen, goal: dependsOn }
  }
  const changed = changeOpenGoal<Unchanged | LoopRefused, DependentGoal>(board, number, goal => {
    if (dependedGoalOf(open, goal)?.id === depended?.id) {
      return { outcome: Outcome.Unchanged, board }
    }
    if (depended !== undefined && closesLoop(open, goal, depended)) {
      return {
        outcome: Outcome.Refused,
        refusal: Refusal.DependencyLoop,
        goal: number,
        dependsOn: depended.number,
      }
    }

    return {
      outcome: Outcome.Changed,
      goal: { ...goal, dependencySetting: settingOf(depended?.id, setAt) },
    }
  })

  return changed.outcome === Outcome.Changed ? withWaitingMarksRemoved(changed, setAt) : changed
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

  return {
    outcome: Outcome.Changed,
    board: { goals: board.goals.map(each => (each.id === changed.goal.id ? changed.goal : each)) },
    goal: changed.goal,
    unmarked: [],
  }
}
