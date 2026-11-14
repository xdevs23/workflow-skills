import type {
  Caught,
  EngineInterface,
  Frozen,
  MatchedHook,
  UiMessageArgument,
  UiMessageResult,
  UiOpenResult,
} from 'claude-code'

import type { CardInPane } from '../../types'
import {
  answerFailedPanePost,
  answerPanePost,
  drawPane,
  recordModuleFault,
  storeOpenedPane,
} from '../paneWorker'
import type { PaneSite } from '../paneWorker'
import { loadRemindersIntoState } from './reminderActions'
import { REMINDERS_PANE, REMINDERS_PANE_MODULE, REMINDERS_PANE_SITE } from './reminderNames'
import type {
  ReminderPaneAction,
  ReminderSaveResult,
  RemindersPaneView,
} from './reminderPaneMessages'
import { readReminderPaneAction } from './reminderPaneReader'
import { PANE_TITLE } from './reminderPaneTexts'
import { readRemindersPaneView } from './reminderPaneView'
import { FAILED_REMINDER_SAVE, saveReminderPaneAction } from './reminderPresses'
import { REMINDERS_PANE_MACHINE } from './remindersPane'
import { storedRemindersPane } from './reminderState'
import type { Failed, ReadReminders } from './reminderStore'
import { REMINDERS_PANE_SUBJECT } from './reminderTexts'

type RemindersPaneSite = typeof REMINDERS_PANE_SITE

/**
 * The reminders of the session read again from the store, and the Reminders pane opened on them.
 */
type PaneOnFreshReminders = { loaded: ReadReminders | Failed; opened: UiOpenResult }

/**
 * Reads the reminders of the session again into the state, and opens the Reminders pane, which
 * shows them. The pane opens without a pressed card where the hooks module draws it, as a surface
 * module does, and tries its surface module again on every surface.
 */
export async function openRemindersPane($: EngineInterface): Promise<PaneOnFreshReminders> {
  await storeOpenedPane(storedRemindersPane($))
  const loaded = await loadRemindersIntoState($, await $.session.id())
  const opened = await $.ui.open({ id: REMINDERS_PANE, title: PANE_TITLE, focus: true })

  return { loaded, opened }
}

function remindersPaneOf(
  $: EngineInterface,
): PaneSite<RemindersPaneView, CardInPane | null, ReminderPaneAction, ReminderSaveResult> {
  return {
    title: PANE_TITLE,
    machine: REMINDERS_PANE_MACHINE,
    readView: () => readRemindersPaneView($),
    readAction: readReminderPaneAction,
    save: action => saveReminderPaneAction($, action),
    failed: FAILED_REMINDER_SAVE,
    subject: REMINDERS_PANE_SUBJECT,
    stored: storedRemindersPane($),
  }
}

/**
 * Draws the Reminders pane as a surface module where the surface draws one, so its presses do not
 * wait for the worker. Elsewhere the hooks module draws it.
 */
export const drawRemindersPane: MatchedHook<'ui.render', RemindersPaneSite> = ($, e) =>
  drawPane($, e, remindersPaneOf($), (Client, props) => (
    <Client key={REMINDERS_PANE_MODULE} module="./remindersPane.tsx" props={props} width="100%" />
  ))

/** Runs the saves posted by the surface module of the Reminders pane, and returns its props. */
export const answerRemindersPanePost: MatchedHook<'ui.message', RemindersPaneSite> = ($, e) =>
  answerPanePost($, e, remindersPaneOf($))

/** Shows the failure of the hook that ran saves of the Reminders pane, and returns its props. */
export function answerFailedRemindersPanePost(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  next: Caught,
): Promise<UiMessageResult> {
  return answerFailedPanePost($, e, next, remindersPaneOf($))
}

/** Draws the Reminders pane by the hooks module on a surface where its surface module failed. */
export const fallBackFromRemindersPaneModule: MatchedHook<'ui.fault', RemindersPaneSite> = async (
  $,
  e,
  next,
) => {
  await recordModuleFault($, remindersPaneOf($), e)

  return next(e)
}
