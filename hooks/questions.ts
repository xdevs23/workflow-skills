import type { Answer, Question } from '../types'

export type AnsweredQuestion = Question & { answer: Answer }

export function isAnswered(question: Question): question is AnsweredQuestion {
  return question.answer !== undefined
}

export function isWithdrawn(question: Question): boolean {
  return question.withdrawnAt !== undefined
}

/** Whether the question waits for an answer of the user. */
export function isOpen(question: Question): boolean {
  return !isAnswered(question) && !isWithdrawn(question)
}

export function openQuestionsOf(questions: readonly Question[]): Question[] {
  return questions.filter(isOpen)
}

/** The answers to questions of the session that the session has not read yet. */
export function undeliveredAnswersOf(
  questions: readonly Question[],
  sessionId: string,
): AnsweredQuestion[] {
  return questions
    .filter(isAnswered)
    .filter(question => question.sessionId === sessionId && !question.answer.isDelivered)
}

/** Whether a question of the session is open or has an answer the session has not read yet. */
export function isAwaitingAnswers(questions: readonly Question[], sessionId: string): boolean {
  return (
    openQuestionsOf(questions).some(question => question.sessionId === sessionId) ||
    undeliveredAnswersOf(questions, sessionId).length > 0
  )
}

/** Whether the value is a whole number from 1 up, as the number of a question is. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/** The number a new question of the project gets: one past the highest number in use. */
export function nextNumberOf(questions: readonly Question[]): number {
  return questions.reduce((highest, question) => Math.max(highest, question.number), 0) + 1
}

/**
 * Whether a question stored before `question` has its number. `questions` lists the questions in
 * the order their store keys were first set. Of two questions with one number, the one stored
 * first keeps it, also when it was stored and its number returned before the other one was stored.
 */
export function isNumberTaken(question: Question, questions: readonly Question[]): boolean {
  const position = questions.findIndex(other => other.id === question.id)
  const storedBefore = position === -1 ? questions : questions.slice(0, position)

  return storedBefore.some(other => other.id !== question.id && other.number === question.number)
}

export function findOpenQuestion(
  questions: readonly Question[],
  number: number,
): Question | undefined {
  return openQuestionsOf(questions).find(question => question.number === number)
}

/** The questions in the order of their numbers, the order the user and the model read them in. */
export function sortedByNumber(questions: readonly Question[]): Question[] {
  return [...questions].sort((first, second) => first.number - second.number)
}

/** What became of a question the model asked to withdraw. */
export enum Withdrawal {
  Withdrawn = 'withdrawn',
  NotOpen = 'not-open',
  AskedElsewhere = 'asked-elsewhere',
}
