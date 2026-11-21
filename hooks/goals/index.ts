import type { Hook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import { declarePluginTools } from '../pluginTools'
import type { PromptFooter } from '../promptFooter'
import { SWITCHING_SOURCES } from '../sessionSources'
import { loadBoardAtStart } from './goalActions'
import { applyGoalCheckerAnswer } from './goalCheck'
import { ATTACH_TODO_TOOL, DETACH_TODO_TOOL, GOALS_PANE_SITE, LIST_GOALS_TOOL } from './goalNames'
import {
  endIdleStretch,
  missingWorkSource,
  waitAfterTurn,
  waitAgainAfterCheck,
} from './goalIdleCheck'
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
  registerGoalTools,
} from './goalTools'

/** Starts every part of the goals in a session, with or without a person at the prompt. */
const startGoals: Hook<'session.start'> = async ($, e, next) => {
  const sessionId = await $.session.id()
  await Promise.all([registerGoalTools($), loadBoardAtStart($, sessionId)])

  return next(e)
}

/** Registers the hooks of the goals board, and places its button on the prompt footer `footer`. */
export function registerGoals(on: On, footer: PromptFooter): void {
  declarePluginTools(GOAL_TOOL_SPECS)
  on('session.start', startGoals)
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, readGoalsOfSwitchedSession)
  // Registered before the tools of the goals, so the results of those tools contain the notes too.
  on('tool.call', EVERY_EVENT, addGoalChangesToToolResult)
  on('prompt.submit', EVERY_EVENT, submitWithGoalChanges)
  on('turn.start', EVERY_EVENT, endIdleStretch)
  on('turn.complete', EVERY_EVENT, waitAfterTurn)
  on('turn.complete', EVERY_EVENT, showNudgesWaitingAfterStop)
  on('tool.call', { tool: LIST_GOALS_TOOL }, listGoals).catch(denyGoalToolFailure)
  on('tool.call', { tool: ATTACH_TODO_TOOL }, attachTodo).catch(denyGoalToolFailure)
  on('tool.call', { tool: DETACH_TODO_TOOL }, detachTodo).catch(denyGoalToolFailure)
  // The engine passes `$` only to a function named at the call, so the goal check is handed the
  // delivery of the goals found open and the wait after a failed check here.
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    applyGoalCheckerAnswer($, e, next, missingWorkSource($), checked =>
      waitAgainAfterCheck($, checked),
    ),
  )
  on('ui.render', GOALS_PANE_SITE, drawGoalsPane)
  on('ui.message', GOALS_PANE_SITE, answerGoalsPanePost).catch(answerFailedGoalsPanePost)
  on('ui.fault', GOALS_PANE_SITE, fallBackFromGoalsPaneModule)
  on('ui.press', footer.place(GOALS_BUTTON), openGoalsFromButton)
}
