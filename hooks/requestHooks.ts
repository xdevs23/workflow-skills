import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  CommandSpec,
  EngineInterface,
  Frozen,
  Hook,
  MatchedHook,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { registerCommandShowingRejection } from './commandRegistration'
import { isMainConversation } from './conversation'
import { deliverReplies, recordReplyAndDeliver } from './delivery'
import { PendingTextPlace } from './pendingTexts'
import { CommandRegistrar, type PluginCommand } from './pluginCommand'
import { denyFailedHook } from './hookFailure'
import {
  REPLY_ARGUMENTS,
  REPLY_USAGE_PROBLEM,
  ReplyCommand,
  SEND_SCHEMA,
  SendOutcome,
  WITHDRAW_PROBLEM,
  WITHDRAW_SCHEMA,
  readReplyArguments,
  readSendInput,
  readWithdrawInput,
  replyUsage,
  SEND_BLANK_PROBLEM,
} from './inputs'
import {
  ALL_CLOSED,
  LIST_DESCRIPTION,
  REPLY_DESCRIPTION,
  REQUESTS_SUBJECT,
  SEND_DESCRIPTION,
  WITHDRAWAL_TEXTS,
  WITHDRAW_DESCRIPTION,
  describeRepliesNote,
  describeRequestInChat,
  describeRequestLine,
  describeRequests,
  describeSent,
} from './modelText'
import {
  LIST,
  LIST_TOOL,
  REPLY_COMMAND,
  SEND,
  SEND_TOOL,
  WITHDRAW,
  WITHDRAW_TOOL,
} from './names'
import { sortedByNumber } from './numbered'
import { registerPluginTool } from './pluginTools'
import { moveProjectRecordsToSessions } from './projectRequestRecords'
import { isMessageTypedByUser } from './promptOrigin'
import { Withdrawal, openRequestsOf } from './requests'
import { openRequestsPane } from './requestScreens'
import { REPLY_LOST_WITHOUT_COMMAND } from './requestTexts'
import { awaitingSessionOf, sessionForUse } from './requestSession'
import {
  SESSION_REQUESTS_MAX_AGE_MS,
  deleteOldRecords,
  saveNewRequest,
  saveWithdrawal,
} from './requestStore'
import { handleStoreFailure, toastStoreFailure } from './requestStoreFailure'
import { submitWithNoteAndLine } from './sendToModel'
import {
  hasPersonAtPrompt,
  loadRequestsFromStore,
  loadRequestsUnlessInState,
  recordPersonAtPrompt,
  recordReadAtStart,
  setRequestsInState,
  takeReadAtStart,
} from './sessionState'

// Registered for a session with a person at the prompt alone. In a -p run or the Agent SDK, the
// plugin registers neither the tools nor /reply and does not read any request, so every hook
// below passes its event on unchanged.
export const startRequests: MatchedHook<'session.start', { isInteractive: true }> = async (
  $,
  e,
  next,
) => {
  recordPersonAtPrompt(e.isInteractive)
  await Promise.all([
    registerPluginTool($, {
      name: SEND,
      description: SEND_DESCRIPTION,
      inputSchema: SEND_SCHEMA,
      isDeferred: false,
    }),
    registerPluginTool($, { name: LIST, description: LIST_DESCRIPTION, isDeferred: false }),
    registerPluginTool($, {
      name: WITHDRAW,
      description: WITHDRAW_DESCRIPTION,
      inputSchema: WITHDRAW_SCHEMA,
      isDeferred: false,
    }),
    registerCommandShowingRejection($, REPLY_SPEC, REPLY_LOST_WITHOUT_COMMAND),
  ])
  // The requests saved under the project before they belonged to a session are moved to their
  // session first, so the load finds them.
  await toastStoreFailure($, () => moveProjectRecordsToSessions($))
  const sessionId = await $.session.id()
  const requestsMadeBefore = (await $.clock.now()) - SESSION_REQUESTS_MAX_AGE_MS
  await toastStoreFailure($, () => deleteOldRecords($, { sessionId, requestsMadeBefore }))
  await toastStoreFailure($, () => loadRequestsUnlessInState($, sessionId))
  recordReadAtStart(sessionId)

  return next(e)
}

// /resume and /clear do not raise a start, but run the classic SessionStart hook for the session
// they switched to, and a compaction runs it too. The session loads its requests here unless they
// are in the state already, so the band and the pane show them at once. The start of a process
// runs this hook as well, after the start hook read the requests.
export const readRequestsOfStartedSession: Hook<'classic.SessionStart'> = async ($, e, next) => {
  const sessionId = await $.session.id()
  if (hasPersonAtPrompt() && !takeReadAtStart(sessionId)) {
    await toastStoreFailure($, () => loadRequestsUnlessInState($, sessionId))
  }

  return next(e)
}

