import type { EngineInterface } from 'claude-code'

import type { Question } from '../types'
import { messageOf } from './errorMessage'
import { describeAnswers } from './modelText'
import { undeliveredAnswersOf } from './questions'
import type { AnsweredQuestion } from './questions'
import { QuestionStoreError, saveAnswer, saveDelivery } from './questionStore'
import {
  claimAnswers,
  loadQuestionsFromStore,
  readIsTurnRunning,
  releaseAnswers,
  setQuestionsInState,
  updateQuestions,
} from './sessionState'

/** The result of a delivery, and whether the model received the answers handed to it. */
export type Delivery<T> = { result: T; isAccepted: boolean }

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
  try {
    const delivered = await saveDelivery($, sessionId, answered)
    await updateQuestions($, questions =>
      questions.map(question => delivered.find(each => each.id === question.id) ?? question),
    )
  } catch (error) {
    if (!(error instanceof QuestionStoreError)) {
      throw error
    }
    reportStoreFailure($, error)
  }
}

export function reportStoreFailure($: EngineInterface, error: QuestionStoreError): void {
  $.ui.log(error.message, { to: 'debug' })
  $.ui.toast(error.message)
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
  if (answered !== undefined && !(await readIsTurnRunning($))) {
    deliverWhenIdle($, sessionId)
  }

  return answered !== undefined
}

/**
 * Sends the undelivered answers of the session to the model as a prompt in the name of the user,
 * and stores them as delivered once the prompt is accepted. The delivery runs in a timer of its
 * own: a prompt starts its turn once the session is idle, and the call resolves only then, so the
 * hook that asks for the delivery does not wait for it.
 */
export function deliverWhenIdle($: EngineInterface, sessionId: string): void {
  $.clock.after(0, () => {
    deliverAsPrompt($, sessionId).catch((error: unknown) => {
      const text =
        `The answers to your questions could not be sent to Claude: ${messageOf(error)}. ` +
        'They are sent with your next prompt or the next tool result.'
      $.ui.log(text, { to: 'debug' })
      $.ui.toast(text)
    })
  })
}

async function deliverAsPrompt($: EngineInterface, sessionId: string): Promise<void> {
  await deliverAnswers($, sessionId, async answered => {
    // After /resume or /clear switched to another session, the prompt would go to that session,
    // so the answers wait for the next delivery in their own session.
    if (answered.length === 0 || (await $.session.id()) !== sessionId) {
      return { result: undefined, isAccepted: false }
    }
    const entered = await $.prompt.submit({ text: describeAnswers(answered), asUser: true })
    if (entered.drop !== undefined) {
      $.ui.toast(
        `The answers to your questions were not sent to Claude: ${entered.drop}. ` +
          'They are sent with your next prompt or the next tool result.',
      )
    }

    return { result: undefined, isAccepted: entered.drop === undefined }
  })
}
