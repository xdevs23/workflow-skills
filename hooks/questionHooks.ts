import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  Hook,
  HookFailure,
  MatchedHook,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import type { SessionScope } from '../types'
import { isMainConversation } from './conversation'
import { deliverAnswers, deliverWhenIdle, recordAnswerAndDeliver } from './delivery'
import {
  ANSWER_ARGUMENTS,
  ANSWER_USAGE_PROBLEM,
  ASK_PROBLEMS,
  ASK_SCHEMA,
  AnswerRequest,
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
  WITHDRAWAL_TEXTS,
  WITHDRAW_DESCRIPTION,
  describeAnswers,
  describeAsked,
  describeFailedUse,
  describeOpenQuestion,
  describeQuestionInChat,
  describeQuestionSkillDenial,
  describeQuestions,
  describeUnfinishedUse,
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
import { Withdrawal, isAwaitingAnswers, openQuestionsOf, sortedByNumber } from './questions'
import { awaitingScopeOf, handleStoreFailure, scopeForUse } from './questionScope'
import {
  QuestionSkillLoadState,
  checkQuestionSkillLoad,
  recordQuestionSkillLoad,
} from './questionSkill'
import { saveNewQuestion, saveWithdrawal } from './questionStore'
import {
  hasPersonAtPrompt,
  readQuestions,
  recordPersonAtPrompt,
  refreshQuestions,
  setTurnRunning,
  updateQuestions,
} from './sessionState'

// In a session without a person at the prompt, such as a -p run or the Agent SDK, the plugin
// registers neither the tools nor the command and fixes no scope, so every hook below passes its
// event on unchanged.
export const startQuestions: Hook<'session.start'> = async ($, e, next) => {
  recordPersonAtPrompt(e.isInteractive)
  if (!e.isInteractive) {
    return next(e)
  }
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
  await handleStoreFailure(
    $,
    async () => {
      await scopeForUse($)
    },
    message => $.ui.toast(message),
  )

  return next(e)
}

export const addAnswersToToolResult: Hook<'tool.call'> = async ($, e, next) => {
  const ran = await next(e)
  if (ran.deny !== undefined) {
    return ran
  }
  const isModelCall = isMainConversation(e) && next.origin.tier === 'core'
  const scope = isModelCall ? await awaitingScopeOf($) : null
  if (scope === null) {
    return ran
  }

  return handleStoreFailure(
    $,
    () =>
      deliverAnswers($, scope, async answered => ({
        result:
          answered.length === 0
            ? ran
            : { ...ran, context: [...(ran.context ?? []), describeAnswers(answered)] },
        isAccepted: true,
      })),
    message => {
      $.ui.toast(message)

      return ran
    },
  )
}

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
  const scope = await scopeForUse($)
  if (isMainConversation(e)) {
    const check = await checkQuestionSkillLoad($, scope.sessionId)
    if (check.state !== QuestionSkillLoadState.Counted) {
      return { deny: describeQuestionSkillDenial(check) }
    }
  }
  const input = readAskInput(e)
  if (input.outcome !== AskOutcome.Valid) {
    return { deny: ASK_PROBLEMS[input.outcome] }
  }
  const asked = { text: input.question, choices: input.choices, askedAt: await $.clock.now() }
  const { question, questions } = await saveNewQuestion($, scope, asked)
  await updateQuestions($, () => questions)
  // The host shows the tool call in the chat only once the turn is idle.
  $.ui.log(describeQuestionInChat(question))

  return { result: describeAsked(question) }
}

// A subagent reads the list too, but only the main conversation takes the answers as read.
export const listQuestions: MatchedHook<'tool.call', { tool: typeof LIST_TOOL }> = async (
  $,
  e,
) => {
  const scope = await scopeForUse($)

  return deliverAnswers<ToolCallResult>($, scope, async (_, questions) => ({
    result: { result: describeQuestions(questions) },
    isAccepted: isMainConversation(e),
  }))
}