export const sendRequest: MatchedHook<'tool.call', { tool: typeof SEND_TOOL }> = async ($, e) => {
  const sessionId = await sessionForUse($)
  const input = readSendInput(e)
  if (input.outcome !== SendOutcome.Valid) {
    return { deny: SEND_BLANK_PROBLEM }
  }
  const sent = { text: input.text, sentAt: await $.clock.now() }
  const { request, requests } = await saveNewRequest($, sessionId, sent)
  await setRequestsInState($, sessionId, requests)
  // The host shows the tool call in the chat only once the turn is idle.
  $.ui.log(describeRequestInChat(request))

  return { result: describeSent(request) }
}

// A subagent reads the list too, but only the main conversation takes the replies as read.
export const listRequests: MatchedHook<'tool.call', { tool: typeof LIST_TOOL }> = async (
  $,
  e,
) => {
  const sessionId = await sessionForUse($)

  return deliverReplies<ToolCallResult>($, sessionId, async (_, requests) => ({
    result: { result: describeRequests(requests) },
    isAccepted: isMainConversation(e),
  }))
}

export const withdrawRequest: MatchedHook<'tool.call', { tool: typeof WITHDRAW_TOOL }> = async (
  $,
  e,
) => {
  const sessionId = await sessionForUse($)
  const number = readWithdrawInput(e)
  if (number === undefined) {
    return { deny: WITHDRAW_PROBLEM }
  }
  const { withdrawal, requests } = await saveWithdrawal($, sessionId, number)
  await setRequestsInState($, sessionId, requests)
  const text = WITHDRAWAL_TEXTS[withdrawal](number)

  return withdrawal === Withdrawal.Withdrawn ? { result: text } : { deny: text }
}

// A prompt the user sends includes the replies that wait, such as the ones given during a turn
// the user interrupted, also after /resume left the session and came back. They count as read
// once the prompt entered with them. It is a function declaration, since the hooks module passes
// `$` into it, and the engine follows `$` past an import into function declarations only.
export async function submitWithReplies(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
): Promise<PromptSubmitResult> {
  if (!isMessageTypedByUser(e) || !hasPersonAtPrompt()) {
    return next(e)
  }

  // A failure of the store comes only from reading the requests, before `next` runs.
  return handleStoreFailure(
    $,
    async () => {
      await loadRequestsUnlessInState($, await $.session.id())
      const sessionId = await awaitingSessionOf($)
      if (sessionId === null) {
        return next(e)
      }

      return deliverReplies($, sessionId, async done =>
        done.length === 0
          ? { result: await next(e), isAccepted: false }
          : submitWithNoteAndLine(
              $,
              e,
              next,
              describeRepliesNote(PendingTextPlace.BesidePrompt, done),
            ),
      )
    },
    message => {
      $.ui.toast(message)

      return next(e)
    },
  )
}

const REPLY_SPEC: CommandSpec = {
  name: REPLY_COMMAND,
  description: REPLY_DESCRIPTION,
  argumentHint: REPLY_ARGUMENTS,
  immediate: true,
}

/** /reply, which marks a request of the session done or lists the open ones. */
export function replyCommand($: EngineInterface): PluginCommand {
  return {
    spec: REPLY_SPEC,
    registeredBy: CommandRegistrar.FeatureStart,
    run: e => runReplyCommand($, e),
    subjectOf: () => REQUESTS_SUBJECT,
  }
}

async function runReplyCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const sessionId = await sessionForUse($)
  const command = readReplyArguments(e.args)
  switch (command.kind) {
    case ReplyCommand.List:
      return { text: await listOpenRequests($, sessionId) }
    case ReplyCommand.Unreadable:
      return { text: REPLY_USAGE_PROBLEM }
    case ReplyCommand.Done: {
      const { number, reply } = command
      const isOpen = await recordReplyAndDeliver(
        $,
        sessionId,
        request => request.number === number,
        reply,
      )

      return {
        text: isOpen ? `Request #${number} is done.` : `Request #${number} is not open.`,
      }
    }
  }
}

/**
 * Denies the call of a request tool whose hook failed, such as on a store that cannot be read or
 * a write rejected by the store, with the reason.
 */
export function denyHookFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return denyFailedHook($, REQUESTS_SUBJECT, next.error)
}

/** Lists the open requests of the session for the reply command, and opens the pane. */
async function listOpenRequests($: EngineInterface, sessionId: string): Promise<string> {
  const open = sortedByNumber(openRequestsOf(await loadRequestsFromStore($, sessionId)))
  if (open.length === 0) {
    return ALL_CLOSED
  }
  const notOpened = await openRequestsPane($, { command: REPLY_COMMAND })

  return [
    ...(notOpened === undefined ? [] : [notOpened]),
    ...open.map(describeRequestLine),
    '',
    `Mark one done with ${replyUsage()}.`,
  ].join('\n')
}
