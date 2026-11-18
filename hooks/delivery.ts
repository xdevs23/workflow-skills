import type { EngineInterface } from 'claude-code'

import type { Question } from '../types'
import { HeldTextPlace, submitWhileSessionAcceptsPrompts } from './heldTexts'
import type { HeldTextSource } from './heldTexts'
import { describeAnswers, describeAnswersNote } from './modelText'
import { undeliveredAnswersOf } from './questions'
import type { AnsweredQuestion } from './questions'
import { awaitingSessionOf } from './questionSession'
import {
  handleStoreFailure,
  saveAnswer,
  saveDelivery,
  toastStoreFailure,
} from './questionStore'
import { PromptOutcome, submitToSession } from './sendToModel'
import type { Delivery, TextWithLine } from './sendToModel'
import {
  claimAnswers,
  loadQuestionsFromStore,
  releaseAnswers,
  setQuestionsInState,
  updateQuestions,
} from './sessionState'

/**
 * Hands the answers not yet read by the session `sessionId` to `send`, together with the questions
 * of that session, and stores them as delivered once `send` reports them accepted. `send` runs also
 * when the list of answers is empty. Answers another delivery of the session is sending
 * are left to that delivery, so parallel tool calls give each answer to the model once.
 */
export async function deliverAnswers<T>(
  $: EngineInterface,
  sessionId: string,
  send: (
    answered: readonly AnsweredQuestion[],
    questions: readonly Question[],
  ) => Promise<Delivery<T>>,
): Promise<T> {
  const questions = await loadQuestionsFromStore($, sessionId)
  const answered = await claimAnswers($, undeliveredAnswersOf(questions))
  try {
    const delivery = await send(answered, questions)
    if (delivery.isAccepted && answered.length > 0) {
      await storeDelivery($, sessionId, answered)
    }

    return delivery.result
  } finally {
    if (answered.length > 0) {
      await releaseAnswers($, answered)
    }
  }
}

/**
 * Stores the answers as delivered. A refused write leaves them undelivered, so the model reads
 * them again with a later delivery, and the user is told.
 */
async function storeDelivery(
  $: EngineInterface,
  sessionId: string,
  answered: readonly AnsweredQuestion[],
): Promise<void> {
  await toastStoreFailure($, async () => {
    const delivered = await saveDelivery($, sessionId, answered)
    await updateQuestions($, questions =>
      questions.map(question => delivered.find(each => each.id === question.id) ?? question),
    )
  })
}

/**
 * Stores the answer of the user to the open question of the session `sessionId` that `which`
 * selects, and returns whether such a question was open. An answer given while a turn does not run
 * is sent to the model as a prompt.
 */
export async function recordAnswerAndDeliver(
  $: EngineInterface,
  sessionId: string,
  which: (question: Question) => boolean,
  text: string,
): Promise<boolean> {
  const answer = { text, answeredAt: await $.clock.now() }
  const { answered, questions } = await saveAnswer($, sessionId, which, answer)
  await setQuestionsInState($, sessionId, questions)
  if (answered !== undefined) {
    submitWhileSessionAcceptsPrompts($, answersSource($))
  }

  return answered !== undefined
}

/** The answers to the questions of the session, as a source of texts sent to the model. */
export function answersSource($: EngineInterface): HeldTextSource {
  return {
    takeNote: () => takeAnswersNote($),
    submit: () => submitAnswers($),
    describeNotSent: describeAnswersNotSent,
  }
}

/** The toast for answers left unsent for `reason`. */
function describeAnswersNotSent(reason: string): string {
  return (
    `This plugin could not send your answers to Claude: ${reason}. ` +
    'It sends them with your next prompt or the next tool result.'
  )
}

async function takeAnswersNote($: EngineInterface): Promise<TextWithLine | undefined> {
  const sessionId = await awaitingSessionOf($)
  if (sessionId === null) {
    return undefined
  }

  return handleStoreFailure(
    $,
    () =>
      deliverAnswers($, sessionId, async answered => ({
        result:
          answered.length === 0
            ? undefined
            : describeAnswersNote(HeldTextPlace.ToolResult, answered),
        isAccepted: true,
      })),
    message => {
      $.ui.toast(message)

      return undefined
    },
  )
}

/**
 * Sends the undelivered answers of the session awaiting answers to the model as a prompt in the
 * name of the user, and stores them as delivered once the prompt is accepted. The delivery skips
 * answers already delivered, so a delivery started while another one runs sends each answer once.
 */
async function submitAnswers($: EngineInterface): Promise<void> {
  const sessionId = await awaitingSessionOf($)
  if (sessionId === null) {
    return
  }
  await deliverAnswers($, sessionId, async answered => {
    if (answered.length === 0) {
      return { result: undefined, isAccepted: false }
    }
    const text = describeAnswers(answered)
    const submitted = await submitToSession($, sessionId, { text, asUser: true })
    if (submitted.outcome === PromptOutcome.Dropped) {
      $.ui.toast(describeAnswersNotSent(submitted.reason))
    }

    return { result: undefined, isAccepted: submitted.outcome === PromptOutcome.Entered }
  })
}
