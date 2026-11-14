import type { Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { PromptFooter } from '../promptFooter'
import { SWITCHING_SOURCES } from '../sessionSources'
import { loadBoardAtStart } from './goalActions'
import { replyWithGoalsHookFailure, runGoalsCommand } from './goalCommands'
import {
  ATTACH_TODO_TOOL,
  DETACH_TODO_TOOL,
  GOALS_COMMAND,
  GOALS_PANE_SITE,
  LIST_GOALS_TOOL,
  MARK_GOAL_DONE_TOOL,
  UNMARK_GOAL_DONE_TOOL,
} from './goalNames'
import { endIdleStretch, waitAfterTurn } from './goalIdleReminder'
import { sendNudgesAfterTurn } from './goalNudge'
import { addGoalChangesToToolResult, submitWithGoalChanges } from './goalReminderHooks'
import { handleMarkGoalDoneCall, handleUnmarkGoalDoneCall } from './goalMarkTools'
import {
  answerFailedGoalsPanePost,
  answerGoalsPanePost,
  drawGoalsPane,
  fallBackFromGoalsPaneModule,
} from './goalScreens'
import { GOALS_BUTTON, openGoalsFromButton } from './goalsButton'
import { readGoalsOfSwitchedSession, registerGoalsCommand } from './goalSession'
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

/** Registers the hooks of the goals board, and places its button on the prompt footer `footer`. */
export function registerGoals(on: On, footer: PromptFooter): void {
  on('session.start', startGoals)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  // Registered before the tools of the goals, so the results of those tools contain the notes too.
  on('tool.call', EVERY_EVENT, addGoalChangesToToolResult)
  on('prompt.submit', EVERY_EVENT, submitWithGoalChanges)
  on('turn.start', EVERY_EVENT, endIdleStretch)
  on('turn.complete', EVERY_EVENT, waitAfterTurn)
  on('turn.complete', EVERY_EVENT, sendNudgesAfterTurn)
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
  on('ui.render', GOALS_PANE_SITE, drawGoalsPane)
  on('ui.message', GOALS_PANE_SITE, answerGoalsPanePost).catch(answerFailedGoalsPanePost)
  on('ui.fault', GOALS_PANE_SITE, fallBackFromGoalsPaneModule)
  on('ui.press', footer.place(GOALS_BUTTON), openGoalsFromButton)
}
