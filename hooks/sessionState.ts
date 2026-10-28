import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Question, SessionQuestions } from '../types'
import type { AnsweredQuestion } from './questions'
import { readSessionQuestions } from './questionStore'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the questions is written in this file with its plugin and key as literals,
// and the other modules read and write that state through the functions below.
const isTurnRunning = atom({ plugin: 'workflow-skills', key: 'isTurnRunning' } as const, false)
const sessionQuestions = atom(
  { plugin: 'workflow-skills', key: 'sessionQuestions' } as const,
  null,
)
const deliveringAnswers = atom(
  { plugin: 'workflow-skills', key: 'deliveringAnswers' } as const,
  [],
)

// Whether a person is at the prompt, as the start of the session tells. The module and not the
// state of the host has it: a session that /resume or /clear switched to raises no start, and the
// host may have no state for it. A fresh copy of the module raises the start again.
let isPersonAtPrompt = false

export function recordPersonAtPrompt(isInteractive: boolean): void {
  isPersonAtPrompt = isInteractive
}

export function hasPersonAtPrompt(): boolean {
  return isPersonAtPrompt
}

/**
 * Reads the questions of the session `sessionId` from the store into the state that the screens
 * draw, and returns them.
 */
export async function loadQuestionsFromStore(
  $: EngineInterface,
  sessionId: string,
): Promise<readonly Question[]> {
  const questions = await readSessionQuestions($, sessionId)
  await setQuestionsInState($, sessionId, questions)

  return questions
}

/**
 * Loads the questions of the session that runs from the store into the state, unless the state
 * contains them already.
 */
export async function loadQuestionsUnlessInState($: EngineInterface): Promise<void> {
  if ((await readQuestionsInState($)) === null) {
    await loadQuestionsFromStore($, await $.session.id())
  }
}

/**
 * The questions in the state with the id of their session while that session runs, and null
 * otherwise, such as before the session read them or after a switch to another session.
 */
export async function readQuestionsInState($: EngineInterface): Promise<SessionQuestions | null> {
  const [sessionId, inState] = await Promise.all([$.session.id(), read($, sessionQuestions)])

  return inState?.sessionId === sessionId ? inState : null
}

/**
 * Puts the questions of the session `sessionId`, as the store has them, into the state, unless
 * another session runs by now.
 */
export async function setQuestionsInState(
  $: EngineInterface,
  sessionId: string,
  questions: readonly Question[],
): Promise<void> {
  if ((await $.session.id()) === sessionId) {
    await update($, sessionQuestions, () => ({ sessionId, questions }))
  }
}

/**
 * Changes the questions in the state, once a session has read them, and keeps the session they
 * belong to. `change` finds the questions by their ids, which differ across sessions, so a change
 * for one session leaves the questions of another as they are.
 */
export async function updateQuestions(
  $: EngineInterface,
  change: (questions: readonly Question[]) => readonly Question[],
): Promise<void> {
  await update($, sessionQuestions, inState =>
    inState === null ? null : { ...inState, questions: change(inState.questions) },
  )
}

export function readIsTurnRunning($: EngineInterface): Promise<boolean> {
  return read($, isTurnRunning)
}

export async function setTurnRunning($: EngineInterface, isRunning: boolean): Promise<void> {
  await update($, isTurnRunning, () => isRunning)
}

/**
 * Marks the answers as being delivered by this session, and returns the ones another delivery of
 * the session was not delivering already.
 */
export async function claimAnswers(
  $: EngineInterface,
  undelivered: readonly AnsweredQuestion[],
): Promise<AnsweredQuestion[]> {
  let claimed: AnsweredQuestion[] = []
  await update($, deliveringAnswers, delivering => {
    claimed = undelivered.filter(question => !delivering.includes(question.id))

    return [...delivering, ...claimed.map(question => question.id)]
  })

  return claimed
}

export async function releaseAnswers(
  $: EngineInterface,
  claimed: readonly AnsweredQuestion[],
): Promise<void> {
  await update($, deliveringAnswers, delivering =>
    delivering.filter(id => !claimed.some(question => question.id === id)),
  )
}
