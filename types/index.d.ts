import type { Outcome, Read } from '../hooks/goals/board'
import type { MarkSetter, StoredMarkRemoval } from '../hooks/goals/doneMark'
import type {
  ImportAction,
  ImportInPane,
  ImportResult,
  ImportableSessions,
} from '../hooks/imports/importPaneMessages'
import type { GoalCheckPhase } from '../hooks/goals/goalCheck'
import type { IdlePhase } from '../hooks/goals/goalIdleCheck'
import type { GoalPaneAction, GoalSaveResult } from '../hooks/goals/goalPaneMessages'
import type { MissingWork, WaitingWork } from '../hooks/goals/goalVerdicts'
import type { RowMode } from '../hooks/goals/goalRowState'
import type { Priority } from '../hooks/goals/priority'
import type { HintKindName } from '../hooks/hintKind'
import type { SessionIdeas } from '../hooks/ideas/ideaState'
import type { PendingHintNote } from '../hooks/hintNoteDelivery'
import type { LoopLedger } from '../hooks/neededSkills/loadLedger'
import type { PaneNotices } from '../hooks/paneNotice'
import type { PaneRecord, TypedInWorker } from '../hooks/paneWorker'
import type { FieldFocus } from '../hooks/reminders/cardFocus'
import type { CardMode } from '../hooks/reminders/reminderCardState'
import type {
  ReminderPaneAction,
  ReminderSaveResult,
} from '../hooks/reminders/reminderPaneMessages'
import type { ReadReminders, RemindersNotRead } from '../hooks/reminders/reminderStore'
import type { Refusal as ReminderRefusal } from '../hooks/reminders/reminders'
import type { HintRoastsOfSession } from '../hooks/roast/hintRoastQueue'
import type { IdleWaitEnd } from '../hooks/roast/idleWait'
import type { ForkView } from '../hooks/roast/messagesUnseenByFork'
import type { PendingRoast, SessionRoast } from '../hooks/roast/roastState'
import type { ActivityOfSession } from '../hooks/sessionState'
import type { EntryNumber } from '../hooks/todoEntry'

/** Records that the user marked a request done. */
export type Reply = {
  /** What the user wrote in reply; absent for a request marked done without a reply. */
  text?: string
  repliedAt: number
  /** Whether the sending session has read that the request is done, from a tool result, a prompt
   * or the list. */
  isDelivered: boolean
}

/**
 * A request the model sent to the user for work outside the session, stored under the session
 * that sent it until the user marks it done. Only that session shows it, stores the reply and
 * delivers that reply.
 */
export type Request = {
  /** The part of the store key that names the request, unique across every session. */
  id: string
  /** The number the user and the model name the request by, unique in its session. */
  number: number
  text: string
  sentAt: number
  reply?: Reply
  /** When the sending session took the request back, which closes it without a reply. */
  withdrawnAt?: number
}

/** The requests of a session, as the session last read or wrote them. */
export type SessionRequests = {
  sessionId: string
  requests: readonly Request[]
}

/** A TODO entry attached to a goal, known by its number in TODO.md. */
export type AttachedTodo = {
  number: EntryNumber
  title: string
  attachedAt: number
}

/**
 * The removal of the done mark set at `markedAt`: when, by whom, and, for a removal by the user,
 * why, if given. The reason is never blank.
 */
export type MarkRemoval = { markedAt: number; removedAt: number } & StoredMarkRemoval

/**
 * A goal judged done, with the evidence for the user to look at. The goal is open until the user
 * clears it.
 */
export type DoneMark = {
  /** What the user looks at to check the goal, such as a commit and a file. */
  evidence: string
  markedAt: number
  setBy: MarkSetter
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
      /**
       * The text drawn into the field when the field was last drawn anew. The text typed since is
       * among the texts typed into the pane, under the key of the field.
       */
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
      /**
       * New for each press of Unmark, the key of the field for the reason, so the field does not
       * show a reason typed before an earlier Cancel.
       */
      fieldId: string
    }

/** The goal numbered `goal` pressed in the Goals pane, with what the pane does with it. */
export type GoalInPane = { goal: number } & RowInPane

