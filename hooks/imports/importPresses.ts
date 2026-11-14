import type { EngineInterface } from 'claude-code'

import { showFailure } from '../failureToast'
import { Outcome as BoardOutcome } from '../goals/board'
import { describeStoreFailure } from '../goals/boardStore'
import { importGoalsIntoSession } from '../goals/goalActions'
import { GOALS_COMMAND } from '../goals/goalNames'
import { GOALS_PANE_SUBJECT, GOALS_SUBJECT } from '../goals/goalTexts'
import { describeGoalsPaneFailures, openGoalsPaneOnFreshBoard } from '../goals/goalScreens'
import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../pluginStore'
import { importRemindersIntoSession } from '../reminders/reminderActions'
import { REMINDERS_COMMAND } from '../reminders/reminderNames'
import { Outcome as ReminderOutcome } from '../reminders/reminders'
import { describeRemindersPaneFailures, openRemindersPane } from '../reminders/reminderScreens'
import { REMINDERS_PANE_SUBJECT, REMINDERS_SUBJECT } from '../reminders/reminderTexts'
import { IMPORT_NAMES } from './importNames'
import { ImportKind, ImportOutcome, SessionsShown } from './importPaneMessages'
import type { ImportAction, ImportResult } from './importPaneMessages'
import { describeImportNote, uniqueIdLengthOf } from './importPaneTexts'
import type { LostDependency, NamedSession } from './importPaneTexts'
import { readImportableSessionsInState } from './importState'
import { describeNotImported, describeNothingImported } from './importTexts'

/**
 * How many goals or reminders an import stored, with each new goal whose dependency was not carried
 * over, or the text for an import that stored none or failed.
 */
type Imported =
  | {
      outcome: ImportOutcome.Imported
      count: number
      lostDependencies: readonly LostDependency[]
    }
  | { outcome: ImportOutcome.Failed; failure: string }

/**
 * The texts about a failed hook of an import of each kind name these subjects: of the command, and
 * of the save of an import, which changes the goals or the reminders of the session.
 */
type ImportTarget = { subjects: { command: HookSubject; save: HookSubject } }

export const IMPORT_TARGETS: Record<ImportKind, ImportTarget> = {
  [ImportKind.Goals]: { subjects: { command: GOALS_SUBJECT, save: GOALS_PANE_SUBJECT } },
  [ImportKind.Reminders]: {
    subjects: { command: REMINDERS_SUBJECT, save: REMINDERS_PANE_SUBJECT },
  },
}

// Claude Code 2.1.321 refuses to load a hooks module that passes $ to a function read from a table
// (seen on 2026-11-14), so the work of each kind runs from a switch.

/** Stores the rows of `action` of `kind` in the session `into`. */
async function importRows(
  $: EngineInterface,
  kind: ImportKind,
  into: string,
  action: ImportAction,
): Promise<Imported> {
  switch (kind) {
    case ImportKind.Goals:
      return importGoalRows($, into, action)
    case ImportKind.Reminders:
      return importReminderRows($, into, action)
  }
}

/** Opens the pane that shows the goals or reminders of `kind` with `notice`, and the failures. */
async function openTargetPane(
  $: EngineInterface,
  kind: ImportKind,
  notice: string,
): Promise<string[]> {
  switch (kind) {
    case ImportKind.Goals:
      return describeGoalsPaneFailures(await openGoalsPaneOnFreshBoard($, notice), {
        command: GOALS_COMMAND,
      })
    case ImportKind.Reminders:
      return describeRemindersPaneFailures(await openRemindersPane($, notice), {
        command: REMINDERS_COMMAND,
      })
  }
}

async function importGoalRows(
  $: EngineInterface,
  into: string,
  { fromSessionId, pickedIds }: ImportAction,
): Promise<Imported> {
  const imported = await importGoalsIntoSession($, {
    into,
    from: fromSessionId,
    picked: new Set(pickedIds),
  })
  if (imported.outcome === BoardOutcome.Failed) {
    return {
      outcome: ImportOutcome.Failed,
      failure: describeNotImported(ImportKind.Goals, describeStoreFailure(imported)),
    }
  }

  return importedOf(
    ImportKind.Goals,
    imported.imported.length,
    imported.imported.flatMap(({ goal, lostDependency }) =>
      lostDependency === undefined ? [] : [{ goal: goal.number, dependedOn: lostDependency }],
    ),
  )
}

async function importReminderRows(
  $: EngineInterface,
  into: string,
  { fromSessionId, pickedIds }: ImportAction,
): Promise<Imported> {
  const imported = await importRemindersIntoSession($, {
    into,
    from: fromSessionId,
    picked: new Set(pickedIds),
  })

  return imported.outcome === ReminderOutcome.Failed
    ? {
        outcome: ImportOutcome.Failed,
        failure: describeNotImported(ImportKind.Reminders, describeFailedStoreCall(imported)),
      }
    : importedOf(ImportKind.Reminders, imported.imported.length, [])
}

/**
 * The import of `count` goals or reminders of `kind`, or the text for an import of none, since
 * each ticked one is in the session already or is gone from the session it came from.
 */
function importedOf(
  kind: ImportKind,
  count: number,
  lostDependencies: readonly LostDependency[],
): Imported {
  return count === 0
    ? { outcome: ImportOutcome.Failed, failure: describeNothingImported(kind) }
    : { outcome: ImportOutcome.Imported, count, lostDependencies }
}

/** The result of an import whose hook failed. */
export const FAILED_IMPORT: ImportResult = { outcome: ImportOutcome.Failed }

/**
 * Runs `action`, the import of the pane of `kind`, into the running session. A failed import shows
 * a toast, and the pane stays open with its rows ticked.
 */
export async function saveImport(
  $: EngineInterface,
  kind: ImportKind,
  action: ImportAction,
): Promise<ImportResult> {
  const sessionId = await $.session.id()
  const imported = await importRows($, kind, sessionId, action)
  if (imported.outcome === ImportOutcome.Failed) {
    showFailure($, imported.failure)

    return FAILED_IMPORT
  }
  const notice = describeImportNote({
    kind,
    count: imported.count,
    lostDependencies: imported.lostDependencies,
    ...(await namedSessionOf($, action.fromSessionId)),
  })
  await $.ui.close({ id: IMPORT_NAMES[kind].pane })
  for (const text of await openTargetPane($, kind, notice)) {
    showFailure($, text)
  }

  return { outcome: ImportOutcome.Imported }
}

/**
 * The session `sessionId` as the import pane listed it, named by its start time, and the length of
 * the start of a session id that tells every session listed apart.
 */
async function namedSessionOf(
  $: EngineInterface,
  sessionId: string,
): Promise<{ from: NamedSession; idLength: number }> {
  const inState = await readImportableSessionsInState($)
  const sessions = inState?.shown === SessionsShown.Read ? inState.sessions : []
  const startedAt = sessions.find(session => session.sessionId === sessionId)?.start?.startedAt

  return {
    from: { sessionId, ...(startedAt === undefined ? {} : { startedAt }) },
    idLength: uniqueIdLengthOf(sessions.map(session => session.sessionId)),
  }
}
