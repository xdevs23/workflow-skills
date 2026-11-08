import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  Hook,
  MatchedHook,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { isMainConversation } from './conversation'
import { draftRemindersFor } from './draftQuestion'
import { deliverAnswers, deliverWhenIdle, recordAnswerAndDeliver } from './delivery'
import { denyFailedHook, replyToFailedHook } from './hookFailure'
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
  ASK_DESCRIPTION,
  LIST_DESCRIPTION,
  QUESTIONS_SUBJECT,
  WITHDRAWAL_TEXTS,
  WITHDRAW_DESCRIPTION,
  describeAnswers,
  describeAsked,
  describeOpenQuestion,
  describeQuestionInChat,
  describeQuestionSkillDenial,
  describeQuestions,
  describeUnrecordedLoad,
} from './modelText'
import {
  ANSWER_COMMAND,
  ASK,
  ASK_TOOL,
  LIST,
  LIST_TOOL,
  PANE,
  SKILL_TOOL,
  WITHDRAW,
  WITHDRAW_TOOL,
} from './names'
import { sortedByNumber } from './numbered'
import { isTypedByUser } from './promptOrigin'
import { Withdrawal, openQuestionsOf } from './questions'
import { awaitingSessionOf, sessionForUse } from './questionSession'
import {
  QuestionSkillLoadState,
  checkQuestionSkillLoad,
  recordQuestionSkillLoad,
} from './questionSkill'
import {
  handleStoreFailure,
  moveProjectRecordsToSessions,
  saveNewQuestion,
  saveWithdrawal,
  toastStoreFailure,
} from './questionStore'
import { callToolWithNote, submitWithNote } from './sendToModel'
import {
  hasPersonAtPrompt,
  loadQuestionsFromStore,
  loadQuestionsUnlessInState,
  recordPersonAtPrompt,
  recordReadAtStart,
  setQuestionsInState,
  setTurnRunning,
  takeReadAtStart,
} from './sessionState'

// Registered for a session with a person at the prompt alone. In a -p run or the Agent SDK, the
// plugin registers neither the tools nor the command and does not read any question, so every hook
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
    $.command.register({
      name: ANSWER_COMMAND,
      description: 'Answer a question Claude asked, or list the open ones',
      argumentHint: ANSWER_ARGUMENTS,
      immediate: true,
    }),
  ])
  // The questions saved under the project before they belonged to a session are moved to their
  // session first, so the load finds them.
  await toastStoreFailure($, () => moveProjectRecordsToSessions($))
  const sessionId = await $.session.id()
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

export const addAnswersToToolResult: Hook<'tool.call'> = ($, e, next) =>
  callToolWithNote(e, next, async () => {
    const sessionId = await awaitingSessionOf($)
    if (sessionId === null) {
      return undefined
    }

    return handleStoreFailure(
      $,
      () =>
        deliverAnswers($, sessionId, async answered => ({
          result: answered.length === 0 ? undefined : describeAnswers(answered),
          isAccepted: true,
        })),
      message => {
        $.ui.toast(message)

        return undefined
      },
    )
  })

export const recordSkillLoad: MatchedHook<'tool.call', { tool: typeof SKILL_TOOL }> = async (
  $,
  e,
  next,
) => {
  const ran = await next(e)
  await handleStoreFailure(
    $,
    () => recordQuestionSkillLoad($, e, ran),
    message => $.ui.toast(describeUnrecordedLoad(message)),
  )

  return ran
}

export const askQuestion: MatchedHook<'tool.call', { tool: typeof ASK_TOOL }> = async ($, e) => {
  const sessionId = await sessionForUse($)
  if (isMainConversation(e)) {
    const check = await checkQuestionSkillLoad($, sessionId)
    if (check.state !== QuestionSkillLoadState.Counted) {
      return { deny: describeQuestionSkillDenial(check) }
    }
  }
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
  if (e.command !== undefined || !isTypedByUser(e.origin) || !hasPersonAtPrompt()) {
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
          : submitWithNote(e, next, describeAnswers(answered)),
      )
    },
    message => {
      $.ui.toast(message)

      return next(e)
    },
  )
}

export const markTurnRunning: Hook<'turn.start'> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await setTurnRunning($, true)
  }

  return next(e)
}

// An answer given while the turn ran and not read with a tool result goes out as a prompt. A
// turn the user interrupted does not start a new one: the answers given during it go with the
// next prompt of the user. It is a function declaration for the same reason as
// `submitWithAnswers`.
export async function completeQuestionTurn(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
): Promise<TurnCompleteResult> {
  const completed = await next(e)
  if (isMainConversation(e)) {
    await setTurnRunning($, false)
    const sessionId = e.isAborted ? null : await awaitingSessionOf($)
    if (sessionId !== null) {
      deliverWhenIdle($, sessionId)
    }
  }

  return completed
}

export const runAnswerCommand: MatchedHook<
  'command.run',
  { command: typeof ANSWER_COMMAND }
> = async ($, e) => {
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

/** Returns the reply to the answer command when its hook failed, with the reason. */
export function replyWithHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, QUESTIONS_SUBJECT, next.error)
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
