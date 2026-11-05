import type { Hook, On } from 'claude-code'

import { loadBoardShowingFailure } from './goalActions'
import { replyWithGoalsHookFailure, runGoalsCommand } from './goalCommands'
import {
  ATTACH_TODO_TOOL,
  DETACH_TODO_TOOL,
  GOALS_COMMAND,
  GOALS_PANE,
  LIST_GOALS_TOOL,
} from './goalNames'
import { drawGoalsPane } from './goalScreens'
import { SWITCHING_SOURCES, readGoalsOfSwitchedSession, registerGoalsCommand } from './goalSession'
import {
  attachTodo,
  denyGoalToolFailure,
  detachTodo,
  listGoals,
  registerGoalTools,
} from './goalTools'

/** Starts every part of the goals in a session, with or without a person at the prompt. */
const startGoals: Hook<'session.start'> = async ($, e, next) => {
  await Promise.all([
    registerGoalsCommand($),
    registerGoalTools($),
    loadBoardShowingFailure($, await $.session.id()),
  ])

  return next(e)
}

/** Registers the hooks of the goals board. */
export function registerGoals(on: On): void {
  on('session.start', startGoals)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  on('command.run', { command: GOALS_COMMAND }, runGoalsCommand).catch(replyWithGoalsHookFailure)
  on('tool.call', { tool: LIST_GOALS_TOOL }, listGoals).catch(denyGoalToolFailure)
  on('tool.call', { tool: ATTACH_TODO_TOOL }, attachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: DETACH_TODO_TOOL }, detachTodo).catch(denyGoalToolFailure)
  on('ui.render', { component: 'Pane', requestId: GOALS_PANE }, drawGoalsPane)
}
