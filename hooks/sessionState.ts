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

/** The scope of the session, and whether the call that returned it was the one that fixed it. */
type EstablishedScope = { scope: SessionScope; isNew: boolean }

/**
 * Returns the scope of the session, and fixes it at the first call in the session. A session that
 * /resume or /clear switched to raises no start, so every use of the questions calls this.
 *
 * A later move of the session, such as into a worktree, does not change the project of the scope.
 * A session that /resume or /clear switched to takes the project of the scope stored before the
 * switch. Only where the host has no scope stored, as in a new process, is the project the root
 * the session is in at that call. Whether the host drops the stored scope at /resume is not
 * confirmed. Where it does, a session that moved into a worktree before /resume takes the worktree
 * as its project.
 */
export async function establishSessionScope($: EngineInterface): Promise<EstablishedScope> {
  const [sessionId, stored] = await Promise.all([$.session.id(), read($, sessionScope)])
  const current = scopeOfSession(stored, sessionId)
  if (current !== null) {
    return { scope: current, isNew: false }
  }
  const project = stored?.project ?? (await projectDigestOf(await $.session.root()))
  const scope = { sessionId, project }
  await update($, sessionScope, () => scope)

  return { scope, isNew: true }
}

/**
 * The scope of the session once a use of the questions fixed it, and null before that and in a
 * session without a person at the prompt.
 */
export async function readSessionScope($: EngineInterface): Promise<SessionScope | null> {
  const [sessionId, stored] = await Promise.all([$.session.id(), read($, sessionScope)])

  return scopeOfSession(stored, sessionId)
}

/** The stored scope when it belongs to the session `sessionId`, and null otherwise. */
function scopeOfSession(stored: SessionScope | null, sessionId: string): SessionScope | null {
  return stored?.sessionId === sessionId ? stored : null
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
