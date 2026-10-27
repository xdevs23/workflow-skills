import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Question, SessionScope } from '../types'
import type { AnsweredQuestion } from './questions'
import { projectDigestOf, readProjectQuestions } from './questionStore'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference is written in this file with its plugin and key as literals, and the other
// modules read and write the state through the functions below.
const isTurnRunning = atom({ plugin: 'workflow-skills', key: 'isTurnRunning' } as const, false)
const sessionScope = atom({ plugin: 'workflow-skills', key: 'session' } as const, null)
const projectQuestions = atom({ plugin: 'workflow-skills', key: 'questions' } as const, [])
const deliveringAnswers = atom(
  { plugin: 'workflow-skills', key: 'deliveringAnswers' } as const,
  [],
)

/**
 * Fixes the scope of the session to the project root it starts in, so a later move of the
 * session, such as into a worktree, keeps the questions of that project. A start the session
 * raises again, after the engine replaced the hooks module, keeps the scope it has.
 */
export async function startSessionScope($: EngineInterface): Promise<SessionScope> {
  const [sessionId, root, kept] = await Promise.all([
    $.session.id(),
    $.session.root(),
    read($, sessionScope),
  ])
  const scope =
    kept?.sessionId === sessionId ? kept : { sessionId, project: await projectDigestOf(root) }
  await update($, sessionScope, () => scope)

  return scope
}

export function readSessionScope($: EngineInterface): Promise<SessionScope | null> {
  return read($, sessionScope)
}

/** Reads the questions of the project from the store into the state that the screens draw. */
export async function refreshQuestions($: EngineInterface, scope: SessionScope): Promise<void> {
  const questions = await readProjectQuestions($, scope.project)
  await update($, projectQuestions, () => questions)
}

/** The questions of the project, as this session last read or wrote them. */
export function readQuestions($: EngineInterface): Promise<readonly Question[]> {
  return read($, projectQuestions)
}

export async function updateQuestions(
  $: EngineInterface,
  change: (questions: readonly Question[]) => readonly Question[],
): Promise<void> {
  await update($, projectQuestions, change)
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