/** What the hooks module stores of the Goals pane. */
export type GoalsPaneRecord = PaneRecord<GoalInPane | null, GoalPaneAction, GoalSaveResult>

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
 * The time between two turns of the main conversation of a session, and how far the goal check in
 * it got.
 */
export type IdleStretch = {
  sessionId: string
  /** New for each stretch, so a timer of the idle minutes acts only while its stretch lasts. */
  stretchId: string
  phase: IdlePhase
}

/**
 * The done mark that the user removed from a goal, as the goal checker reads it: the evidence of
 * the mark, the time of the removal as an ISO 8601 text, and the reason given by the user, if any.
 */
export type RemovedMark = { evidence: string; removedAt: string; reason?: string }

/** An open goal as listed for the goal checker, with the done mark the user removed, if any. */
export type ListedGoal = { goal: number; text: string; removedMark?: RemovedMark }

/** The default branch of the project, by the ref it was found under, and the commit at its head. */
export type DefaultBranch = { ref: string; head: string }

/**
 * The last goal check of a session: while its goal checker runs, the goals listed for it, and once
 * the verdicts were reported, the goals whose verdicts were applied.
 */
export type GoalCheck = {
  sessionId: string
  /** The idle stretch the check started in, which starts no other check. */
  stretchId: string
  phase: GoalCheckPhase
  /** Absent when git found no default branch. */
  defaultBranch?: DefaultBranch
  goals: readonly ListedGoal[]
}

/**
 * The goals found open by the goal checker of a session on `board`, with the goals judged done that
 * wait for them, waiting to go to its model.
 */
export type PendingMissingWork = {
  sessionId: string
  board: Board
  missing: readonly MissingWork[]
  waiting: readonly WaitingWork[]
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
       * New for each opening of the card and each time it is drawn anew after a save, the key of
       * its text field. A pick of a kind keeps it, so the text typed into the field stays there.
       */
      textFieldId: string
      /**
       * New for each opening of the card, each pick of a kind and each time it is drawn anew after
       * a save, the key of its value fields: a field drawn again under an earlier key would show
       * the value the engine stored for it, such as the empty text after an Enter.
       */
      fieldsId: string
      /** The text and the cadence the fields of the card were last drawn anew with. */
      opened: CardDraft
      /**
       * What was picked in the card and added to its lists since it opened. The texts typed into
       * its fields are recorded by the hooks module, and a save of the card reads them.
       */
      draft: CardDraft
      warning?: CardWarning
      focus: FieldFocus
    }
  | { mode: CardMode.WaitingForYes }
)

/** What the hooks module stores of the Reminders pane. */
export type RemindersPaneRecord = PaneRecord<
  CardInPane | null,
  ReminderPaneAction,
  ReminderSaveResult
>

/** The sessions of the project read for the import panes by the session `sessionId`. */
export type ImportableSessionsInState = { sessionId: string } & ImportableSessions

/** What the hooks module stores of an import pane. */
export type ImportPaneRecord = PaneRecord<ImportInPane | null, ImportAction, ImportResult>

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

/** The names of the hint kinds sent in the running turn of the main conversation of a session. */
export type HintKindsSentInTurn = {
  sessionId: string
  names: readonly HintKindName[]
  /** The hint note returned at the last end of the turn; null once the model received it. */
  offered: HintNoteOffered | null
}

