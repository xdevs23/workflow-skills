import type { EngineInterface, MatchedHook } from 'claude-code'

import { showFailure } from '../failureToast'
import { loadBoardShowingFailure } from './goalActions'
import { openGoalsPane } from './goalScreens'
import { readBoardInState } from './goalState'
import { COMMANDS_IN_PLACE_OF_PANE, GOALS_BUTTON_LABEL, describePaneNotOpened } from './goalTexts'

export const OPEN_GOALS_KEY = 'open-goals'

/**
 * Draws the mode labels of the prompt footer as the engine draws them, with a Goals button after
 * them, once the session has read its board.
 */
export const drawGoalsButton: MatchedHook<'ui.render', { component: 'SessionMode' }> = async (
  $,
  e,
  next,
) => {
  if ((await readBoardInState($)) === null) {
    return next(e)
  }
  const { Box, Button } = $.ui.resolve(e)

  return (
    <Box columnGap={1}>
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
 * Reads the board of the session again and opens the Goals pane on it. The engine keeps one pane
 * per id, so a press while the pane is open opens no second one.
 */
async function openFromButton($: EngineInterface): Promise<void> {
  await loadBoardShowingFailure($, await $.session.id())
  const opened = await openGoalsPane($)
  if (!opened.isPlaced) {
    showFailure($, `${describePaneNotOpened(opened.reason)} ${COMMANDS_IN_PLACE_OF_PANE}`)
  }
}
