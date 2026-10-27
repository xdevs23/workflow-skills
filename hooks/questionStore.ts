import type { EngineInterface } from 'claude-code'

import type { Question, SessionScope } from '../types'
import {
  Withdrawal,
  findOpenQuestion,
  isAnswered,
  isNumberTaken,
  isPositiveInteger,
  nextNumberOf,
} from './questions'
import type { AnsweredQuestion } from './questions'

/** Where the engine writes the store file of the plugin, named in the texts of its errors. */
const STORE_FOLDER = '~/.claude/plugins/store/'

/**
 * The text in the error of a write the store rejects while another process writes its file. Such a
 * rejection is transient, so the write is made again after a short wait.
 */
const LOCK_REFUSAL = 'Lock file is already being held'
const LOCK_RETRY_DELAY_MS = 50

/**
 * The kinds of record stored for a question, and the record of the last load of the question skill
 * in a session, each under a key of its own. A question is written by the session that asks it, an
 * answer by the session it is given in, a withdrawal and a delivery by the session that asked, and
 * a load by the session that loaded the skill. Every key therefore has one writer, and two sessions
 * never overwrite each other, although the store has no compare-and-set. The one exception is an
 * old load record, which any session deletes.
 */
enum RecordKind {
  Question = 'questions',
  Answer = 'answers',
  Withdrawal = 'withdrawals',
  Delivery = 'deliveries',
  QuestionSkillLoad = 'questionSkillLoads',
}

type StoredQuestion = Omit<Question, 'answer' | 'withdrawnAt'>
type StoredAnswer = { text: string; answeredAt: number }

/** The context size of a session when the Skill tool loaded the question skill, and when saved. */
export type QuestionSkillLoad = { contextTokens: number; savedAt: number }

/** A failure of the store of the plugin that a person can act on, its next step in the message. */
export class QuestionStoreError extends Error {}

export class UnreadableQuestionError extends QuestionStoreError {
  readonly key: string

  constructor(key: string) {
    super(
      `The stored record under the key ${key} is not in the shape this plugin writes. ` +
        `Restore or delete that entry in the store file of the plugin in ${STORE_FOLDER}, ` +
        'then try again.',
    )
    this.key = key
  }
}

export class QuestionNotSavedError extends QuestionStoreError {
  readonly key: string

