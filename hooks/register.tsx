import type { Register } from 'claude-code'

import { compactWithNotes } from './afterCompaction'
import { EVERY_EVENT } from './everyEvent'
import { registerGoals } from './goals'
import { openGoalsAfterCompaction } from './goals/goalReminderHooks'
import { blockStopOnHintPhrase } from './hints'
import { registerImports } from './imports'
import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, WITHDRAW_TOOL } from './names'
import { registerNeededSkills } from './neededSkills'
import { createPromptFooter, registerPromptFooter } from './promptFooter'
import {
  addAnswersToToolResult,
  askQuestion,
  completeQuestionTurn,
  denyHookFailure,
  listQuestions,
  markTurnRunning,
  readQuestionsOfStartedSession,
  replyWithHookFailure,
  runAnswerCommand,
  startQuestions,
  submitWithAnswers,
  withdrawQuestion,
} from './questionHooks'
import { drawQuestionBand, drawQuestionPane } from './questionScreens'
import { registerReminders } from './reminders'
import { remindersAfterCompaction } from './reminders/eventCadence'
import { registerRulesBanner } from './rulesBanner'
import { registerSelfCheck } from './selfCheck'
import { registerSessionRecords } from './sessions'
import { registerTodoClauseNotes } from './todoClauseNotes'

export const register: Register = on => {
  // Registered before every other hook of this plugin on a prompt, so it reads the prompt as typed.
  registerSessionRecords(on)
  on('session.start', { isInteractive: true }, startQuestions)
  on('classic.SessionStart', readQuestionsOfStartedSession)
  // The engine passes `$` only to a function named at the call, so each note sent after a
  // compaction is named here. The open goals come before the reminders.
  on('session.compact', EVERY_EVENT, ($, e, next) =>
    compactWithNotes($, e, next, [
      openGoalsAfterCompaction($),
      remindersAfterCompaction($),
    ]),
  )
  // Registered before the tools of this plugin, so their results also contain the answers.
  on('tool.call', EVERY_EVENT, addAnswersToToolResult)
  // Registered before the tools of this plugin, so it denies a call before the tool runs.
  registerNeededSkills(on)
  on('tool.call', { tool: ASK_TOOL }, askQuestion).catch(denyHookFailure)
  on('tool.call', { tool: LIST_TOOL }, listQuestions).catch(denyHookFailure)
  on('tool.call', { tool: WITHDRAW_TOOL }, withdrawQuestion).catch(denyHookFailure)
  on('prompt.submit', EVERY_EVENT, submitWithAnswers)
  on('turn.start', EVERY_EVENT, markTurnRunning)
  on('turn.complete', EVERY_EVENT, completeQuestionTurn)
  on('classic.Stop', blockStopOnHintPhrase)
  on('command.run', { command: ANSWER_COMMAND }, runAnswerCommand).catch(replyWithHookFailure)
  on('ui.render', { component: 'AbovePrompt' }, drawQuestionBand)
  on('ui.render', { component: 'Pane', requestId: PANE }, drawQuestionPane)
  // The footer draws the buttons in the order placed: Goals first, then Reminders.
  const footer = createPromptFooter()
  registerPromptFooter(on, footer)
  registerGoals(on, footer)
  registerReminders(on, footer)
  registerImports(on)
  registerSelfCheck(on)
  registerTodoClauseNotes(on)
  registerRulesBanner(on)
}
