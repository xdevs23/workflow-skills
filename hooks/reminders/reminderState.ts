import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { CardInPane, Reminder, ReminderNextSends, SessionReminders } from '../../types'
import { NEW_PANE_RECORD } from '../paneWorker'
import type { StoredPane } from '../paneWorker'
import { keepReadOverFailure, ofRunningSession, updateOfSession } from '../sessionBoundState'
import type { ReminderPaneAction, ReminderSaveResult } from './reminderPaneMessages'
import { Outcome } from './reminders'
import type { Failed, ReadReminders, RemindersNotRead } from './reminderStore'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the reminders is written in this file with its plugin and key as literals.
const sessionReminders = atom(
  { plugin: 'workflow-skills', key: 'sessionReminders' } as const,
  null,
)
const remindersPane = atom(
  { plugin: 'workflow-skills', key: 'remindersPane' } as const,
  NEW_PANE_RECORD,
  { shape: 'saves-by-action-id' },
)
const remindersPaneTyped = atom(
  { plugin: 'workflow-skills', key: 'remindersPaneTyped' } as const,
  null,
)
const reminderNextSends = atom(
  { plugin: 'workflow-skills', key: 'reminderNextSends' } as const,
  null,
)

/** The next send times of reminders, by the id of their cadence kind, then of the reminder. */
export type NextSends = ReminderNextSends['byKind']

/**
 * The reminders in the state while their session runs, and null otherwise, such as before the
 * session read them or after a switch to another session.
 */
export async function readRemindersInState($: EngineInterface): Promise<SessionReminders | null> {
  return ofRunningSession($, await read($, sessionReminders))
}

/**
 * Puts the reminders read for the session `sessionId` into the state, unless another session runs
 * by now, and returns the reminders of that session in the state after it, when they were read.
 * Reminders that could not be read replace only reminders that were not read either, so a failed
 * request leaves the last reminders read on screen.
 */
export async function setLoadedReminders(
  $: EngineInterface,
  sessionId: string,
  loaded: ReadReminders | Failed,
): Promise<readonly Reminder[] | undefined> {
  const inState = await updateOfSession<SessionReminders>(
    $,
    sessionId,
    shown => keepReadOverFailure(shown, { sessionId, ...plainOf(loaded) }, Outcome.Read),
    changeInState => update($, sessionReminders, changeInState),
  )

  return inState?.outcome === Outcome.Read ? inState.reminders : undefined
}

/** `loaded` as plain data for the state, a failure with the message of its error alone. */
function plainOf(loaded: ReadReminders | Failed): ReadReminders | RemindersNotRead {
  if (loaded.outcome === Outcome.Read) {
    return loaded
  }
  const { outcome, call, key, cause } = loaded

  return { outcome, call, key, cause: { message: cause.message } }
}

/** The Reminders pane as the hooks module stores it. */
export function storedRemindersPane(
  $: EngineInterface,
): StoredPane<CardInPane | null, ReminderPaneAction, ReminderSaveResult> {
  return {
    read: () => read($, remindersPane),
    update: change => update($, remindersPane, change),
    readTyped: () => read($, remindersPaneTyped),
    updateTyped: change => update($, remindersPaneTyped, change),
  }
}

/**
 * Puts the next send times `at` of the reminders of the cadence kind `kindId` into the state, by
 * the id of the reminder, in place of those the kind put there before, unless another session runs
 * by now.
 */
export async function setNextSends(
  $: EngineInterface,
  sessionId: string,
  kindId: string,
  at: Readonly<Record<string, number>>,
): Promise<void> {
  await updateOfSession<ReminderNextSends>(
    $,
    sessionId,
    own => ({ sessionId, byKind: { ...own?.byKind, [kindId]: at } }),
    changeInState => update($, reminderNextSends, changeInState),
  )
}

/** The next send times of the reminders of the running session, as their kinds put them. */
export async function readNextSends($: EngineInterface): Promise<NextSends> {
  return (await ofRunningSession($, await read($, reminderNextSends)))?.byKind ?? {}
}
