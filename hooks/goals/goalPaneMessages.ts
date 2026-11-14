import type { AttachedTodo, DoneMark } from '../../types'
import type { Priority } from './priority'

// What the hooks module and the surface module of the Goals pane hand each other: the board to
// draw, each save of the pane as an action, and the result of the save.

/** How far the board of the session has been read. */
export enum BoardShown {
  Loading = 'loading',
  NotRead = 'not-read',
  Read = 'read',
}

/**
 * An open goal as the Goals pane draws it, with the number of the open goal depended on by it. The
 * pane builds the choices of the dependency from the numbers, so the view grows with the goals.
 */
export type PaneGoal = {
  number: number
  text: string
  todos: readonly AttachedTodo[]
  priority?: Priority
  dependsOn?: number
  doneMark?: DoneMark
}

/**
 * The board drawn by the Goals pane: while it is read, the reason it could not be read, or its open
 * goals by priority with the number the next goal gets, and the text drawn under the goals.
 */
export type GoalsPaneView =
  | { board: BoardShown.Loading }
  | { board: BoardShown.NotRead; failure: string }
  | {
      board: BoardShown.Read
      goals: readonly PaneGoal[]
      nextNumber: number
      notice?: string
    }

export enum GoalPaneActionKind {
  Add = 'add',
  Edit = 'edit',
  Clear = 'clear',
  Unmark = 'unmark',
  Prioritize = 'prioritize',
  Depend = 'depend',
  Nudge = 'nudge',
}

/**
 * A save of the Goals pane, on the goal numbered `goal`: for an added goal, the number the board
 * gives it. An absent priority or dependency removes it.
 */
export type GoalPaneAction = { goal: number } & (
  | { kind: GoalPaneActionKind.Add; text: string }
  | { kind: GoalPaneActionKind.Edit; text: string; editedFrom: string }
  | { kind: GoalPaneActionKind.Clear | GoalPaneActionKind.Nudge }
  | { kind: GoalPaneActionKind.Unmark; shown: DoneMark; reason?: string }
  | { kind: GoalPaneActionKind.Prioritize; priority?: Priority }
  | { kind: GoalPaneActionKind.Depend; dependsOn?: number }
)

/** How a save of the Goals pane ended. */
export enum GoalSaveOutcome {
  Saved = 'saved',
  /**
   * Refused for the state of the board: a goal no longer open, which a toast showed, or a goal
   * added from a field whose number another goal took meanwhile.
   */
  Refused = 'refused',
  /** Not saved by the store, which a toast showed. */
  Failed = 'failed',
  BlankText = 'blank-text',
  TextChangedElsewhere = 'text-changed-elsewhere',
}

/** How a save ended, with the text saved elsewhere for an edit refused for it. */
export type GoalSaveResult =
  | { outcome: Exclude<GoalSaveOutcome, GoalSaveOutcome.TextChangedElsewhere> }
  | { outcome: GoalSaveOutcome.TextChangedElsewhere; text: string }
