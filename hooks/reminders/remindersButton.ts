import type { Hook } from 'claude-code'

import { showFailuresOfPress } from '../failureToast'
import type { FooterButton } from '../promptFooter'
import { describeRemindersPaneFailures, openRemindersPane } from './reminderScreens'
import { REMINDERS_BUTTON_LABEL } from './reminderTexts'

/**
 * Reads the reminders of the session again and opens the Reminders pane on them, as /reminders
 * does. The engine opens at most one pane per id. A press while the pane is open therefore shows
 * that same pane.
 */
export const openRemindersFromButton: Hook<'ui.press'> = async ($, e) =>
  showFailuresOfPress(
    $,
    e,
    describeRemindersPaneFailures(await openRemindersPane($), {
      button: REMINDERS_BUTTON.label,
    }),
  )

/** The Reminders button on the prompt footer. */
export const REMINDERS_BUTTON: FooterButton = {
  key: 'open-reminders',
  label: REMINDERS_BUTTON_LABEL,
}
