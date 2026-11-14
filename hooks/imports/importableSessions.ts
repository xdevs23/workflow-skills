import type { EngineInterface } from 'claude-code'

import type { Board, Reminder } from '../../types'
import { Outcome as BoardOutcome, openGoalsByIdOf, openGoalsOf } from '../goals/board'
import { sessionOfBoardKey, sessionScope } from '../goals/boardScope'
import { describeStoreFailure, loadBoardIn } from '../goals/boardStore'
import { shownSettingsOf } from '../goals/goalPaneView'
import { sortedByNumber } from '../numbered'
import { describeFailedStoreCall, listKeys, returningStoreFailure } from '../pluginStore'
import { sessionOfReminderKey } from '../reminders/reminderRecord'
import { Outcome as ReminderOutcome, shownRemindersOf } from '../reminders/reminders'
import { loadRemindersIn } from '../reminders/reminderStore'
import { readSessionStarts } from '../sessions/sessionStarts'
import type { RecordedStart } from '../sessions/sessionStore'
import { ImportKind, SessionsShown } from './importPaneMessages'
import type {
  GoalRow,
  ImportableSessions,
  ListedSession,
  ReminderRow,
} from './importPaneMessages'
import { uniqueIdLengthOf } from './importPaneTexts'
import {
  describePromptHistoryNotRead,
  describeSessionNotRead,
  describeSessionsNotListed,
  describeStartNotRead,
} from './importTexts'

/** A session with goals or reminders in the store, the keys of its records, and its start. */
type StoredSession = { sessionId: string; keys: readonly string[]; start?: RecordedStart }

/** What became of a session read for the import panes. */
enum ReadOutcome {
  Read = 'read',
  Unreadable = 'unreadable',
}

/** A session read for the import panes, or the text for a session that could not be read. */
type ReadSession =
  | { outcome: ReadOutcome.Read; session: ListedSession }
  | { outcome: ReadOutcome.Unreadable; text: string }

/**
 * Reads the sessions of the project other than the running one from the store, with their open
 * goals and their reminders. A session belongs to the project when its start, recorded by it or
 * found in the prompt history of Claude Code, has the same folder as the running session, or when
 * it does not have a start that this code reads, such as a session begun before sessions recorded
 * their start and missing from that history. The newest session comes first, and the sessions
 * without a start record come last, in the order of their first keys set in the store.
 */
export async function loadImportableSessions($: EngineInterface): Promise<ImportableSessions> {
  const [root, sessionId] = await Promise.all([$.session.root(), $.session.id()])

  return returningStoreFailure(
    async () => {
      const stored = await listStoredSessions($, sessionId)
      const listed = stored
        .filter(({ start }) => start === undefined || start.root === root)
        .sort(compareNewestFirst)
      const idLength = uniqueIdLengthOf(listed.map(each => each.sessionId))
      const read = await Promise.all(listed.map(each => readListedSession($, each, idLength)))

      return {
        shown: SessionsShown.Read,
        sessions: read.flatMap(each => (each.outcome === ReadOutcome.Read ? [each.session] : [])),
        unreadable: read.flatMap(each =>
          each.outcome === ReadOutcome.Unreadable ? [each.text] : [],
        ),
      }
    },
    failed => ({ shown: SessionsShown.NotRead, failure: describeSessionsNotListed(failed) }),
  )
}

/**
 * The sessions other than `sessionId` with goals or reminders in the store, from one list of the
 * keys of the store, with the keys of their records and their start. A start record or a history
 * that cannot be read goes to the debug log, and the sessions it concerns are listed as ones
 * without a start record.
 */
async function listStoredSessions($: EngineInterface, sessionId: string): Promise<StoredSession[]> {
  const bySession = keysBySession(await listKeys($))
  bySession.delete(sessionId)
  const { starts, unreadableKeys, history } = await readSessionStarts($, [...bySession.keys()])
  for (const key of unreadableKeys) {
    $.ui.log(describeStartNotRead(key), { to: 'debug' })
  }
  const historyNotRead = describePromptHistoryNotRead(history)
  if (historyNotRead !== undefined) {
    $.ui.log(historyNotRead, { to: 'debug' })
  }

  return [...bySession].map(([other, keys]) => {
    const start = starts.get(other)

    return start === undefined ? { sessionId: other, keys } : { sessionId: other, keys, start }
  })
}

/** The keys of the goals and the reminders of each session among `keys`, in their order. */
function keysBySession(keys: readonly string[]): Map<string, string[]> {
  const bySession = new Map<string, string[]>()
  for (const key of keys) {
    const sessionId = sessionOfBoardKey(key) ?? sessionOfReminderKey(key)
    if (sessionId === undefined) {
      continue
    }
    const listed = bySession.get(sessionId) ?? []
    listed.push(key)
    bySession.set(sessionId, listed)
  }

  return bySession
}

function compareNewestFirst(first: StoredSession, second: StoredSession): number {
  if (first.start === undefined) {
    return second.start === undefined ? 0 : 1
  }
  if (second.start === undefined) {
    return -1
  }

  return second.start.startedAt - first.start.startedAt
}

/** The session `stored` with its rows, or the text for it, with its id cut to `idLength`. */
async function readListedSession(
  $: EngineInterface,
  { sessionId, keys, start }: StoredSession,
  idLength: number,
): Promise<ReadSession> {
  const [board, reminders] = await Promise.all([
    loadBoardIn($, sessionScope(sessionId), keys),
    loadRemindersIn($, sessionId, keys),
  ])
  const unreadableFor = (reason: string): ReadSession => ({
    outcome: ReadOutcome.Unreadable,
    text: describeSessionNotRead(
      { sessionId, ...(start === undefined ? {} : { startedAt: start.startedAt }) },
      idLength,
      reason,
    ),
  })
  if (board.outcome === BoardOutcome.Failed) {
    return unreadableFor(describeStoreFailure(board))
  }
  if (reminders.outcome === ReminderOutcome.Failed) {
    return unreadableFor(describeFailedStoreCall(reminders))
  }
  const rows = {
    [ImportKind.Goals]: goalRowsOf(board.board),
    [ImportKind.Reminders]: reminderRowsOf(reminders.reminders),
  }

  return {
    outcome: ReadOutcome.Read,
    session: { sessionId, ...(start === undefined ? {} : { start }), rows },
  }
}

/** The open goals of `board`, with the priority and the open goal depended on by each. */
function goalRowsOf(board: Board): GoalRow[] {
  const open = openGoalsByIdOf(board)

  return sortedByNumber(openGoalsOf(board)).map(goal => ({
    id: goal.id,
    number: goal.number,
    text: goal.text,
    ...shownSettingsOf(open, goal),
  }))
}

/** The reminders not removed, with the cadence and the switch of each. */
function reminderRowsOf(reminders: readonly Reminder[]): ReminderRow[] {
  return sortedByNumber(shownRemindersOf(reminders)).map(
    ({ id, number, text, cadence, isEnabled }) => ({ id, number, text, cadence, isEnabled }),
  )
}
