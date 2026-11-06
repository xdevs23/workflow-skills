import type { EngineInterface, MatchedHook } from 'claude-code'

import { showFailure } from '../failureToast'
import { BUTTON_GAP_COLUMNS, hasFooterRoomForButton } from '../promptFooter'
import type { FooterRow } from '../promptFooter'
import { Outcome } from './board'
import { openGoalsPaneOnFreshBoard } from './goalScreens'
import { GOALS_BUTTON_LABEL, describeNotRead, describePaneNotOpenedWithCommands } from './goalTexts'

export const OPEN_GOALS_KEY = 'open-goals'

type DrawModes = MatchedHook<'ui.render', { component: 'SessionMode' }>

/**
 * Draws the mode labels of the prompt footer as the engine draws them, with a Goals button after
 * them while `row` has room for the button.
 */
export async function drawGoalsButton(
  row: FooterRow,
  $: EngineInterface,
  e: Parameters<DrawModes>[1],
  next: Parameters<DrawModes>[2],
): Promise<Awaited<ReturnType<DrawModes>>> {
  if (!(await hasFooterRoomForButton($, row, e, GOALS_BUTTON_LABEL))) {
    return next(e)
  }
  const { Box, Button } = $.ui.resolve(e)

  return (
    <Box columnGap={BUTTON_GAP_COLUMNS}>
      {await next(e)}
      <Button
        key={OPEN_GOALS_KEY}
        label={GOALS_BUTTON_LABEL}
        dimColor
        onPress={() => openFromButton($)}
      />
    </Box>
  )
}

/**
 * Reads the board of the session again and opens the Goals pane on it. The engine opens at most one
 * pane per id, so a press while the pane is open shows that same pane.
 */
async function openFromButton($: EngineInterface): Promise<void> {
  const { loaded, opened } = await openGoalsPaneOnFreshBoard($)
  if (loaded.outcome === Outcome.Failed) {
    showFailure($, describeNotRead(loaded.failure))
  }
  if (!opened.isPlaced) {
    showFailure($, describePaneNotOpenedWithCommands(opened.reason))
  }
}
