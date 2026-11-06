import type { EngineInterface, MatchedHook, RenderInput } from 'claude-code'

import { showFailure } from '../failureToast'
import { hasFooterRoomForButton, hintColumnsOn, mostColumnsOf, recordHintColumns } from './footerRoom'
import { Outcome } from './board'
import { openGoalsPaneOnFreshBoard } from './goalScreens'
import { readBoardInState } from './goalState'
import { GOALS_BUTTON_LABEL, describeNotRead, describePaneNotOpenedWithCommands } from './goalTexts'

export const OPEN_GOALS_KEY = 'open-goals'

/**
 * Draws the hint line of the prompt footer as the engine draws it, and records its columns for
 * the Goals button on the same row. A change of the columns draws the button again.
 */
export const measurePromptHint: MatchedHook<'ui.render', { component: 'PromptHint' }> = (
  $,
  e,
  next,
) => {
  if (recordHintColumns(e.surface, mostColumnsOf(e.props.hint))) {
    $.ui.invalidate('ui.render')
  }

  return next(e)
}

/**
 * Draws the mode labels of the prompt footer as the engine draws them, with a Goals button after
 * them, once the session has read its board and while the footer row has room for the button.
 */
export const drawGoalsButton: MatchedHook<'ui.render', { component: 'SessionMode' }> = async (
  $,
  e,
  next,
) => {
  if (!hasRoomForGoalsButton(e) || (await readBoardInState($)) === null) {
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
 * Whether the footer row of `e` has room for the Goals button. Before the surface has measured its
 * viewport and drawn its hint line, the room is not known and the button is left out.
 */
function hasRoomForGoalsButton(e: RenderInput<'SessionMode'>): boolean {
  const hintColumns = hintColumnsOn(e.surface)

  return (
    e.viewport !== undefined &&
    hintColumns !== undefined &&
    hasFooterRoomForButton(
      { columns: e.viewport.columns, hintColumns, modes: e.props.modes },
      GOALS_BUTTON_LABEL,
    )
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
