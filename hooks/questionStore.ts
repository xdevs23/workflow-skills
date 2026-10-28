import type { EngineInterface } from 'claude-code'

import type { Question } from '../types'
import { messageOf } from './errorMessage'
import {
  Withdrawal,
  findOpenQuestion,
  isAnswered,
  isNumberTaken,
  isPositiveInteger,
  nextNumberOf,
  openQuestionsOf,
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
 * in a session, each under a key that includes the id of the session. Every record of a question is
 * written by the session that asked it, and a load by the session that loaded the skill. Every key
 * therefore has one writer, and two sessions never overwrite each other, although the store does
 * not offer compare-and-set. The one exception is an old load record, which any session deletes.
 */
enum RecordKind {
  Question = 'questions',
  Answer = 'answers',
  Withdrawal = 'withdrawals',
  Delivery = 'deliveries',
  QuestionSkillLoad = 'questionSkillLoads',
}

/** The kinds of record stored for a question, each under a key `<kind>:<owner>:<rest>`. */
type QuestionRecordKind = Exclude<RecordKind, RecordKind.QuestionSkillLoad>

const QUESTION_RECORD_KINDS = Object.values(RecordKind).filter(
  (kind): kind is QuestionRecordKind => kind !== RecordKind.QuestionSkillLoad,
)

/**
 * A key of a record of a question, read into its parts. The owner is the id of a session, or the
 * digest of a project root in a key written before the questions belonged to a session. The rest
 * begins with the id of the question.
 */
type QuestionRecordKey = { key: string; kind: QuestionRecordKind; owner: string; rest: string }

/**
 * The owner part of the keys written before the questions belonged to a session: the SHA-256
 * digest of the project root in 64 hexadecimal digits, a form that session ids do not have.
 */
const PROJECT_DIGEST = /^[0-9a-f]{64}$/

type StoredQuestion = Omit<Question, 'answer' | 'withdrawnAt'>
type StoredAnswer = { text: string; answeredAt: number }

/** The context size of a session when the Skill tool loaded the question skill, and when saved. */
export type QuestionSkillLoad = { contextTokens: number; savedAt: number }

/** A failure of the store of the plugin that a person can act on, its next step in the message. */
export class QuestionStoreError extends Error {}

/**
 * Runs `work`, and on a failure of the store returns what `answer` makes of its message, after
 * writing the message to the debug log. Every other error is passed on.
 */
export async function handleStoreFailure<T>(
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
        'The store of the plugin is limited to 4 MiB of JSON for the questions of all sessions ' +
        'together. When it is full, delete answered questions from the store file of the plugin ' +
        `in ${STORE_FOLDER}, then try again.`,
      { cause },
    )
    this.key = key
  }
}

function prefixOf(record: RecordKind, sessionId: string): string {
  return `${record}:${sessionId}:`
}

export function storeKeyOf(sessionId: string, id: string): string {
  return `${prefixOf(RecordKind.Question, sessionId)}${id}`
}

/** The key of the load record of the session `sessionId`, and with an empty id their prefix. */
export function questionSkillLoadKeyOf(sessionId: string): string {
  return `${RecordKind.QuestionSkillLoad}:${sessionId}`
}

/**
 * The key of one answer to the question `id`. Every answer gets a key of its own, and of two
 * answers given at the same moment the one whose key was set first is the answer.
 */
function answerKeyOf(sessionId: string, id: string): string {
  return `${prefixOf(RecordKind.Answer, sessionId)}${id}:${crypto.randomUUID()}`
}

