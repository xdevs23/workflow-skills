import type { Register } from 'claude-code'

import { EVERY_EVENT } from './everyEvent'
import { registerGoals } from './goals'
import { blockStopOnHintPhrase } from './hints'
import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, SKILL_TOOL, WITHDRAW_TOOL } from './names'
import { FooterRow, registerPromptFooter } from './promptFooter'
import {
  addAnswersToToolResult,
  askQuestion,
  completeQuestionTurn,
  denyHookFailure,
  listQuestions,
  markTurnRunning,
  readQuestionsOfStartedSession,
  recordSkillLoad,
  replyWithHookFailure,
  runAnswerCommand,
  startQuestions,
  submitWithAnswers,
  withdrawQuestion,
} from './questionHooks'
import { drawQuestionBand, drawQuestionPane } from './questionScreens'
import { registerReminders } from './reminders'
import { registerSelfCheck } from './selfCheck'

export const register: Register = on => {
  const footerRow = new FooterRow()
  on('session.start', { isInteractive: true }, startQuestions)
  on('classic.SessionStart', readQuestionsOfStartedSession)
  // Registered before the tools of this plugin, so their results also contain the answers.
  on('tool.call', EVERY_EVENT, addAnswersToToolResult)
  on('tool.call', { tool: SKILL_TOOL }, recordSkillLoad)
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
  registerPromptFooter(on, footerRow)
  registerGoals(on, footerRow)
  registerReminders(on)
  registerSelfCheck(on)
}
