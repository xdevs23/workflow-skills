import type { EngineInterface } from 'claude-code'

import { showingStoreFailure } from '../failureToast'
import { Outcome as BoardOutcome } from '../goals/board'
import { readBoardInState } from '../goals/goalState'
import { Outcome as ReminderOutcome } from '../reminders/reminders'
import { readRemindersInState } from '../reminders/reminderState'
import { deleteSessionRecords } from '../sessions/sessionStore'
import { describeSessionRecordsNotDeleted } from './importTexts'

/**
 * Deletes the start record and the first prompt record of the ending session `sessionId` when it
 * read its goals and its reminders and has none, since an import lists only sessions with goals or
 * reminders. A session whose goals or reminders could not be read keeps its records.
 */
export async function deleteRecordsOfSessionWithoutImports(
  $: EngineInterface,
  sessionId: string,
): Promise<void> {
  const [board, reminders] = await Promise.all([readBoardInState($), readRemindersInState($)])
  const hasNothingToImport =
    board?.outcome === BoardOutcome.Read &&
    board.board.goals.length === 0 &&
    reminders?.outcome === ReminderOutcome.Read &&
    reminders.reminders.length === 0
  if (hasNothingToImport) {
    await showingStoreFailure(
      $,
      () => deleteSessionRecords($, sessionId),
      describeSessionRecordsNotDeleted,
    )
  }
}