  constructor(key: string, cause: unknown) {
    super(
      `The store did not save the change to the key ${key}: ${messageOf(cause)}. ` +
        'The store of the plugin is limited to 4 MiB of JSON for the questions of all projects ' +
        'together. When it is full, delete answered questions from the store file of the plugin ' +
        `in ${STORE_FOLDER}, then try again.`,
      { cause },
    )
    this.key = key
  }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The part of the store keys that names a project. A digest gives every project root a key part of
 * fixed length made of hexadecimal digits, which is safe in any file format.
 */
export async function projectDigestOf(root: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(root))

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function prefixOf(record: RecordKind, project: string): string {
  return `${record}:${project}:`
}

export function storeKeyOf(project: string, id: string): string {
  return `${prefixOf(RecordKind.Question, project)}${id}`
}

/** The key of the load record of the session `sessionId`, and with an empty id their prefix. */
export function questionSkillLoadKeyOf(sessionId: string): string {
  return `${RecordKind.QuestionSkillLoad}:${sessionId}`
}

/**
 * The key of one answer to the question `id`. Every answer gets a key of its own, and of two
 * answers given at the same moment the one whose key was set first is the answer.
 */
function answerKeyOf(project: string, id: string): string {
  return `${prefixOf(RecordKind.Answer, project)}${id}:${crypto.randomUUID()}`
}

/** The records of one kind in the project, by the id of their question, in the order set. */
async function readRecords<T>(
  $: EngineInterface,
  keys: readonly string[],
  record: RecordKind,
  project: string,
  parse: (key: string, id: string, value: unknown) => T,
): Promise<Map<string, T>> {
  const prefix = prefixOf(record, project)
  const stored = await Promise.all(
    keys
      .filter(key => key.startsWith(prefix))
      .map(async key => ({ key, id: idOf(key.slice(prefix.length)), value: await $.store.get(key) })),
  )
  const records = new Map<string, T>()
  for (const { key, id, value } of stored) {
    if (value !== undefined && !records.has(id)) {
      records.set(id, parse(key, id, value))
    }
  }

  return records
}

/** The id of the question in the rest of a key, which an answer key follows with its own id. */
function idOf(rest: string): string {
  const separator = rest.indexOf(':')

  return separator === -1 ? rest : rest.slice(0, separator)
}

/**
 * Reads every question of the project from the store, in the order their keys were first set. An
 * answer wins over a withdrawal made at the same moment, so the words of the user are never lost.
 */
export async function readProjectQuestions(
  $: EngineInterface,
  project: string,
): Promise<Question[]> {
  const keys = await $.store.keys()
  const [questions, answers, withdrawals, deliveries] = await Promise.all([
    readRecords($, keys, RecordKind.Question, project, parseQuestion),
    readRecords($, keys, RecordKind.Answer, project, parseAnswer),
    readRecords($, keys, RecordKind.Withdrawal, project, parseTime('withdrawnAt')),
    readRecords($, keys, RecordKind.Delivery, project, parseTime('deliveredAt')),
  ])

  return [...questions.values()].map(question => {
    const answer = answers.get(question.id)
    if (answer !== undefined) {
      return { ...question, answer: { ...answer, isDelivered: deliveries.has(question.id) } }
    }
    const withdrawnAt = withdrawals.get(question.id)

    return withdrawnAt === undefined ? question : { ...question, withdrawnAt }
  })
}

/**
 * Stores a new question under a number no other question of the project has, and returns it with
 * the questions of the project. The store has no compare-and-set, so the number is checked after
 * the write: of two questions with one number, the one whose key was set later takes the next free
 * number and is written again.
 */
export async function saveNewQuestion(
  $: EngineInterface,
  scope: SessionScope,
  asked: Pick<Question, 'text' | 'choices' | 'askedAt'>,
): Promise<{ question: Question; questions: Question[] }> {
  const asking = { id: crypto.randomUUID(), sessionId: scope.sessionId, ...asked }
  let question: Question = {
    ...asking,
    number: nextNumberOf(await readProjectQuestions($, scope.project)),
  }
  for (;;) {
    await saveRecord($, storeKeyOf(scope.project, question.id), question)
    const questions = await readProjectQuestions($, scope.project)
    if (!isNumberTaken(question, questions)) {
      return { question, questions }
    }
    question = { ...question, number: nextNumberOf(questions) }
  }
}

/**
 * Stores the answer to the open question numbered `number`, and returns the answered question, as
 * the store has it after the write, with the questions of the project. The answered question is
 * undefined when no open question has the number.
 */
export async function saveAnswer(
  $: EngineInterface,
  project: string,
  number: number,
  answer: StoredAnswer,
): Promise<{ answered: AnsweredQuestion | undefined; questions: Question[] }> {
  const question = findOpenQuestion(await readProjectQuestions($, project), number)
  if (question === undefined) {
    return { answered: undefined, questions: await readProjectQuestions($, project) }
  }
  await saveRecord($, answerKeyOf(project, question.id), answer)
  const questions = await readProjectQuestions($, project)

  return { answered: questions.filter(isAnswered).find(each => each.id === question.id), questions }
}

/**
 * Closes the open question numbered `number` without an answer, when the session of `scope` asked
 * it, and returns what became of the question with the questions of the project.
 */
export async function saveWithdrawal(
  $: EngineInterface,
  scope: SessionScope,
  number: number,
): Promise<{ withdrawal: Withdrawal; questions: Question[] }> {
  const questions = await readProjectQuestions($, scope.project)
  const question = findOpenQuestion(questions, number)
  if (question === undefined) {
    return { withdrawal: Withdrawal.NotOpen, questions }
  }
  if (question.sessionId !== scope.sessionId) {
    return { withdrawal: Withdrawal.AskedElsewhere, questions }
  }
  const withdrawnAt = await $.clock.now()
  await saveRecord($, `${prefixOf(RecordKind.Withdrawal, scope.project)}${question.id}`, { withdrawnAt })
  const after = await readProjectQuestions($, scope.project)
  const isWithdrawn = after.some(each => each.id === question.id && !isAnswered(each))

  return { withdrawal: isWithdrawn ? Withdrawal.Withdrawn : Withdrawal.NotOpen, questions: after }
}

/** Stores the answers as read by the session that asked, and returns them as stored. */
export async function saveDelivery(
  $: EngineInterface,
  project: string,
  answered: readonly AnsweredQuestion[],
): Promise<AnsweredQuestion[]> {
  const deliveredAt = await $.clock.now()
  await Promise.all(
    answered.map(question =>
      saveRecord($, `${prefixOf(RecordKind.Delivery, project)}${question.id}`, { deliveredAt }),
    ),
  )

  return answered.map(question => ({ ...question, answer: { ...question.answer, isDelivered: true } }))
}

/** The load record of the session `sessionId`, undefined when the store has none. */
export async function readQuestionSkillLoad(
  $: EngineInterface,
  sessionId: string,
): Promise<QuestionSkillLoad | undefined> {
  return readQuestionSkillLoadUnder($, questionSkillLoadKeyOf(sessionId))
}

export async function saveQuestionSkillLoad(
  $: EngineInterface,
  sessionId: string,
  load: QuestionSkillLoad,
): Promise<void> {
  await saveRecord($, questionSkillLoadKeyOf(sessionId), load)
}

export async function deleteQuestionSkillLoad(
  $: EngineInterface,
  sessionId: string,
): Promise<void> {
  await deleteRecord($, questionSkillLoadKeyOf(sessionId))
}

/** Deletes every load record saved before the time `time`. */
export async function deleteQuestionSkillLoadsSavedBefore(
  $: EngineInterface,
  time: number,
): Promise<void> {
  const prefix = questionSkillLoadKeyOf('')
  const keys = (await $.store.keys()).filter(key => key.startsWith(prefix))
  await Promise.all(
    keys.map(async key => {
      const load = await readQuestionSkillLoadUnder($, key)
      if (load !== undefined && load.savedAt < time) {
        await deleteRecord($, key)
      }
    }),
  )
}

async function readQuestionSkillLoadUnder(
  $: EngineInterface,
  key: string,
): Promise<QuestionSkillLoad | undefined> {
  const value: unknown = await $.store.get(key)

  return value === undefined ? undefined : parseQuestionSkillLoad(key, value)
}

function saveRecord($: EngineInterface, key: string, value: unknown): Promise<void> {
  return writeRecord($, key, () => $.store.set(key, value))
}

function deleteRecord($: EngineInterface, key: string): Promise<void> {
  return writeRecord($, key, () => $.store.delete(key))
}

/**
 * Runs the change `write` to the key `key`, and again after a short wait while another process
 * writes the store file.
 */
async function writeRecord($: EngineInterface, key: string, write: () => Promise<void>) {
  for (;;) {
    try {
      await write()

      return
    } catch (error) {
      if (!(error instanceof Error && error.message.includes(LOCK_REFUSAL))) {
        throw new QuestionNotSavedError(key, error)
      }
    }
    await $.clock.sleep(LOCK_RETRY_DELAY_MS)
  }
}

/** Reads a stored value into a question, and fails on anything of another shape. */
function parseQuestion(key: string, id: string, value: unknown): StoredQuestion {
  if (!isQuestion(value) || value.id !== id) {
    throw new UnreadableQuestionError(key)
  }

  return value
}

function parseAnswer(key: string, _id: string, value: unknown): StoredAnswer {
  if (!isAnswer(value)) {
    throw new UnreadableQuestionError(key)
  }

  return value
}

/** Reads a record that has only the time it was made at, under the field `field`. */
function parseTime(field: string) {
  return (key: string, _id: string, value: unknown): number => {
    const time = isRecord(value) ? value[field] : undefined
    if (typeof time !== 'number') {
      throw new UnreadableQuestionError(key)
    }

    return time
  }
}

function parseQuestionSkillLoad(key: string, value: unknown): QuestionSkillLoad {
  if (
    !isRecord(value) ||
    typeof value.contextTokens !== 'number' ||
    typeof value.savedAt !== 'number'
  ) {
    throw new UnreadableQuestionError(key)
  }

  return { contextTokens: value.contextTokens, savedAt: value.savedAt }
}

function isQuestion(value: unknown): value is StoredQuestion {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isPositiveInteger(value.number) &&
    typeof value.sessionId === 'string' &&
    typeof value.text === 'string' &&
    Array.isArray(value.choices) &&
    value.choices.every(choice => typeof choice === 'string') &&
    typeof value.askedAt === 'number'
  )
}

function isAnswer(value: unknown): value is StoredAnswer {
  return isRecord(value) && typeof value.text === 'string' && typeof value.answeredAt === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
