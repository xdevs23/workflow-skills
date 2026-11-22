import type { EngineInterface, Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { registerDeclaredTools } from '../pluginTools'
import type { DeclaredToolSpecs, PluginTools } from '../pluginTools'
import type { PromptFooter } from '../promptFooter'
import { SWITCHING_SOURCES } from '../sessionSources'
import { loadBoardAtStart } from './goalActions'
import {
  ATTACH_TODO_TOOL,
  DETACH_TODO_TOOL,
  GOALS_PANE_SITE,
  LIST_GOALS_TOOL,
  MARK_GOAL_DONE_TOOL,
  UNMARK_GOAL_DONE_TOOL,
} from './goalNames'
import { showNudgesWaitingAfterStop } from './goalNudge'
import { addGoalChangesToToolResult, submitWithGoalChanges } from './goalReminderHooks'
import {
  answerFailedGoalsPanePost,
  answerGoalsPanePost,
  drawGoalsPane,
  fallBackFromGoalsPaneModule,
} from './goalScreens'
import { GOALS_BUTTON, openGoalsFromButton } from './goalsButton'
import { readGoalsOfSwitchedSession } from './goalSession'
import {
  GOAL_TOOL_SPECS,
  attachTodo,
  denyGoalToolFailure,
  detachTodo,
  listGoals,
  markGoalDone,
  unmarkGoalDone,
} from './goalTools'

type StartGoals = Hook<'session.start'>

/**
 * Starts every part of the goals in a session, with or without a person at the prompt, and
 * registers the goal tools declared in `declaredTools`.
 */
async function startGoals(
  $: EngineInterface,
  e: Parameters<StartGoals>[1],
  next: Parameters<StartGoals>[2],
  declaredTools: DeclaredToolSpecs,
): Promise<Awaited<ReturnType<StartGoals>>> {
  const sessionId = await $.session.id()
  await Promise.all([registerDeclaredTools($, declaredTools), loadBoardAtStart($, sessionId)])

  return next(e)
}

/**
 * Registers the hooks of the goals board, places its button on the prompt footer `footer`, and
 * declares its tools in `tools`.
 */
export function registerGoals(on: On, footer: PromptFooter, tools: PluginTools): void {
  const goalToolSpecs = tools.declare(GOAL_TOOL_SPECS)
  on('session.start', ($, e, next) => startGoals($, e, next, goalToolSpecs))
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  // Registered before the tools of the goals, so the results of those tools contain the notes too.
  on('tool.call', EVERY_EVENT, addGoalChangesToToolResult)
  on('prompt.submit', EVERY_EVENT, submitWithGoalChanges)
  on('turn.complete', EVERY_EVENT, showNudgesWaitingAfterStop)
  on('tool.call', { tool: LIST_GOALS_TOOL }, listGoals).catch(denyGoalToolFailure)
  on('tool.call', { tool: ATTACH_TODO_TOOL }, attachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: DETACH_TODO_TOOL }, detachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: MARK_GOAL_DONE_TOOL }, markGoalDone).catch(denyGoalToolFailure)
  on('tool.call', { tool: UNMARK_GOAL_DONE_TOOL }, unmarkGoalDone).catch(denyGoalToolFailure)
  on('ui.render', GOALS_PANE_SITE, drawGoalsPane)
  on('ui.message', GOALS_PANE_SITE, answerGoalsPanePost).catch(answerFailedGoalsPanePost)
  on('ui.fault', GOALS_PANE_SITE, fallBackFromGoalsPaneModule)
  on('ui.press', footer.place(GOALS_BUTTON), openGoalsFromButton)
}
