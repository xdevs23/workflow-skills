import type {
  Caught,
  EngineInterface,
  Frozen,
  MatchedHook,
  UiMessageArgument,
  UiMessageResult,
  UiOpenResult,
} from 'claude-code'

import type { GoalInPane, UnreadBoard } from '../../types'
import {
  answerFailedPanePost,
  answerPanePost,
  drawPane,
  recordModuleFault,
  storeOpenedPane,
} from '../paneWorker'
import type { PaneSite } from '../paneWorker'
import type { Read } from './board'
import { loadBoardIntoState } from './goalActions'
import { GOALS_PANE, GOALS_PANE_MODULE, GOALS_PANE_SITE } from './goalNames'
import type { GoalPaneAction, GoalSaveResult, GoalsPaneView } from './goalPaneMessages'
import { readGoalPaneAction } from './goalPaneReader'
import { PANE_TITLE } from './goalPaneTexts'
import { readGoalsPaneView } from './goalPaneView'
import { FAILED_GOAL_SAVE, saveGoalPaneAction } from './goalPresses'
import { GOALS_PANE_MACHINE } from './goalsPane'
import { storedGoalsPane } from './goalState'
import { GOALS_PANE_SUBJECT } from './goalTexts'

type GoalsPaneSite = typeof GOALS_PANE_SITE

/** The board of the session read again from the store, and the Goals pane opened on it. */
type PaneOnFreshBoard = { loaded: Read | UnreadBoard; opened: UiOpenResult }

/**
 * Reads the board of the session again into the state, and opens the Goals pane, which shows it.
 * The pane opens without a pressed goal where the hooks module draws it, as a surface module does,
 * and tries its surface module again on every surface.
 */
export async function openGoalsPaneOnFreshBoard($: EngineInterface): Promise<PaneOnFreshBoard> {
  const sessionId = await $.session.id()
  await storeOpenedPane(storedGoalsPane($))
  const loaded = await loadBoardIntoState($, sessionId)
  const opened = await $.ui.open({ id: GOALS_PANE, title: PANE_TITLE, focus: true })

  return { loaded, opened }
}

function goalsPaneOf(
  $: EngineInterface,
): PaneSite<GoalsPaneView, GoalInPane | null, GoalPaneAction, GoalSaveResult> {
  return {
    title: PANE_TITLE,
    machine: GOALS_PANE_MACHINE,
    readView: () => readGoalsPaneView($),
    readAction: readGoalPaneAction,
    save: action => saveGoalPaneAction($, action),
    failed: FAILED_GOAL_SAVE,
    subject: GOALS_PANE_SUBJECT,
    stored: storedGoalsPane($),
  }
}

/**
 * Draws the Goals pane as a surface module where the surface draws one, so its presses do not wait
 * for the worker. Elsewhere the hooks module draws it.
 */
export const drawGoalsPane: MatchedHook<'ui.render', GoalsPaneSite> = ($, e) =>
  drawPane($, e, goalsPaneOf($), (Client, props) => (
    <Client key={GOALS_PANE_MODULE} module="./goalsPane.tsx" props={props} width="100%" />
  ))

/** Runs the saves posted by the surface module of the Goals pane, and returns its props. */
export const answerGoalsPanePost: MatchedHook<'ui.message', GoalsPaneSite> = ($, e) =>
  answerPanePost($, e, goalsPaneOf($))

/** Shows the failure of the hook that ran saves of the Goals pane, and returns its props. */
export function answerFailedGoalsPanePost(
  $: EngineInterface,
  e: Frozen<UiMessageArgument>,
  next: Caught,
): Promise<UiMessageResult> {
  return answerFailedPanePost($, e, next, goalsPaneOf($))
}

/** Draws the Goals pane by the hooks module on a surface where its surface module failed. */
export const fallBackFromGoalsPaneModule: MatchedHook<'ui.fault', GoalsPaneSite> = async (
  $,
  e,
  next,
) => {
  await recordModuleFault($, goalsPaneOf($), e)

  return next(e)
}
