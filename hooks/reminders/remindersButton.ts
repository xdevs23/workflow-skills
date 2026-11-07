import type { Hook } from 'claude-code'

import { showFailuresOfPress } from '../failureToast'
import { describePaneNotOpened } from '../paneOpening'
import type { FooterButton } from '../promptFooter'
import { Outcome } from './reminders'
import { openRemindersPane } from './reminderScreens'
import { PANE_TITLE, REMINDERS_BUTTON_LABEL, describeNotRead } from './reminderTexts'

/**
 * Reads the reminders of the session again and opens the Reminders pane on them, as /reminders
 * does. The engine opens at most one pane per id. A press while the pane is open therefore shows
 * that same pane.
 */
export const openRemindersFromButton: Hook<'ui.press'> = async ($, e) => {
  const { loaded, opened } = await openRemindersPane($)

  return showFailuresOfPress($, e, [
    ...(loaded.outcome === Outcome.Failed ? [describeNotRead(loaded)] : []),
    ...(opened.isPlaced
      ? []
      : [describePaneNotOpened(PANE_TITLE, opened.reason, { button: REMINDERS_BUTTON.label })]),
  ])
}

/** The Reminders button on the prompt footer. */
export const REMINDERS_BUTTON: FooterButton = {
  key: 'open-reminders',
  label: REMINDERS_BUTTON_LABEL,
}
