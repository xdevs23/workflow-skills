import type { EngineInterface, Register } from 'claude-code'

import { compactWithNotes } from './afterCompaction'
import { registerAgentMode } from './agentMode'
import { agentModeNotes } from './agentMode/agentModeNotes'
import { registerAutonomy } from './autonomy'
import { autonomyNotes } from './autonomy/autonomyNotes'
import {
  registerPluginCommands,
  replyToFailedPluginCommand,
  runPluginCommandOrNext,
} from './commandDispatch'
import { repliesSource } from './delivery'
import { EVERY_EVENT } from './everyEvent'
import { registerGoals } from './goals'
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
import { hintNotesSource } from './hintNoteDelivery'
import { blockStopOnHintPhrase } from './hints'
import { registerIdeas } from './ideas'
import { registerImports } from './imports'
import { LEAD_AGENT } from './leadAgent'
import { LIST_TOOL, REQUESTS_PANE, SEND_TOOL, WITHDRAW_TOOL } from './names'
import { registerNeededSkills } from './neededSkills'
import { createPromptFooter, registerPromptFooter } from './promptFooter'
import { PANE_CLOSED_BY_USER } from './paneClose'
import { createPluginTools, registerPluginTools } from './pluginTools'
import { closePaneSendingWaitingPrompts } from './promptWaits'
import {
  REQUEST_TOOL_SPECS,
  denyHookFailure,
  listRequests,
  readRequestsOfStartedSession,
  sendRequest,
  startRequests,
  submitWithReplies,
  withdrawRequest,
} from './requestHooks'
import { drawRequestBand, drawRequestPane } from './requestScreens'
import { registerReminders } from './reminders'
import { remindersAfterCompaction } from './reminders/eventCadence'
import { watchTimedReminders } from './reminders/timedDelivery'
import { registerRoast } from './roast'
import { roastsSource } from './roast/roastDelivery'
import { registerQuestionRule } from './questionRule'
import { registerRulesBanner } from './rulesBanner'
import { registerSelfCheck } from './selfCheck'
import { waitForSelfCheckDueTime } from './selfCheck/idleSelfCheck'
import { registerSessionRecords } from './sessions'
import { submitWithSettingNotes } from './settingNotes'
import type { SettingNotes } from './settingNotes'
import { registerStoreMigration } from './storeMigration'
import {
  completeMainTurn,
  endStopOnTypedCommand,
  markTurnRunning,
  markTypedPromptTurnRunning,
} from './turnState'

export const register: Register = on => {
  // The engine runs the hooks of an event in the order registered, so this registration comes first
  // and the plugin moves the records for the project into their folder before any hook reads them.
  registerStoreMigration(on)
  // Registered before every other hook of this plugin on a prompt, so it reads the prompt as typed.
  registerSessionRecords(on)
  const tools = createPluginTools()
  registerPluginTools(on, tools)
  const requestToolSpecs = tools.declare(REQUEST_TOOL_SPECS)
  on('session.start', EVERY_EVENT, registerPluginCommands)
  on('session.start', { isInteractive: true }, ($, e, next) =>
    startRequests($, e, next, requestToolSpecs),
  )
  on('classic.SessionStart', readRequestsOfStartedSession)
  // The engine passes `$` only to a function named at the call, so each note sent after a
  // compaction is named here. The open goals come before the reminders.
  on('session.compact', EVERY_EVENT, ($, e, next) =>
    compactWithNotes($, e, next, [
      openGoalsAfterCompaction($),
      remindersAfterCompaction($),
      ...settingNotesOf($).map(notes => notes.afterCompaction),
    ]),
  )
  // Registered before the tools of this plugin, so their results also contain the pending texts.
  on('tool.call', EVERY_EVENT, ($, e, next) =>
    callToolWithPendingTexts($, e, next, [
      ...pendingTextSourcesOf($),
      ...settingNotesOf($).map(notes => notes.noteSource),
    ]),
  )
  // Registered before the tools of this plugin, so it denies a call before the tool runs.
  registerNeededSkills(on)
  on('tool.call', { tool: SEND_TOOL }, sendRequest).catch(denyHookFailure)
  on('tool.call', { tool: LIST_TOOL }, listRequests).catch(denyHookFailure)
  on('tool.call', { tool: WITHDRAW_TOOL }, withdrawRequest).catch(denyHookFailure)
  on('prompt.submit', EVERY_EVENT, submitWithReplies)
  // Replies go beside a prompt through submitWithReplies, which marks them as read only once the
  // prompt entered with them.
  on('prompt.submit', EVERY_EVENT, ($, e, next) =>
    submitWithPendingTexts($, e, next, [roastsSource($), hintNotesSource($)]),
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
  // Registered before completeMainTurn, so the hint kinds of a turn are cleared before the session
  // counts as idle, and the kinds of a hint note submitted then count in the turn it starts.
  on('turn.complete', EVERY_EVENT, forgetHintKindsSentInTurn)
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    completeMainTurn($, e, next, () => sendTextsWaitingForSession($)),
  )
  on('ui.close', PANE_CLOSED_BY_USER, ($, e, next) =>
    closePaneSendingWaitingPrompts(e, next, () => sendTextsWaitingForSession($)),
  )
  on('classic.Stop', blockStopOnHintPhrase)
  on('session.append', STOP_BLOCK_REASON, markOfferedHintKindsSent)
  on('ui.render', { component: 'AbovePrompt' }, drawRequestBand)
  on('ui.render', { component: 'Pane', requestId: REQUESTS_PANE }, drawRequestPane)
  // The footer draws the buttons in the order placed: Goals, Reminders, then Ideas.
  const footer = createPromptFooter()
  registerPromptFooter(on, footer)
  registerGoals(on, footer, tools)
  registerReminders(on, footer)
  registerImports(on)
  registerSelfCheck(on)
  registerRulesBanner(on)
  registerQuestionRule(on)
  registerAutonomy(on)
  registerAgentMode(on)
  on('prompt.submit', EVERY_EVENT, ($, e, next) =>
    submitWithSettingNotes($, e, next, settingNotesOf($)),
  )
  registerRoast(on, [LEAD_AGENT])
  registerIdeas(on, footer, tools)
}

// The engine passes `$` only to a function named at the call, so each feature that sends texts with
// the next tool result is named here.
function pendingTextSourcesOf($: EngineInterface): PendingTextSource[] {
  return [repliesSource($), roastsSource($), hintNotesSource($)]
}

// The engine passes `$` only to a function named at the call, so each setting of the session sent
// to the main conversation in notes is named here.
function settingNotesOf($: EngineInterface): SettingNotes[] {
  return [autonomyNotes($), agentModeNotes($)]
}

// The engine passes `$` only to a function named at the call, so each feature whose texts wait for
// the session to accept prompts submitted by the plugin is named here. The end of every turn of the
// main conversation, a slash command typed after a turn stopped by the user, and a pane closed by
// the user that made the prompts submitted by the plugin wait call it.
function sendTextsWaitingForSession($: EngineInterface): void {
  submitPendingTexts($, pendingTextSourcesOf($))
  watchTimedReminders($)
  waitForSelfCheckDueTime($)
}