/** A hint note returned at an end of a turn, with the names of the hint kinds in it. */
export type HintNoteOffered = {
  names: readonly HintKindName[]
  text: string
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

declare module 'claude-code' {
  interface PluginState {
    'workflow-skills': {
      /**
       * The activity of the main conversation of the session whose turn last started or ended,
       * since the state may outlive a switch to another session by /clear or /resume; null before
       * the first turn. The plugin delivers pending texts differently during a turn, after a turn
       * stopped by the user, and while idle.
       */
      sessionActivity: ActivityOfSession | null
      /**
       * The requests of the session that last read or wrote them, with the id of that session,
       * since the state may outlive a switch to another session by /clear or /resume; null before
       * any session read them and in a session without a person at the prompt.
       */
      sessionRequests: SessionRequests | null
      /** The ids of the requests whose replies this session is delivering right now. */
      deliveringReplies: readonly string[]
      /**
       * The board of the session that last read it, with the id of that session, since the state
       * may outlive a switch to another session; null before any session read it.
       */
      sessionBoard: SessionBoard | null
      /** The Goals pane as the hooks module stores it. */
      goalsPane: Shaped<GoalsPaneRecord>
      /**
       * The texts typed into the text fields of the Goals pane, as the hooks module records them;
       * null before the first text typed after the pane opened.
       */
      goalsPaneTyped: TypedInWorker | null
      /** The board seen by the model of the session; null before the board is first read. */
      seenBoard: SeenBoard | null
      /**
       * The idle stretch of the main conversation of the session; null while neither a turn nor
       * the idle minutes run, before the first turn and after the turn started by the reminder.
       */
      idleStretch: IdleStretch | null
      /** The last goal check of the session; null before the first check. */
      goalCheck: GoalCheck | null
      /** The goals found open by the goal checker of the session; null while none waits. */
      pendingMissingWork: Shaped<PendingMissingWork | null>
      /** The nudges of the session waiting to be sent to the model; null while none waits. */
      waitingNudges: WaitingNudges | null
      /**
       * The hint kinds sent in the running turn of the main conversation of the session; null
       * before the first hint of the turn.
       */
      hintKindsSentInTurn: Shaped<HintKindsSentInTurn | null>
      /** The note on hints waiting to go to the model of the session; null while none waits. */
      pendingHintNote: Shaped<PendingHintNote | null>
      /** The roasts on hints of the session not written yet; null while none waits. */
      hintRoastsOfSession: Shaped<HintRoastsOfSession | null>
      /**
       * When the wait of the session after a turn ends, for the roasts after it; null before the
       * first wait with a roast at its end, and once a wait was cancelled.
       */
      idleWaitEnd: IdleWaitEnd | null
      /** When the session is next sent the self-check; null before the user typed in it. */
      selfCheckSchedule: SelfCheckSchedule | null
      /**
       * The reminders of the session that last read them, with the id of that session; null
       * before any session read them.
       */
      sessionReminders: SessionReminders | null
      /** The Reminders pane as the hooks module stores it. */
      remindersPane: Shaped<RemindersPaneRecord>
      /**
       * The texts typed into the text fields of the Reminders pane, as the hooks module records
       * them; null before the first text typed after the pane opened.
       */
      remindersPaneTyped: TypedInWorker | null
      /** When the reminders of the session are next sent, as their cadence kinds put it. */
      reminderNextSends: ReminderNextSends | null
      /** How far the due times of the timed reminders of the session are handled. */
      timedRemindersHandled: TimedRemindersHandled | null
      /** The ledgers of the loops of the session; null before any loop made a load or a request. */
      loadLedgers: Shaped<SessionLoadLedgers | null>
      /**
       * The sessions of the project as an import pane last read them, with the id of the session
       * that read them; null before an import pane opened.
       */
      importableSessions: ImportableSessionsInState | null
      /** The import panes as the hooks module stores them. */
      goalsImportPane: Shaped<ImportPaneRecord>
      remindersImportPane: Shaped<ImportPaneRecord>
      /**
       * The text drawn under each pane that has one, set when the pane opened; null before a pane
       * opened with one.
       */
      paneNotices: PaneNotices | null
      /**
       * The session that recorded its start in this process and waits for its first prompt; null
       * once the prompt was recorded, and in a session resumed or begun before sessions recorded
       * their start.
       */
      firstPromptAwaited: { sessionId: string } | null
      /**
       * What a fork made from the main conversation of the session sees of it; null before a step
       * of the main conversation got a response.
       */
      forkView: ForkView | null
      /** The roast shown in the Roast pane; null before /roast first ran. */
      sessionRoast: SessionRoast | null
      /** The roasts sent from the Roast pane that have not gone to the model yet. */
      pendingRoasts: readonly PendingRoast[]
      /**
       * The ideas recorded in the project of the session that last loaded them, with the id of
       * that session; null before any session loaded them.
       */
      sessionIdeas: SessionIdeas | null
    }
  }
}
