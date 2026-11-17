import type { EngineInterface, Register } from 'claude-code'

import { compactWithNotes } from './afterCompaction'
import { answersSource } from './delivery'
import { EVERY_EVENT } from './everyEvent'
import { registerGoals } from './goals'
import { openGoalsAfterCompaction } from './goals/goalReminderHooks'
import { callToolWithHeldTexts, completeTurnWithHeldTexts, submitWithHeldTexts } from './heldTexts'
import type { HeldTextSource } from './heldTexts'
import { blockStopOnHintPhrase } from './hints'
import { registerImports } from './imports'
import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, WITHDRAW_TOOL } from './names'
import { registerNeededSkills } from './neededSkills'
import { createPromptFooter, registerPromptFooter } from './promptFooter'
import {
  askQuestion,
  denyHookFailure,
  listQuestions,
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
import { registerRoast } from './roast'
import { roastsSource } from './roast/roastDelivery'
import { registerRulesBanner } from './rulesBanner'
import { registerSelfCheck } from './selfCheck'
import { registerSessionRecords } from './sessions'
import { registerTodoClauseNotes } from './todoClauseNotes'
import { markTurnRunning } from './turnState'

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
  // Registered before the tools of this plugin, so their results also contain the held texts.
  on('tool.call', EVERY_EVENT, ($, e, next) =>
    callToolWithHeldTexts($, e, next, heldTextSourcesOf($)),
  )
  // Registered before the tools of this plugin, so it denies a call before the tool runs.
  registerNeededSkills(on)
  on('tool.call', { tool: ASK_TOOL }, askQuestion).catch(denyHookFailure)
  on('tool.call', { tool: LIST_TOOL }, listQuestions).catch(denyHookFailure)
  on('tool.call', { tool: WITHDRAW_TOOL }, withdrawQuestion).catch(denyHookFailure)
  on('prompt.submit', EVERY_EVENT, submitWithAnswers)
  // Answers go beside a prompt through submitWithAnswers, which marks them as read only once the
  // prompt entered with them.
  on('prompt.submit', EVERY_EVENT, ($, e, next) => submitWithHeldTexts(e, next, [roastsSource($)]))
  on('turn.start', EVERY_EVENT, markTurnRunning)
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    completeTurnWithHeldTexts($, e, next, heldTextSourcesOf($)),
  )
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
  registerRoast(on)
}

// The engine passes `$` only to a function named at the call, so each feature that sends texts with
// the next tool result is named here.
function heldTextSourcesOf($: EngineInterface): HeldTextSource[] {
  return [answersSource($), roastsSource($)]
}
