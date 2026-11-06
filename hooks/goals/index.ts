import type { Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { loadBoardAtStart } from './goalActions'
import { replyWithGoalsHookFailure, runGoalsCommand } from './goalCommands'
import {
  ATTACH_TODO_TOOL,
  DETACH_TODO_TOOL,
  GOALS_COMMAND,
  GOALS_PANE,
  LIST_GOALS_TOOL,
  MARK_GOAL_DONE_TOOL,
  UNMARK_GOAL_DONE_TOOL,
} from './goalNames'
import { endIdleStretch, waitAfterTurn } from './goalIdleReminder'
import {
  addGoalChangesToToolResult,
  addOpenGoalsAfterCompaction,
  submitWithGoalChanges,
} from './goalReminderHooks'
import { handleMarkGoalDoneCall, handleUnmarkGoalDoneCall } from './goalMarkTools'
import { drawGoalsPane } from './goalScreens'
import {
  COMPACTION_SOURCE,
  SWITCHING_SOURCES,
  readGoalsOfSwitchedSession,
  registerGoalsCommand,
} from './goalSession'
import {
  attachTodo,
  denyGoalToolFailure,
  detachTodo,
  listGoals,
  registerGoalTools,
} from './goalTools'

/** Starts every part of the goals in a session, with or without a person at the prompt. */
const startGoals: Hook<'session.start'> = async ($, e, next) => {
  const sessionId = await $.session.id()
  await Promise.all([
    registerGoalsCommand($),
    registerGoalTools($),
    loadBoardAtStart($, sessionId),
  ])

  return next(e)
}

/** Registers the hooks of the goals board. */
export function registerGoals(on: On): void {
  on('session.start', startGoals)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  on('classic.SessionStart', { source: COMPACTION_SOURCE }, addOpenGoalsAfterCompaction)
  // Registered before the tools of the goals, so the results of those tools contain the notes too.
  on('tool.call', EVERY_EVENT, addGoalChangesToToolResult)
  on('prompt.submit', EVERY_EVENT, submitWithGoalChanges)
  on('turn.start', EVERY_EVENT, endIdleStretch)
  on('turn.complete', EVERY_EVENT, waitAfterTurn)
  on('command.run', { command: GOALS_COMMAND }, runGoalsCommand).catch(replyWithGoalsHookFailure)
  on('tool.call', { tool: LIST_GOALS_TOOL }, listGoals).catch(denyGoalToolFailure)
  on('tool.call', { tool: ATTACH_TODO_TOOL }, attachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: DETACH_TODO_TOOL }, detachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: MARK_GOAL_DONE_TOOL }, handleMarkGoalDoneCall).catch(
    denyGoalToolFailure,
  )
  on('tool.call', { tool: UNMARK_GOAL_DONE_TOOL }, handleUnmarkGoalDoneCall).catch(
    denyGoalToolFailure,
  )
  on('ui.render', { component: 'Pane', requestId: GOALS_PANE }, drawGoalsPane)
}
