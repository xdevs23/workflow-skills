import type { Hook } from 'claude-code'

import { showFailuresOfPress } from '../failureToast'
import type { FooterButton } from '../promptFooter'
import { describeGoalsPaneFailures, openGoalsPaneOnFreshBoard } from './goalScreens'
import { GOALS_BUTTON_LABEL } from './goalTexts'

/**
 * Reads the board of the session again and opens the Goals pane on it. The engine opens at most one
 * pane per id. A press while the pane is open therefore shows that same pane.
 */
export const openGoalsFromButton: Hook<'ui.press'> = async ($, e) =>
  showFailuresOfPress(
    $,
    e,
    describeGoalsPaneFailures(await openGoalsPaneOnFreshBoard($), { button: GOALS_BUTTON.label }),
  )

/** The Goals button on the prompt footer. */
export const GOALS_BUTTON: FooterButton = {
  key: 'open-goals',
  label: GOALS_BUTTON_LABEL,
}
