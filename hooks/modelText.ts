import type { Question } from '../types'
import { ASK_TOOL, LIST_TOOL } from './names'
import { Withdrawal, isAnswered, isWithdrawn, openQuestionsOf, sortedByNumber } from './questions'
import type { AnsweredQuestion } from './questions'

export const ASK_DESCRIPTION = [
  'Puts a question to the user without waiting for the answer, so you keep working.',
  'The question is stored until the user answers it, in any order and at any time, also after',
  'this session has ended. The call returns at once with the number of the question, and the',
  'answer is sent to you later as a note with one of your tool results, or as a new message of',
  'the user. Use it for every question whose answer the rest of the work does not wait on.',
  'Ask the question first as the skill workflow-skills:question describes, and call this tool',
  'only when the subagent finds no answer in the project.',
  `Call ${LIST_TOOL} first, and never ask a question again that is open or answered there.`,
  'Write the question so the user can answer it days later without this conversation: name the',
  'work it concerns and what each answer would change.',
].join(' ')

export const LIST_DESCRIPTION = [
  `Lists the questions put to the user in this project with ${ASK_TOOL}, by this session and`,
  'by every other one: the open ones, the answered ones with their answers, and the withdrawn',
  'ones. Check it before you ask, so that each question is asked once.',
].join(' ')

export const WITHDRAW_DESCRIPTION = [
  `Takes back an open question that you asked with ${ASK_TOOL}, once the work no longer needs`,
  'its answer, such as after a later decision made it moot. Give the number of the question.',
  `The user no longer sees it among the open questions, and ${LIST_TOOL} lists it as withdrawn.`,
  'Only the session that asked a question can withdraw it.',
].join(' ')

/**
 * What the model or the person at the prompt is told of a hook of the questions that failed with
 * `reason`, such as a scope that cannot be fixed or a write the store refuses.
 */
export function describeFailedUse(reason: string | undefined): string {
  return [
    `The questions could not be used: ${reason ?? 'the hook failed without a reason'}`,
    'The debug log has this too. Until the cause is fixed, go on without the questions.',
  ].join('\n')
}

/**
 * What the model or the person at the prompt is told of a hook of the questions that ran past its
 * time, possibly after it saved a change, with the last failure before that, if any.
 */
export function describeUnfinishedUse(lastFailure: string | undefined): string {
  return [
    'The questions did not finish in time, so whether the change was saved is unknown.',
    ...(lastFailure === undefined ? [] : [`The last failure before that: ${lastFailure}`]),
    'List the questions before you try again. The debug log has this too.',
  ].join('\n')
}

export function describeAsked(question: Question): string {
  return (
    `Your question is #${question.number}. Keep working on what does not depend on the answer. ` +
    'The answer is sent to you later as a note with one of your tool results, or as a message ' +
    'of the user.'
  )
}

/** What the model is told of the question numbered `number` it asked to withdraw. */
export const WITHDRAWAL_TEXTS: Record<Withdrawal, (number: number) => string> = {
  [Withdrawal.Withdrawn]: number =>
    `Question #${number} is withdrawn. The user no longer sees it among the open questions.`,
  [Withdrawal.NotOpen]: number =>
    `Question #${number} is not open: it is answered, withdrawn or was never asked. Call ` +
    `${LIST_TOOL} to see where it stands.`,
  [Withdrawal.AskedElsewhere]: number =>
    `Question #${number} was asked by another session, and only that session can withdraw it.`,
}

/** The answers as the model reads them, each beside its question. */
export function describeAnswers(answered: readonly AnsweredQuestion[]): string {
  return answered
    .map(
      question =>
        `The user answered your question #${question.number}.\n` +
        `Question: ${question.text}\n` +
        `Answer: ${question.answer.text}`,
    )
    .join('\n\n')
}

/** The open and the answered questions as the model reads them from the list tool. */
export function describeQuestions(questions: readonly Question[]): string {
  if (questions.length === 0) {
    return 'You have not asked any question in this project.'
  }
  const sorted = sortedByNumber(questions)
  const answered = sorted
    .filter(isAnswered)
    .map(question => `#${question.number}: ${question.text}\nAnswer: ${question.answer.text}`)
  const withdrawn = sorted
    .filter(isWithdrawn)
    .map(question => `#${question.number}: ${question.text}`)

  return [
    ...describeSection('Open questions:', openQuestionsOf(sorted).map(describeOpenQuestion)),
    ...describeSection('Answered questions:', answered),
    ...describeSection('Withdrawn questions:', withdrawn),
  ].join('\n\n')
}

function describeSection(heading: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [[heading, ...lines].join('\n')]
}

export function describeOpenQuestion(question: Question): string {
  const choices = question.choices.length > 0 ? ` (choices: ${question.choices.join(' / ')})` : ''

  return `#${question.number}: ${question.text}${choices}`
}

/**
 * The line written into the chat history when a question is asked. The number and the choices come
 * before the text, so a terminal that cuts a long line keeps them.
 */
export function describeQuestionInChat(question: Question): string {
  return question.choices.length > 0
    ? `Question #${question.number} (choices: ${question.choices.join(' / ')}): ${question.text}`
    : `Question #${question.number}: ${question.text}`
}
