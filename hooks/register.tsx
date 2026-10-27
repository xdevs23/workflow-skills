import type {
  Caught,
  EngineInterface,
  Frozen,
  HookFailure,
  Register,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import type { Question, SessionScope } from '../types'
import {
  deliverAnswers,
  deliverWhenIdle,
  recordAnswerAndDeliver,
  reportStoreFailure,
} from './delivery'
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
import {
  QuestionSkillLoadState,
  checkQuestionSkillLoad,
  recordQuestionSkillLoad,
} from './questionSkill'
import { QuestionStoreError, messageOf, saveNewQuestion, saveWithdrawal } from './questionStore'
import {
  establishSessionScope,
  hasPersonAtPrompt,
  readQuestions,
  readSessionScope,
  recordPersonAtPrompt,
  refreshQuestions,
  setTurnRunning,
  updateQuestions,
} from './sessionState'

const ALL_CLOSED = 'Every question of this project is answered or withdrawn.'
const NO_PERSON_AT_PROMPT = 'they work only in a session with a person at the prompt'

export const register: Register = on => {
  // In a session without a person at the prompt, such as a -p run or the Agent SDK, the plugin
  // registers neither the tools nor the command and fixes no scope, so every hook below passes its
  // event on unchanged.
  on('session.start', async ($, e, next) => {
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
  })

  // Registered before the tools of this plugin, so their results also contain the answers.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) {
      return ran
    }
    const isModelCall = e.agentId === undefined && next.origin.tier === 'core'
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
  })

  on('tool.call', { tool: SKILL_TOOL }, async ($, e, next) => {
    const ran = await next(e)
    await handleStoreFailure(
      $,
      () => recordQuestionSkillLoad($, e, ran),
      message => $.ui.toast(describeUnrecordedLoad(message)),
    )

    return ran
  })

  on('tool.call', { tool: ASK_TOOL }, async ($, e) => {
    const scope = await scopeForUse($)
    if (e.agentId === undefined) {
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
  }).catch(denyHookFailure)

  // A subagent reads the list too, but only the main conversation takes the answers as read.
  on('tool.call', { tool: LIST_TOOL }, async ($, e) => {
    const scope = await scopeForUse($)

    return deliverAnswers<ToolCallResult>($, scope, async (_, questions) => ({
      result: { result: describeQuestions(questions) },
      isAccepted: e.agentId === undefined,
    }))
  }).catch(denyHookFailure)

  on('tool.call', { tool: WITHDRAW_TOOL }, async ($, e) => {
    const scope = await scopeForUse($)
    const number = readWithdrawInput(e)
    if (number === undefined) {
      return { deny: WITHDRAW_PROBLEM }
    }
    const { withdrawal, questions } = await saveWithdrawal($, scope, number)
    await updateQuestions($, () => questions)
    const text = WITHDRAWAL_TEXTS[withdrawal](number)

    return withdrawal === Withdrawal.Withdrawn ? { result: text } : { deny: text }
  }).catch(denyHookFailure)

  // A prompt the user sends carries the answers that wait, such as the ones given during a turn
  // the user interrupted, or before /resume switched back to the session. They count as read once
  // the prompt entered with them.
  on('prompt.submit', async ($, e, next) => {
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
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await setTurnRunning($, true)
    }

    return next(e)
  })

  // An answer given while the turn ran and not read with a tool result goes out as a prompt. A
  // turn the user interrupted does not start a new one: the answers given during it go with the
  // next prompt of the user.
  on('turn.complete', async ($, e, next) => {
    const completed = await next(e)
    if (e.agentId === undefined) {
      await setTurnRunning($, false)
      const scope = e.isAborted ? null : await awaitingScopeOf($)
      if (scope !== null) {
        deliverWhenIdle($, scope)
      }
    }

    return completed
  })

  on('command.run', { command: ANSWER_COMMAND }, async ($, e) => {
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
  }).catch(($, e, next) => ({ text: logAndDescribeHookFailure($, next.error) }))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const open = openQuestionsOf(await readQuestions($))
    if (e.props.hasSurvey || open.length === 0) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>{open.length === 1 ? '1 open question ' : `${open.length} open questions `}</Text>
        <Button
          key="answer"
          label="Answer"
          onPress={() => runOnScreen($, () => showPane($))}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const open = sortedByNumber(openQuestionsOf(await readQuestions($)))
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    if (open.length === 0) {
      return <Text dimColor>{ALL_CLOSED}</Text>
    }
    const answer = (question: Question, text: string) =>
      runOnScreen($, () => answerOnScreen($, question, text))
    // The mobile surface does not draw input fields or choice lists, so the pane shows the
    // command instead.
    const drawAnswerFields =
      'Input' in elements && 'Select' in elements
        ? (question: Question) => {
            const { Input, Select } = elements

            return (
              <Box flexDirection="column">
                {question.choices.length > 0 && (
                  <Select
                    key={`pick-${question.number}`}
                    options={question.choices.map(choice => ({ value: choice }))}
                    onSelect={choice => answer(question, choice)}
                  />
                )}
                <Input
                  key={`answer-${question.number}`}
                  placeholder={
                    question.choices.length > 0 ? 'Or type another answer' : 'Type your answer'
                  }
                  submitLabel="answer"
                  onSubmit={text => answer(question, text)}
                />
              </Box>
            )
          }
        : (question: Question) => (
            <Text dimColor>{`Answer with ${answerUsage(question.number)}`}</Text>
          )

    return (
      <Box flexDirection="column">
        {open.map(question => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>{`#${question.number} ${question.text}`}</Text>
            {drawAnswerFields(question)}
          </Box>
        ))}
      </Box>
    )
  })
}