export const withdrawQuestion: MatchedHook<'tool.call', { tool: typeof WITHDRAW_TOOL }> = async (
  $,
  e,
) => {
  const scope = await scopeForUse($)
  const number = readWithdrawInput(e)
  if (number === undefined) {
    return { deny: WITHDRAW_PROBLEM }
  }
  const { withdrawal, questions } = await saveWithdrawal($, scope, number)
  await updateQuestions($, () => questions)
  const text = WITHDRAWAL_TEXTS[withdrawal](number)

  return withdrawal === Withdrawal.Withdrawn ? { result: text } : { deny: text }
}

// A prompt the user sends receives the answers that wait, such as the ones given during a turn
// the user interrupted, or before /resume switched back to the session. They count as read once
// the prompt entered with them. It is a function declaration, since the hooks module passes `$`
// into it, and the engine follows `$` past an import into function declarations only.
export async function submitWithAnswers(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
): Promise<PromptSubmitResult> {
  const isTypedByUser =
    e.command === undefined && (e.origin.kind === 'composer' || e.origin.kind === 'bridge')
  if (!isTypedByUser || !hasPersonAtPrompt()) {
    return next(e)
  }

  // A failure of the store comes only from reading the questions, before `next` runs.
  return handleStoreFailure(
    $,
    async () => {
      const scope = await scopeForUse($)
      if (!isAwaitingAnswers(await readQuestions($), scope.sessionId)) {
        return next(e)
      }

      return deliverAnswers($, scope, async answered => {
        if (answered.length === 0) {
          return { result: await next(e), isAccepted: false }
        }
        const note = describeAnswers(answered)
        const entered = await next({ ...e, context: [...(e.context ?? []), note] })

        return { result: entered, isAccepted: entered.context?.includes(note) === true }
      })
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
    const scope = e.isAborted ? null : await awaitingScopeOf($)
    if (scope !== null) {
      deliverWhenIdle($, scope)
    }
  }

  return completed
}

export const runAnswerCommand: MatchedHook<
  'command.run',
  { command: typeof ANSWER_COMMAND }
> = async ($, e) => {
  const scope = await scopeForUse($)
  const request = readAnswerArguments(e.args)
  switch (request.request) {
    case AnswerRequest.List:
      return { text: await listOpenQuestions($, scope) }
    case AnswerRequest.Unreadable:
      return { text: ANSWER_USAGE_PROBLEM }
    case AnswerRequest.Answer: {
      const { number, text } = request
      const isOpen = await recordAnswerAndDeliver($, scope, number, text)

      return {
        text: isOpen ? `Answered question #${number}.` : `Question #${number} is not open.`,
      }
    }
  }
}

/**
 * Denies the call of a question tool whose hook failed, such as on a scope that cannot be fixed or
 * a write rejected by the store, with the reason, which is written to the debug log too.
 */
export function denyHookFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return { deny: logAndDescribeHookFailure($, next.error) }
}

/**
 * Returns the reply to the answer command when its hook failed, with the reason. The reason also
 * goes to the debug log.
 */
export function replyWithHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return { text: logAndDescribeHookFailure($, next.error) }
}

/** What a failed hook of the questions tells the model or the person at the prompt, by its kind. */
const HOOK_FAILURE_TEXTS: Record<HookFailure['kind'], (message: string | undefined) => string> = {
  throw: describeFailedUse,
  timeout: describeUnfinishedUse,
}

/** Writes why a hook of the questions failed to the debug log, and returns the text of the reply. */
function logAndDescribeHookFailure($: EngineInterface, failure: HookFailure): string {
  const text = HOOK_FAILURE_TEXTS[failure.kind](failure.message)
  $.ui.log(text, { to: 'debug' })

  return text
}

/** Lists the open questions for the answer command, and opens the pane with them. */
async function listOpenQuestions($: EngineInterface, scope: SessionScope): Promise<string> {
  await refreshQuestions($, scope)
  const open = sortedByNumber(openQuestionsOf(await readQuestions($)))
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
