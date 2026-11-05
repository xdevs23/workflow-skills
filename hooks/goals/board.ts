import type { AttachedTodo, Board, Goal } from '../../types'
import { isTodoNumber } from './todoNumber'

// The rules of a board: every goal has a number of its own, and no goal gets the number of another
// goal again, also after that goal was cleared, since cleared goals are never removed from the
// board. A goal has one entry for each TODO number.

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
  GoalNotOpen = 'goal-not-open',
  NotTodoNumber = 'not-todo-number',
  TodoNotAttached = 'todo-not-attached',
}

/** The refusal of adding a goal. */
export type AddRefused = { outcome: Outcome.Refused; refusal: Refusal.BlankText }

/** A refused change of a goal on the board, with the numbers named by it. */
export type ChangeRefused = { outcome: Outcome.Refused } & (
  | { refusal: Refusal.BlankTitle }
  | { refusal: Refusal.GoalNotOpen; goal: number }
  | { refusal: Refusal.NotTodoNumber; todo: string }
  | { refusal: Refusal.TodoNotAttached; goal: number; todo: string }
)

export type Read = { outcome: Outcome.Read; board: Board }

/** The board after a change, with the goal as changed by it. */
export type Changed = { outcome: Outcome.Changed; board: Board; goal: Goal }

export type Unchanged = { outcome: Outcome.Unchanged; board: Board }

export type BoardChange = Changed | Unchanged | ChangeRefused

/** A goal as changed by a change of the board. */
type ChangedGoal = { outcome: Outcome.Changed; goal: Goal }

export const EMPTY_BOARD: Board = { goals: [] }

export function isOpen(goal: Goal): boolean {
  return goal.clearedAt === undefined
}

export function openGoalsOf(board: Board): Goal[] {
  return board.goals.filter(isOpen)
}

/** Whether the goal with the id `goalId` is on the board and open. */
export function isGoalOpen(board: Board, goalId: string): boolean {
  return openGoalsOf(board).some(goal => goal.id === goalId)
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

export function addGoal(
  board: Board,
  goal: Pick<Goal, 'id' | 'text'>,
  addedAt: number,
): Changed | AddRefused {
  const text = goal.text.trim()
  if (text === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankText }
  }
  const number = nextGoalNumberOf(board)
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
function changeOpenGoal<Other extends Unchanged | ChangeRefused>(
  board: Board,
  number: number,
  change: (goal: Goal) => ChangedGoal | Other,
): Changed | ChangeRefused | Other {
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
