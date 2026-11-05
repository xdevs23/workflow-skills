import type { Hook, On } from 'claude-code'

import { loadBoardShowingFailure } from './goalActions'
import { replyWithGoalsHookFailure, runGoalsCommand } from './goalCommands'
import { GOALS_COMMAND, GOALS_PANE } from './goalNames'
import { drawGoalsPane } from './goalScreens'
import { SWITCHING_SOURCES, readGoalsOfSwitchedSession, registerGoalsCommand } from './goalSession'

/** Starts every part of the goals in a session, with or without a person at the prompt. */
const startGoals: Hook<'session.start'> = async ($, e, next) => {
  await Promise.all([registerGoalsCommand($), loadBoardShowingFailure($, await $.session.id())])

  return next(e)
}

/** Registers the hooks of the goals board. */
export function registerGoals(on: On): void {
  on('session.start', startGoals)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  on('command.run', { command: GOALS_COMMAND }, runGoalsCommand).catch(replyWithGoalsHookFailure)
  on('ui.render', { component: 'Pane', requestId: GOALS_PANE }, drawGoalsPane)
}