/** The records of one kind in the session, by the id of their question, in the order set. */
async function readRecords<T>(
  $: EngineInterface,
  keys: readonly string[],
  record: RecordKind,
  sessionId: string,
  parse: (key: string, id: string, value: unknown) => T,
): Promise<Map<string, T>> {
  const prefix = prefixOf(record, sessionId)
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

function readQuestionRecordKey(key: string): QuestionRecordKey | undefined {
  const kind = QUESTION_RECORD_KINDS.find(each => key.startsWith(`${each}:`))
  if (kind === undefined) {
    return undefined
  }
  const ownerAndRest = key.slice(kind.length + 1)
  const separator = ownerAndRest.indexOf(':')

  return separator === -1
    ? undefined
    : { key, kind, owner: ownerAndRest.slice(0, separator), rest: ownerAndRest.slice(separator + 1) }
}

/** The id of the question in the rest of a key, which an answer key follows with its own id. */
function idOf(rest: string): string {
  const separator = rest.indexOf(':')

  return separator === -1 ? rest : rest.slice(0, separator)
}

/**
 * Reads every question the session `sessionId` asked from the store, in the order their keys were
 * first set. An answer wins over a withdrawal made at the same moment, so the words of the user are
 * never lost.
 */
export async function readSessionQuestions(
  $: EngineInterface,
  sessionId: string,
): Promise<Question[]> {
  const keys = await $.store.keys()
  const [questions, answers, withdrawals, deliveries] = await Promise.all([
    readRecords($, keys, RecordKind.Question, sessionId, parseQuestion),
    readRecords($, keys, RecordKind.Answer, sessionId, parseAnswer),
    readRecords($, keys, RecordKind.Withdrawal, sessionId, parseTime('withdrawnAt')),
    readRecords($, keys, RecordKind.Delivery, sessionId, parseTime('deliveredAt')),
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
 * Moves the records written under the digest of a project, before the questions belonged to a
 * session, to the keys of the session named in the `sessionId` field of their question, and
 * deletes the old keys. A record whose question is missing is deleted as well, since sessions
 * cannot reach it. The records are written again in the order of their old keys, so that order
 * still decides the numbers and the answer that counts.
 */
export async function moveProjectRecordsToSessions($: EngineInterface): Promise<void> {
  const records = (await $.store.keys()).flatMap(key => {
    const record = readQuestionRecordKey(key)

    return record !== undefined && PROJECT_DIGEST.test(record.owner) ? [record] : []
  })
  const values = await Promise.all(records.map(record => $.store.get(record.key)))
  const moved = records.map((record, index) => ({ ...record, value: values[index] }))
  const sessionOfQuestion = new Map<string, string>()
  const questions = new Map<string, StoredQuestion>()
  for (const { key, kind, owner, rest, value } of moved) {
    if (kind === RecordKind.Question && value !== undefined) {
      const { sessionId, question } = parseProjectQuestion(key, rest, value)
      sessionOfQuestion.set(`${owner}:${rest}`, sessionId)
      questions.set(key, question)
    }
  }
  for (const { key, kind, owner, rest, value } of moved) {
    const sessionId = sessionOfQuestion.get(`${owner}:${idOf(rest)}`)
    if (sessionId !== undefined && value !== undefined) {
      await saveRecord($, `${prefixOf(kind, sessionId)}${rest}`, questions.get(key) ?? value)
    }
  }
  await Promise.all(records.map(record => deleteRecord($, record.key)))
}

/**
 * Stores a new question of the session `sessionId` under a number that is free in the session, and
 * returns it with the questions of the session. The store does not offer compare-and-set, so the
 * number is checked after the write: of two questions asked at once with one number, the one whose
 * key was set later gets the next free number and is written again.
 */
export async function saveNewQuestion(
  $: EngineInterface,
  sessionId: string,
  asked: Pick<Question, 'text' | 'choices' | 'askedAt'>,
): Promise<{ question: Question; questions: Question[] }> {
  let question: Question = {
    id: crypto.randomUUID(),
    ...asked,
    number: nextNumberOf(await readSessionQuestions($, sessionId)),
  }
  for (;;) {
    await saveRecord($, storeKeyOf(sessionId, question.id), question)
    const questions = await readSessionQuestions($, sessionId)
    if (!isNumberTaken(question, questions)) {
      return { question, questions }
    }
    question = { ...question, number: nextNumberOf(questions) }
  }
}

/**
 * Stores the answer to the open question of the session `sessionId` that `which` selects, and
 * returns the answered question, as the store has it after the write, with the questions of the
 * session. The answered question is undefined unless an open question is selected.
 */
export async function saveAnswer(
  $: EngineInterface,
  sessionId: string,
  which: (question: Question) => boolean,
  answer: StoredAnswer,
): Promise<{ answered: AnsweredQuestion | undefined; questions: Question[] }> {
  const question = openQuestionsOf(await readSessionQuestions($, sessionId)).find(which)
  if (question === undefined) {
    return { answered: undefined, questions: await readSessionQuestions($, sessionId) }
  }
  await saveRecord($, answerKeyOf(sessionId, question.id), answer)
  const questions = await readSessionQuestions($, sessionId)

  return { answered: questions.filter(isAnswered).find(each => each.id === question.id), questions }
}

/**
 * Closes the open question numbered `number` of the session `sessionId` without an answer, and
 * returns what became of the question with the questions of the session.
 */
export async function saveWithdrawal(
  $: EngineInterface,
  sessionId: string,
  number: number,
): Promise<{ withdrawal: Withdrawal; questions: Question[] }> {
  const questions = await readSessionQuestions($, sessionId)
  const question = findOpenQuestion(questions, number)
  if (question === undefined) {
    return { withdrawal: Withdrawal.NotOpen, questions }
  }
  const withdrawnAt = await $.clock.now()
  const withdrawalKey = `${prefixOf(RecordKind.Withdrawal, sessionId)}${question.id}`
  await saveRecord($, withdrawalKey, { withdrawnAt })
  const after = await readSessionQuestions($, sessionId)
  const isWithdrawn = after.some(each => each.id === question.id && !isAnswered(each))

  return { withdrawal: isWithdrawn ? Withdrawal.Withdrawn : Withdrawal.NotOpen, questions: after }
}

/** Stores the answers as read by the session `sessionId`, and returns them as stored. */
export async function saveDelivery(
  $: EngineInterface,
  sessionId: string,
  answered: readonly AnsweredQuestion[],
): Promise<AnsweredQuestion[]> {
  const deliveredAt = await $.clock.now()
  await Promise.all(
    answered.map(question =>
      saveRecord($, `${prefixOf(RecordKind.Delivery, sessionId)}${question.id}`, { deliveredAt }),
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

/**
 * Deletes every load record saved before `loadsSavedBefore`, and every record of the questions of
 * a session other than `sessionId` whose newest record was made before `questionsMadeBefore`.
 */
export async function deleteOldRecords(
  $: EngineInterface,
  old: { sessionId: string; loadsSavedBefore: number; questionsMadeBefore: number },
): Promise<void> {
  const keys = await $.store.keys()
  await Promise.all([
    deleteQuestionSkillLoadsSavedBefore($, keys, old.loadsSavedBefore),
    deleteQuestionsOfSessionsIdleSince($, keys, old.sessionId, old.questionsMadeBefore),
  ])
}

/** Deletes every load record among `keys` saved before the time `time`. */
async function deleteQuestionSkillLoadsSavedBefore(
  $: EngineInterface,
  keys: readonly string[],
  time: number,
): Promise<void> {
  const prefix = questionSkillLoadKeyOf('')
  await Promise.all(
    keys
      .filter(key => key.startsWith(prefix))
      .map(async key => {
        const load = await readQuestionSkillLoadUnder($, key)
        if (load !== undefined && load.savedAt < time) {
          await deleteRecord($, key)
        }
      }),
  )
}

/**
 * Deletes the records among `keys` of the questions of every session other than `sessionId` whose
 * newest record was made before the time `time`. A record of another shape, or one deleted since
 * the keys were listed, keeps its session, since its age is unknown.
 */
async function deleteQuestionsOfSessionsIdleSince(
  $: EngineInterface,
  keys: readonly string[],
  sessionId: string,
  time: number,
): Promise<void> {
  const records = keys.flatMap(key => {
    const record = readQuestionRecordKey(key)

    return record === undefined || record.owner === sessionId ? [] : [record]
  })
  const made = await Promise.all(
    records.map(async ({ key, kind, owner }) => ({
      key,
      owner,
      madeAt: RECORD_TIMES[kind](await $.store.get(key)) ?? Number.POSITIVE_INFINITY,
    })),
  )
  const newest = new Map<string, number>()
  for (const { owner, madeAt } of made) {
    newest.set(owner, Math.max(newest.get(owner) ?? madeAt, madeAt))
  }
  const idle = new Set([...newest].filter(([, madeAt]) => madeAt < time).map(([owner]) => owner))
  await Promise.all(made.filter(({ owner }) => idle.has(owner)).map(({ key }) => deleteRecord($, key)))
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

/**
 * Reads a question written under the digest of a project into a question of the current shape,
 * with the session that asked it.
 */
function parseProjectQuestion(
  key: string,
  id: string,
  value: unknown,
): { sessionId: string; question: StoredQuestion } {
  const { number, text, choices, askedAt } = parseQuestion(key, id, value)
  const sessionId = isRecord(value) ? value.sessionId : undefined
  if (typeof sessionId !== 'string') {
    throw new UnreadableQuestionError(key)
  }

  return { sessionId, question: { id, number, text, choices, askedAt } }
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
    const time = timeIn(value, field)
    if (time === undefined) {
      throw new UnreadableQuestionError(key)
    }

    return time
  }
}

/** The time under the field `field` of a record, undefined for a record of another shape. */
function timeIn(value: unknown, field: string): number | undefined {
  const time = isRecord(value) ? value[field] : undefined

  return typeof time === 'number' ? time : undefined
}

/** The time at which a record of each kind was made, undefined for a record of another shape. */
const RECORD_TIMES: Record<QuestionRecordKind, (value: unknown) => number | undefined> = {
  [RecordKind.Question]: value => (isQuestion(value) ? value.askedAt : undefined),
  [RecordKind.Answer]: value => (isAnswer(value) ? value.answeredAt : undefined),
  [RecordKind.Withdrawal]: value => timeIn(value, 'withdrawnAt'),
  [RecordKind.Delivery]: value => timeIn(value, 'deliveredAt'),
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
