import type { EngineInterface, Register } from 'claude-code'

import { compactWithNotes } from './afterCompaction'
import {
  registerPluginCommands,
  replyToFailedPluginCommand,
  runPluginCommandOrNext,
} from './commandDispatch'
import { answersSource } from './delivery'
import { EVERY_EVENT } from './everyEvent'
import { registerGoals } from './goals'
import { sendDueIdleReminder } from './goals/goalIdleReminder'
import { sendNudgesWhileSessionAcceptsPrompts } from './goals/goalNudge'
import { openGoalsAfterCompaction } from './goals/goalReminderHooks'
import {
  callToolWithPendingTexts,
  submitPendingTexts,
  submitWithPendingTexts,
} from './pendingTexts'
import type { PendingTextSource } from './pendingTexts'
import {
  STOP_BLOCK_REASON,
  forgetHintKindsSentInTurn,
  markOfferedHintKindsSent,
} from './hintState'
import { blockStopOnHintPhrase } from './hints'
import { registerImports } from './imports'
import { ASK_TOOL, LIST_TOOL, PANE, WITHDRAW_TOOL } from './names'
import { registerNeededSkills } from './neededSkills'
import { createPromptFooter, registerPromptFooter } from './promptFooter'
import { PANE_CLOSED_BY_USER } from './paneClose'
import { closePaneSendingWaitingPrompts } from './promptWaits'
import {
  askQuestion,
  denyHookFailure,
  listQuestions,
  readQuestionsOfStartedSession,
  startQuestions,
  submitWithAnswers,
  withdrawQuestion,
} from './questionHooks'
import { drawQuestionBand, drawQuestionPane } from './questionScreens'
import { registerReminders } from './reminders'
import { remindersAfterCompaction } from './reminders/eventCadence'
import { watchTimedReminders } from './reminders/timedDelivery'
import { registerRoast } from './roast'
import { roastsSource } from './roast/roastDelivery'
import { registerRulesBanner } from './rulesBanner'
import { registerSelfCheck } from './selfCheck'
import { waitForSelfCheckDueTime } from './selfCheck/idleSelfCheck'
import { registerSessionRecords } from './sessions'
import {
  completeMainTurn,
  endStopOnTypedCommand,
  markTurnRunning,
  markTypedPromptTurnRunning,
} from './turnState'

export const register: Register = on => {
  // Registered before every other hook of this plugin on a prompt, so it reads the prompt as typed.
  registerSessionRecords(on)
  on('session.start', EVERY_EVENT, registerPluginCommands)
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
  // Registered before the tools of this plugin, so their results also contain the pending texts.
  on('tool.call', EVERY_EVENT, ($, e, next) =>
    callToolWithPendingTexts($, e, next, pendingTextSourcesOf($)),
  )
  // Registered before the tools of this plugin, so it denies a call before the tool runs.
  registerNeededSkills(on)
  on('tool.call', { tool: ASK_TOOL }, askQuestion).catch(denyHookFailure)
  on('tool.call', { tool: LIST_TOOL }, listQuestions).catch(denyHookFailure)
  on('tool.call', { tool: WITHDRAW_TOOL }, withdrawQuestion).catch(denyHookFailure)
  on('prompt.submit', EVERY_EVENT, submitWithAnswers)
  // Answers go beside a prompt through submitWithAnswers, which marks them as read only once the
  // prompt entered with them.
  on('prompt.submit', EVERY_EVENT, ($, e, next) =>
    submitWithPendingTexts($, e, next, [roastsSource($)]),
  )
  on('prompt.submit', EVERY_EVENT, markTypedPromptTurnRunning)
  on('turn.start', EVERY_EVENT, markTurnRunning)
  // The one hook of this plugin on a slash command, which runs every command of this plugin. It
  // ends the stop first, so each of them reads the stop as ended.
  on('command.run', EVERY_EVENT, ($, e, next) =>
    endStopOnTypedCommand(
      $,
      e,
      () => sendTextsWaitingForSession($),
      () => runPluginCommandOrNext($, e, next),
    ),
  ).catch(replyToFailedPluginCommand)
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    completeMainTurn($, e, next, () => sendTextsWaitingForSession($)),
  )
  on('ui.close', PANE_CLOSED_BY_USER, ($, e, next) =>
    closePaneSendingWaitingPrompts(e, next, () => sendTextsWaitingForSession($)),
  )
  on('classic.Stop', blockStopOnHintPhrase)
  on('session.append', STOP_BLOCK_REASON, markOfferedHintKindsSent)
  on('turn.complete', EVERY_EVENT, forgetHintKindsSentInTurn)
  on('ui.render', { component: 'AbovePrompt' }, drawQuestionBand)
  on('ui.render', { component: 'Pane', requestId: PANE }, drawQuestionPane)
  // The footer draws the buttons in the order placed: Goals first, then Reminders.
  const footer = createPromptFooter()
  registerPromptFooter(on, footer)
  registerGoals(on, footer)
  registerReminders(on, footer)
  registerImports(on)
  registerSelfCheck(on)
  registerRulesBanner(on)
  registerRoast(on)
}

// The engine passes `$` only to a function named at the call, so each feature that sends texts with
// the next tool result is named here.
function pendingTextSourcesOf($: EngineInterface): PendingTextSource[] {
  return [answersSource($), roastsSource($)]
}

// The engine passes `$` only to a function named at the call, so each feature whose texts wait for
// the session to accept prompts submitted by the plugin is named here. The end of every turn of the
// main conversation, a slash command typed after a turn stopped by the user, and a pane closed by
// the user that made the prompts submitted by the plugin wait call it.
function sendTextsWaitingForSession($: EngineInterface): void {
  submitPendingTexts($, pendingTextSourcesOf($))
  sendNudgesWhileSessionAcceptsPrompts($)
  sendDueIdleReminder($)
  watchTimedReminders($)
  waitForSelfCheckDueTime($)
}
