import type { Outcome, Read } from '../hooks/goals/board'
import type { MarkRemovalAsked } from '../hooks/goals/doneMark'
import type { IdlePhase } from '../hooks/goals/goalIdleReminder'
import type { FollowedElement } from '../hooks/goals/goalKeys'
import type { RowMode } from '../hooks/goals/goalState'
import type { Priority } from '../hooks/goals/priority'
import type { LoopLedger } from '../hooks/neededSkills/loadLedger'
import type { ReadReminders, RemindersNotRead } from '../hooks/reminders/reminderStore'
import type { CardMode } from '../hooks/reminders/reminderState'
import type { Refusal as ReminderRefusal } from '../hooks/reminders/reminders'

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
      /**
       * New for each press of Edit and each time the field is drawn anew, the key of the field: a
       * field drawn again under an earlier key would show the value the engine stored for it, such
       * as the empty text after an Enter.
       */
      fieldId: string
      /** The text drawn into the field when the field was last drawn anew. */
      drawn: string
      /**
       * The text of the goal at the start of the edit: the text when Edit was pressed, or the text
       * saved elsewhere since, once a save was refused for it. A save is refused while the stored
       * text differs from it.
       */
      editedFrom: string
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

/**
 * The goal of a session whose row in the Goals pane has the focus, followed by the focus when the
 * row moves: the element of the row the focus is on, and `keyId`, the key id of the element moved
 * to by the focus, new to each move.
 */
export type FollowedGoal = {
  sessionId: string
  goalId: string
  element: FollowedElement
  keyId?: string
}

/** The text typed into the field for the goal with the id `goalId`, edited in the Goals pane. */
export type TypedGoalText = { sessionId: string; goalId: string; text: string }

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

/** A goal pressed with Nudge, by its id and the number shown to the user. */
export type NudgedGoal = { id: string; number: number }

/** Goals pressed with Nudge, at least one. */
export type NudgedGoals = readonly [NudgedGoal, ...NudgedGoal[]]

/** The goals of one send of the nudges, taken from the waiting goals when the send started. */
export type NudgeSend = { sendId: string; goals: NudgedGoals }

/** The goals pressed with Nudge in the Goals pane whose prompt has not entered the session yet. */
export type WaitingNudges = {
  sessionId: string
  /** The goals pressed and not taken by a send, each once, in the order they were pressed. */
  waiting: readonly NudgedGoal[]
  /** The send that runs, if one runs. */
  sending: NudgeSend | null
}

/**
 * The value stored for a field: the text typed into a text field, the value of the option picked
 * in a dropdown, or the items added to a list field.
 */
export type CadenceValue = string | readonly string[]

/** When a reminder is sent: the cadence kind, and the values typed into the fields of the kind. */
export type Cadence = {
  /** The id of the cadence kind. */
  kind: string
  /** The values by the keys of the fields, read only by the cadence kind. */
  values: Readonly<Record<string, CadenceValue>>
}

/**
 * A reminder set by the user in a session. While it is switched on, the model is sent its text
 * alone whenever its cadence comes.
 */
export type Reminder = {
  /** The part of the store keys of the reminder that names it, unique across every session. */
  id: string
  /** The number the user knows the reminder by: its place in the order the reminders were added. */
  number: number
  text: string
  addedAt: number
  cadence: Cadence
  /** Whether the user switched the reminder on. A reminder never switched is off. */
  isEnabled: boolean
  removedAt?: number
}

/** The reminders of a session as the session last read them, or why the store could not. */
export type SessionReminders = { sessionId: string } & (ReadReminders | RemindersNotRead)

/**
 * What the user typed into the card of a reminder, before it is saved. `nextItems` has, by the key
 * of each list field, the text typed into the field that adds its next item, not added yet.
 */
export type CardDraft = {
  text: string
  cadence: Cadence
  nextItems: Readonly<Record<string, string>>
}

/**
 * The warning on a card whose save was refused: a blank text, a kind this version of the plugin
 * does not know, or the problem with its values.
 */
export type CardWarning =
  | { refusal: ReminderRefusal.BlankText | ReminderRefusal.UnknownCadence }
  | { refusal: ReminderRefusal.CadenceProblem; problem: string }

/**
 * What the Reminders pane draws for a card pressed in it: the card being edited, the reminder of
 * which is not stored yet for a new card, or the card waiting for the yes to remove its reminder.
 */
