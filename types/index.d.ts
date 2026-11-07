import type { Outcome, Read } from '../hooks/goals/board'
import type { MarkRemovalAsked } from '../hooks/goals/doneMark'
import type { IdlePhase } from '../hooks/goals/goalIdleReminder'
import type { RowMode } from '../hooks/goals/goalState'
import type { Priority } from '../hooks/goals/priority'

/** What the user wrote in reply to a question. */
export type Answer = {
  text: string
  answeredAt: number
  /** Whether the asking session has read the answer, from a tool result, a prompt or the list. */
  isDelivered: boolean
}

/**
 * A question the model put to the user, stored under the session that asked it until the user
 * answers it. Only that session shows it, stores its answer and delivers that answer.
 */
export type Question = {
  /** The part of the store key that names the question, unique across every session. */
  id: string
  /** The number the user and the model name the question by, unique in its session. */
  number: number
  text: string
  /** The answers the user can pick from; empty for a question answered in words alone. */
  choices: readonly string[]
  askedAt: number
  answer?: Answer
  /** When the asking session took the question back, which closes it without an answer. */
  withdrawnAt?: number
}

/** The questions of a session, as the session last read or wrote them. */
export type SessionQuestions = {
  sessionId: string
  questions: readonly Question[]
}

/** A TODO entry attached to a goal, known by its number in TODO.md. */
export type AttachedTodo = {
  /** The number of the entry in TODO.md, such as "41", or "41.1" for a sub-unit. */
  number: string
  title: string
  attachedAt: number
}

/**
 * The removal of the done mark set at `markedAt`: when, by whom, and, for a removal by the user,
 * why, if given. The reason is never blank.
 */
export type MarkRemoval = { markedAt: number; removedAt: number } & MarkRemovalAsked

/**
 * A goal reported as done by the model, with the evidence for the user to look at. The goal stays
 * open until the user clears it.
 */
export type DoneMark = {
  /** What the user looks at to check the goal, such as a file, a branch or a version. */
  evidence: string
  markedAt: number
}

/** A goal set by the user for the work, open until the user clears it. */
export type Goal = {
  /** The part of the store keys of the goal that names it, unique across every board. */
  id: string
  /** The number named by the user and the model, never given again on its board. */
  number: number
  text: string
  addedAt: number
  /** When the user last gave the goal a new text, if ever. */
  editedAt?: number
  clearedAt?: number
  /** The TODO entries to build for the goal, one for each TODO number. */
  todos: readonly AttachedTodo[]
  /** The last done mark set on the goal, removed or not, if it ever had one. */
  doneMark?: DoneMark
  /**
   * The last removal of a done mark of the goal, if a mark was ever removed. Only the mark set at
   * the `markedAt` of the removal is removed by it.
   */
  markRemoval?: MarkRemoval
  /** The last priority set or removed by the user, if the user ever set one. */
  prioritySetting?: Setting<Priority>
  /**
   * The last dependency set or removed by the user, if the user ever set one, by the id of the goal
   * depended on.
   */
  dependencySetting?: Setting<string>
}

/** A value set on a goal by the user at `setAt`, or its removal when `value` is absent. */
export type Setting<Value> = { value?: Value; setAt: number }

/** The goals of one board in the order they were added, cleared goals included. */
export type Board = {
  goals: readonly Goal[]
}

/** A board the store could not read, with the reason and the next step written by the store. */
export type UnreadBoard = { outcome: Outcome.Failed; failure: string }

/** The board of a session as the session last read it, or why the store could not read it. */
export type SessionBoard = { sessionId: string } & (Read | UnreadBoard)

/**
 * What the Goals pane draws for a goal pressed in it: the question to clear it after a press of
 * Clear, its text as a field after a press of Edit, or a field for the reason to remove its done
 * mark after a press of Unmark.
 */
export type RowInPane =
  | { mode: RowMode.WaitingForYes }
  | {
      mode: RowMode.Editing
      /** Whether the last text entered in the field was refused as blank. */
      isBlankTextRefused: boolean
    }
  | {
      mode: RowMode.Unmarking
      /** The done mark shown when Unmark was pressed. Only this mark is removed with the reason. */
      shown: DoneMark
    }

/** The goal of a session pressed in the Goals pane, with what the pane does with it. */
export type GoalInPane = { sessionId: string; goalId: string } & RowInPane

/** The board of a session as its model last saw it, which the notes on the changes compare with. */
export type SeenBoard = {
  sessionId: string
  /**
   * Null while the model has seen no board, such as after a failed attempt to read the board at
   * the start.
   */
  board: Board | null
}

/**
 * The time between two turns of the main conversation of a session, and how far the reminder of
 * the open goals in it got.
 */
export type IdleStretch = {
  sessionId: string
  /** New for each stretch, so a timer of the idle minutes acts only while its stretch lasts. */
  stretchId: string
  phase: IdlePhase
}

/** When the main conversation of a session is next told to check the work delivered by it. */
export type SelfCheckSchedule = {
  sessionId: string
  /**
   * The next due time after the last message typed by the user, in milliseconds since the epoch.
   * The due times follow that message at equal intervals.
   */
  dueAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-skills': {
      /**
       * True while a turn of the main conversation runs. Answers are delivered differently
       * during a turn than while idle.
       */
      isTurnRunning: boolean
      /**
       * The questions of the session that last read or wrote them, with the id of that session,
       * since the state may outlive a switch to another session by /clear or /resume; null before
       * any session read them and in a session without a person at the prompt.
       */
      sessionQuestions: SessionQuestions | null
      /** The ids of the questions whose answers this session is delivering right now. */
      deliveringAnswers: readonly string[]
      /**
       * The board of the session that last read it, with the id of that session, since the state
       * may outlive a switch to another session; null before any session read it.
       */
      sessionBoard: SessionBoard | null
      /** The one goal of the Goals pane in the yes, edit or unmark row mode, if any. */
      goalInPane: GoalInPane | null
      /** True while the Goals pane saves an added, an edited or a cleared goal. */
      isSavingGoal: boolean
      /** The board seen by the model of the session; null before the board is first read. */
      seenBoard: SeenBoard | null
      /**
       * The idle stretch of the main conversation of the session; null while neither a turn nor
       * the idle minutes run, before the first turn and after the turn started by the reminder.
       */
      idleStretch: IdleStretch | null
      /** When the session is next sent the self-check; null before the user typed in it. */
      selfCheckSchedule: SelfCheckSchedule | null
    }
  }
}
