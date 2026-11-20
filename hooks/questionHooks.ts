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
import { draftRemindersFor } from './draftQuestion'
import { deliverAnswers, recordAnswerAndDeliver } from './delivery'
import { PendingTextPlace } from './pendingTexts'
import { CommandRegistrar, type PluginCommand } from './pluginCommand'
import { denyFailedHook } from './hookFailure'
import {
  ANSWER_ARGUMENTS,
  ANSWER_USAGE_PROBLEM,
  ASK_SCHEMA,
  AnswerRequest,
  askProblemOf,
  AskOutcome,
  WITHDRAW_PROBLEM,
  WITHDRAW_SCHEMA,
  answerUsage,
  readAnswerArguments,
  readAskInput,
  readWithdrawInput,
} from './inputs'
import {
  ALL_CLOSED,
  ANSWER_DESCRIPTION,
  ASK_DESCRIPTION,
  LIST_DESCRIPTION,
  QUESTIONS_SUBJECT,
  WITHDRAWAL_TEXTS,
  WITHDRAW_DESCRIPTION,
  describeAnswersNote,
  describeAsked,
  describeOpenQuestion,
  describeQuestionInChat,
  describeQuestions,
} from './modelText'
import {
  ANSWER_COMMAND,
  ASK,
  ASK_TOOL,
  LIST,
  LIST_TOOL,
  PANE,
  WITHDRAW,
  WITHDRAW_TOOL,
} from './names'
import { sortedByNumber } from './numbered'
import { isMessageTypedByUser } from './promptOrigin'
import { Withdrawal, openQuestionsOf } from './questions'
import { ANSWER_LOST_WITHOUT_COMMAND } from './questionTexts'
import { awaitingSessionOf, sessionForUse } from './questionSession'
import {
  SESSION_QUESTIONS_MAX_AGE_MS,
  deleteOldRecords,
  handleStoreFailure,
  moveProjectRecordsToSessions,
  saveNewQuestion,
  saveWithdrawal,
  toastStoreFailure,
} from './questionStore'
import { submitWithNoteAndLine } from './sendToModel'
import {
  hasPersonAtPrompt,
  loadQuestionsFromStore,
  loadQuestionsUnlessInState,
  recordPersonAtPrompt,
  recordReadAtStart,
  setQuestionsInState,
  takeReadAtStart,
} from './sessionState'

// Registered for a session with a person at the prompt alone. In a -p run or the Agent SDK, the
// plugin registers neither the tools nor /answer and does not read any question, so every hook
// below passes its event on unchanged.
export const startQuestions: MatchedHook<'session.start', { isInteractive: true }> = async (
  $,
  e,
  next,
) => {
  recordPersonAtPrompt(e.isInteractive)
  await Promise.all([
    $.tool.register({
      name: ASK,
      description: ASK_DESCRIPTION,
      inputSchema: ASK_SCHEMA,
      isDeferred: false,
    }),
    $.tool.register({ name: LIST, description: LIST_DESCRIPTION, isDeferred: false }),
    $.tool.register({
      name: WITHDRAW,
      description: WITHDRAW_DESCRIPTION,
      inputSchema: WITHDRAW_SCHEMA,
      isDeferred: false,
    }),
    registerCommandShowingRejection($, ANSWER_SPEC, ANSWER_LOST_WITHOUT_COMMAND),
  ])
  // The questions saved under the project before they belonged to a session are moved to their
  // session first, so the load finds them.
  await toastStoreFailure($, () => moveProjectRecordsToSessions($))
  const sessionId = await $.session.id()
  const questionsMadeBefore = (await $.clock.now()) - SESSION_QUESTIONS_MAX_AGE_MS
  await toastStoreFailure($, () => deleteOldRecords($, { sessionId, questionsMadeBefore }))
  await toastStoreFailure($, () => loadQuestionsUnlessInState($, sessionId))
  recordReadAtStart(sessionId)

  return next(e)
}

// /resume and /clear do not raise a start, but run the classic SessionStart hook for the session
// they switched to, and a compaction runs it too. The session loads its questions here unless they
// are in the state already, so the band and the pane show them at once. The start of a process
// runs this hook as well, after the start hook read the questions.
export const readQuestionsOfStartedSession: Hook<'classic.SessionStart'> = async ($, e, next) => {
  const sessionId = await $.session.id()
  if (hasPersonAtPrompt() && !takeReadAtStart(sessionId)) {
    await toastStoreFailure($, () => loadQuestionsUnlessInState($, sessionId))
  }

  return next(e)
}