/**
 * The scope of the session while it has a question of its own open or an answer it has not read,
 * by the questions it last read, and null otherwise. A tool call, a prompt and the end of a turn
 * read the store only while there is such a question.
 */
async function awaitingScopeOf($: EngineInterface): Promise<SessionScope | null> {
  const scope = await readSessionScope($)

  return scope !== null && isAwaitingAnswers(await readQuestions($), scope.sessionId)
    ? scope
    : null
}

/**
 * Runs `work`, and on a failure of the store returns what `answer` makes of its message, after
 * writing the message to the debug log. Every other error is passed on.
 */
async function handleStoreFailure<T>(
  $: EngineInterface,
  work: () => Promise<T>,
  answer: (message: string) => T | Promise<T>,
): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof QuestionStoreError)) {
      throw error
    }
    $.ui.log(error.message, { to: 'debug' })

    return answer(error.message)
  }
}

/**
 * Denies the call of a question tool whose hook failed, such as on a scope that cannot be fixed or
 * a write the store refuses, with the reason, which is written to the debug log too.
 */
function denyHookFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return { deny: logAndDescribeHookFailure($, next.error) }
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

/**
 * Returns the scope of the session for a use of the questions, fixed at the first use in the
 * session, and reads the questions of its project for the band and the pane when this use fixed
 * it. Every use of the questions gets its scope here, and only in a session with a person at the
 * prompt.
 */
async function scopeForUse($: EngineInterface): Promise<SessionScope> {
  if (!hasPersonAtPrompt()) {
    throw new Error(NO_PERSON_AT_PROMPT)
  }
  const { scope, isNew } = await establishSessionScope($)
  if (isNew) {
    await refreshQuestions($, scope)
  }

  return scope
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

async function showPane($: EngineInterface): Promise<void> {
  await refreshQuestions($, await scopeForUse($))
  const opened = await $.ui.open({ id: PANE, title: 'Questions', focus: true })
  if (!opened.isPlaced) {
    $.ui.toast(
      `The pane of the questions could not open: ${opened.reason}. ` +
        `Answer with ${answerUsage()}, or list them with /${ANSWER_COMMAND}.`,
    )
  }
}

async function answerOnScreen($: EngineInterface, question: Question, text: string): Promise<void> {
  if (text.trim() === '') {
    return
  }
  const scope = await scopeForUse($)
  const isOpen = await recordAnswerAndDeliver($, scope, question.number, text.trim())
  if (!isOpen) {
    $.ui.toast(`Question #${question.number} is no longer open.`)
  }
}

/** Runs the work of a press or an entry on the screen, and shows its failure as a toast. */
function runOnScreen($: EngineInterface, work: () => Promise<void>): void {
  work().catch((error: unknown) => {
    const text = messageOf(error)
    $.ui.log(text, { to: 'debug' })
    $.ui.toast(text)
  })
}
