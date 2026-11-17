import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Question, SessionQuestions } from '../types'
import type { AnsweredQuestion } from './questions'
import { readSessionQuestions } from './questionStore'
import { isSessionRunning, ofRunningSession } from './sessionBoundState'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the questions is written in this file with its plugin and key as literals,
// and the other modules read and write that state through the functions below.
const sessionActivity = atom(
  { plugin: 'workflow-skills', key: 'sessionActivity' } as const,
  null,
)
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

// The session whose questions the start of the process read, also when the read failed. The
// classic SessionStart hook that follows the start then leaves that read out, so a failure shows
// once. Before the start, the classic hook reads nothing, since no person is known to be at the
// prompt yet.
let sessionReadAtStart: string | undefined

export function recordReadAtStart(sessionId: string): void {
  sessionReadAtStart = sessionId
}

/** Whether the start of the process read the questions of `sessionId`, answered once. */
export function takeReadAtStart(sessionId: string): boolean {
  const wasRead = sessionReadAtStart === sessionId
  sessionReadAtStart = undefined

  return wasRead
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
 * Loads the questions of the session `sessionId` from the store into the state, unless the state
 * contains them already.
 */
export async function loadQuestionsUnlessInState(
  $: EngineInterface,
  sessionId: string,
): Promise<void> {
  if ((await readQuestionsInState($))?.sessionId !== sessionId) {
    await loadQuestionsFromStore($, sessionId)
  }
}

/**
 * The questions in the state with the id of their session while that session runs, and null
 * otherwise, such as before the session read them or after a switch to another session.
 */
export async function readQuestionsInState($: EngineInterface): Promise<SessionQuestions | null> {
  return ofRunningSession($, await read($, sessionQuestions))
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
  if (await isSessionRunning($, sessionId)) {
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

/** What the main conversation of a session does, as set by the start and the end of its turns. */
export enum SessionActivity {
  Idle = 'idle',
  TurnRunning = 'turn running',
  /**
   * The user stopped the last turn. The session drops a prompt submitted by a plugin until the
   * user sends input, which starts the next turn.
   */
  StoppedByUser = 'stopped by user',
}

const ACCEPTS_PLUGIN_PROMPTS: Record<SessionActivity, boolean> = {
  [SessionActivity.Idle]: true,
  [SessionActivity.TurnRunning]: false,
  [SessionActivity.StoppedByUser]: false,
}

/** The activity of the main conversation of the session with the id `sessionId`. */
export type ActivityOfSession = { sessionId: string; activity: SessionActivity }

async function readSessionActivity($: EngineInterface): Promise<SessionActivity> {
  const recorded = await ofRunningSession($, await read($, sessionActivity))

  return recorded?.activity ?? SessionActivity.Idle
}

/** Whether the running session accepts a prompt submitted by the plugin, or drops it. */
export async function readSessionAcceptsPluginPrompts($: EngineInterface): Promise<boolean> {
  return ACCEPTS_PLUGIN_PROMPTS[await readSessionActivity($)]
}

export async function setSessionActivity(
  $: EngineInterface,
  activity: SessionActivity,
): Promise<void> {
  const sessionId = await $.session.id()
  await update($, sessionActivity, () => ({ sessionId, activity }))
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