export const askQuestion: MatchedHook<'tool.call', { tool: typeof ASK_TOOL }> = async ($, e) => {
  const sessionId = await sessionForUse($)
  const input = readAskInput(e)
  if (input.outcome !== AskOutcome.Valid) {
    return { deny: askProblemOf(input) }
  }
  const asked = { text: input.question, choices: input.choices, askedAt: await $.clock.now() }
  const { question, questions } = await saveNewQuestion($, sessionId, asked)
  await setQuestionsInState($, sessionId, questions)
  // The host shows the tool call in the chat only once the turn is idle.
  $.ui.log(describeQuestionInChat(question))
  const reminders = draftRemindersFor(question)

  return {
    result: describeAsked(question),
    ...(reminders.length === 0 ? {} : { context: reminders }),
  }
}

// A subagent reads the list too, but only the main conversation takes the answers as read.
export const listQuestions: MatchedHook<'tool.call', { tool: typeof LIST_TOOL }> = async (
  $,
  e,
) => {
  const sessionId = await sessionForUse($)

  return deliverAnswers<ToolCallResult>($, sessionId, async (_, questions) => ({
    result: { result: describeQuestions(questions) },
    isAccepted: isMainConversation(e),
  }))
}

export const withdrawQuestion: MatchedHook<'tool.call', { tool: typeof WITHDRAW_TOOL }> = async (
  $,
  e,
) => {
  const sessionId = await sessionForUse($)
  const number = readWithdrawInput(e)
  if (number === undefined) {
    return { deny: WITHDRAW_PROBLEM }
  }
  const { withdrawal, questions } = await saveWithdrawal($, sessionId, number)
  await setQuestionsInState($, sessionId, questions)
  const text = WITHDRAWAL_TEXTS[withdrawal](number)

  return withdrawal === Withdrawal.Withdrawn ? { result: text } : { deny: text }
}

// A prompt the user sends includes the answers that wait, such as the ones given during a turn
// the user interrupted, also after /resume left the session and came back. They count as read
// once the prompt entered with them. It is a function declaration, since the hooks module passes
// `$` into it, and the engine follows `$` past an import into function declarations only.
export async function submitWithAnswers(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
): Promise<PromptSubmitResult> {
  if (!isMessageTypedByUser(e) || !hasPersonAtPrompt()) {
    return next(e)
  }

  // A failure of the store comes only from reading the questions, before `next` runs.
  return handleStoreFailure(
    $,
    async () => {
      await loadQuestionsUnlessInState($, await $.session.id())
      const sessionId = await awaitingSessionOf($)
      if (sessionId === null) {
        return next(e)
      }

      return deliverAnswers($, sessionId, async answered =>
        answered.length === 0
          ? { result: await next(e), isAccepted: false }
          : submitWithNoteAndLine(
              $,
              e,
              next,
              describeAnswersNote(PendingTextPlace.BesidePrompt, answered),
            ),
      )
    },
    message => {
      $.ui.toast(message)

      return next(e)
    },
  )
}

const ANSWER_SPEC: CommandSpec = {
  name: ANSWER_COMMAND,
  description: ANSWER_DESCRIPTION,
  argumentHint: ANSWER_ARGUMENTS,
  immediate: true,
}

/** /answer, which answers a question of the session or lists the open ones. */
export function answerCommand($: EngineInterface): PluginCommand {
  return {
    spec: ANSWER_SPEC,
    registeredBy: CommandRegistrar.FeatureStart,
    run: e => runAnswerCommand($, e),
    subjectOf: () => QUESTIONS_SUBJECT,
  }
}

async function runAnswerCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const sessionId = await sessionForUse($)
  const request = readAnswerArguments(e.args)
  switch (request.request) {
    case AnswerRequest.List:
      return { text: await listOpenQuestions($, sessionId) }
    case AnswerRequest.Unreadable:
      return { text: ANSWER_USAGE_PROBLEM }
    case AnswerRequest.Answer: {
      const { number, text } = request
      const isOpen = await recordAnswerAndDeliver(
        $,
        sessionId,
        question => question.number === number,
        text,
      )

      return {
        text: isOpen ? `Answered question #${number}.` : `Question #${number} is not open.`,
      }
    }
  }
}

/**
 * Denies the call of a question tool whose hook failed, such as on a store that cannot be read or
 * a write rejected by the store, with the reason.
 */
export function denyHookFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return denyFailedHook($, QUESTIONS_SUBJECT, next.error)
}

/** Lists the open questions of the session for the answer command, and opens the pane. */
async function listOpenQuestions($: EngineInterface, sessionId: string): Promise<string> {
  const open = sortedByNumber(openQuestionsOf(await loadQuestionsFromStore($, sessionId)))
  if (open.length === 0) {
    return ALL_CLOSED
  }
  const opened = await $.ui.open({ id: PANE, title: 'Questions', focus: true })

  return [
    ...(opened.isPlaced ? [] : [`The pane of the questions could not open: ${opened.reason}.`]),
    ...open.map(describeOpenQuestion),
    '',
    `Answer with ${answerUsage()}.`,
  ].join('\n')
}