export type CardInPane = { reminderId: string } & (
  | {
      mode: CardMode.Editing
      /**
       * New for each opening of the card, the key of its kind dropdown, which keeps it while the
       * card is open: the engine opens the list of a focused dropdown whose key changes.
       */
      openingId: string
      /**
       * New for each opening of the card and each time its fields are drawn anew, the key of its
       * text field and value fields: a field drawn again under an earlier key would show the value
       * the engine stored for it, such as the empty text after an Enter.
       */
      fieldsId: string
      /** The text and the cadence the fields of the card were last drawn anew with. */
      opened: CardDraft
      /** What was typed into the card and picked in it since it opened. */
      draft: CardDraft
      warning?: CardWarning
    }
  | { mode: CardMode.WaitingForYes }
)

/** The card of a session pressed in the Reminders pane. */
export type ReminderCard = { sessionId: string } & CardInPane

/**
 * How far the due times of the reminders sent every given time are handled in a session: by the id
 * of each such reminder switched on, the time up to which its due times were sent to the model or
 * passed before it was switched on, in milliseconds since the epoch.
 */
export type TimedRemindersHandled = {
  sessionId: string
  handledUntil: Readonly<Record<string, number>>
}

/**
 * The next times at which the reminders of a session are sent, by the id of the cadence kind that
 * sends them, then by the id of the reminder, in milliseconds since the epoch. A kind puts only
 * the reminders it sends at times known ahead, while they are switched on.
 */
export type ReminderNextSends = {
  sessionId: string
  byKind: Readonly<Record<string, Readonly<Record<string, number>>>>
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

/**
 * The ledgers of the loops of a session: what the main conversation and each running subagent or
 * workflow agent loaded, by the agent id the engine gives it, with the context size of each.
 */
export type SessionLoadLedgers = {
  sessionId: string
  main: LoopLedger
  agents: Readonly<Record<string, LoopLedger>>
}

/** TODO.md of the project: its text, with the size and modification time it had when read. */
export type TodoFile = { size: number; mtimeMs: number; text: string }

/**
 * TODO.md of the project as the main conversation of a session last left it. The notes on clauses
 * after ", and" compare the file with it.
 */
export type TodoCopy = {
  sessionId: string
  /** Null while the project has no TODO.md. */
  file: TodoFile | null
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
      /**
       * The text typed into the field for the goal edited in the Goals pane. The pane does not
       * read it while drawn, so a change of the text does not draw the pane again.
       */
      typedGoalText: TypedGoalText | null
      /**
       * The goal whose row in the Goals pane has the focus; null while the focus is outside every
       * goal row.
       */
      followedGoal: FollowedGoal | null
      /** True while the Goals pane saves an added, an edited or a cleared goal. */
      isSavingGoal: boolean
      /** The board seen by the model of the session; null before the board is first read. */
      seenBoard: SeenBoard | null
      /**
       * The idle stretch of the main conversation of the session; null while neither a turn nor
       * the idle minutes run, before the first turn and after the turn started by the reminder.
       */
      idleStretch: IdleStretch | null
      /** The nudges of the session waiting to be sent to the model; null while none waits. */
      waitingNudges: WaitingNudges | null
      /** When the session is next sent the self-check; null before the user typed in it. */
      selfCheckSchedule: SelfCheckSchedule | null
      /**
       * The reminders of the session that last read them, with the id of that session; null
       * before any session read them.
       */
      sessionReminders: SessionReminders | null
      /** The one card of the Reminders pane being edited or waiting for a yes, if any. */
      reminderCard: Shaped<ReminderCard | null>
      /** The id of the reminder whose save in the Reminders pane runs, if one runs. */
      savingReminder: string | null
      /** When the reminders of the session are next sent, as their cadence kinds put it. */
      reminderNextSends: ReminderNextSends | null
      /** How far the due times of the timed reminders of the session are handled. */
      timedRemindersHandled: TimedRemindersHandled | null
      /** The ledgers of the loops of the session; null before any loop made a load or a request. */
      loadLedgers: Shaped<SessionLoadLedgers | null>
      /** The copy of TODO.md of the session; null before its main conversation read the file. */
      todoCopy: TodoCopy | null
    }
  }
}
