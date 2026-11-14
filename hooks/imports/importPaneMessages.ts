import type { Cadence } from '../../types'
import type { Priority } from '../goals/priority'
import type { RecordedStart } from '../sessions/sessionStore'

// What the hooks module and the surface module of an import pane hand each other: the sessions to
// pick from, the import of the goals or reminders ticked in one of them, and the result.

/** What an import pane imports from an earlier session of the project. */
export enum ImportKind {
  Goals = 'goals',
  Reminders = 'reminders',
}

/** The place of each kind where several kinds are shown in one line: goals first. */
export const SHOWN_RANK_OF_KIND: Record<ImportKind, number> = {
  [ImportKind.Goals]: 0,
  [ImportKind.Reminders]: 1,
}

/** An open goal of another session, with its priority and the open goal depended on by it. */
export type GoalRow = {
  id: string
  number: number
  text: string
  priority?: Priority
  dependsOn?: number
}

/** A reminder of another session that is not removed, with its cadence and its switch. */
export type ReminderRow = {
  id: string
  number: number
  text: string
  cadence: Cadence
  isEnabled: boolean
}

/** The rows an import pane of each kind lists. */
export type RowsOfKinds = {
  [ImportKind.Goals]: readonly GoalRow[]
  [ImportKind.Reminders]: readonly ReminderRow[]
}

/**
 * A session of the project as read for the import panes, with its start unless it has no start
 * record that this code reads, and the goals and the reminders that can be imported from it.
 */
export type ListedSession = { sessionId: string; start?: RecordedStart; rows: RowsOfKinds }

/**
 * A session as an import pane draws it: when it started and its first prompt, as far as it
 * recorded them, how many rows of each kind it has, and the rows of the kind of the pane.
 */
export type PaneSession<Row> = {
  sessionId: string
  startedAt?: number
  firstPrompt?: string
  counts: Readonly<Record<ImportKind, number>>
  rows: readonly Row[]
}

/** The sessions with rows of the kind of an import pane. */
export type SessionsOfKind =
  | { kind: ImportKind.Goals; sessions: readonly PaneSession<GoalRow>[] }
  | { kind: ImportKind.Reminders; sessions: readonly PaneSession<ReminderRow>[] }

/** How far the sessions of the project have been read for the running session. */
export enum SessionsShown {
  /** The sessions in the state were listed for another session, such as one before /clear. */
  NotListed = 'not-listed',
  NotRead = 'not-read',
  Read = 'read',
}

/**
 * The sessions of the project, newest first and sessions without a start record last, with a text
 * for each session whose goals or reminders could not be read; or why they could not be listed.
 */
export type ImportableSessions =
  | { shown: SessionsShown.NotRead; failure: string }
  | {
      shown: SessionsShown.Read
      sessions: readonly ListedSession[]
      unreadable: readonly string[]
    }

/**
 * What an import pane draws: that the sessions were not listed for the running session, why they
 * could not be listed, or the sessions with rows of the kind of the pane, with the length of the
 * start of a session id that tells every session listed apart.
 */
export type ImportPaneView =
  | { shown: SessionsShown.NotListed; kind: ImportKind }
  | { shown: SessionsShown.NotRead; failure: string }
  | ({
      shown: SessionsShown.Read
      unreadable: readonly string[]
      idLength: number
    } & SessionsOfKind)

/** The session pressed in an import pane, and the ids of the rows ticked in it. */
export type ImportInPane = { sessionId: string; pickedIds: readonly string[] }

/** The one save of an import pane: the import of the rows `pickedIds` of `fromSessionId`. */
export type ImportAction = { fromSessionId: string; pickedIds: readonly string[] }

export enum ImportOutcome {
  Imported = 'imported',
  /** Not imported, which a toast showed. */
  Failed = 'failed',
}

export type ImportResult = { outcome: ImportOutcome }
