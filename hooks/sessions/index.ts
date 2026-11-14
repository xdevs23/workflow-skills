import type { EngineInterface, MatchedHook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { showingStoreFailure } from '../failureToast'
import { isTypedByUser } from '../promptOrigin'
import { NEW_SESSION_SOURCES } from '../sessionSources'
import { firstPromptOf } from './sessionRecord'
import { awaitFirstPrompt, isFirstPromptAwaited, stopAwaitingFirstPrompt } from './sessionState'
import { saveFirstPrompt, saveSessionStart } from './sessionStore'
import { describeFirstPromptNotRecorded, describeStartNotRecorded } from './sessionTexts'

// /resume and a compaction go on with a session that recorded its start already, or that began
// before sessions recorded their start, so only a session with a new id records one.
const recordSessionStart: MatchedHook<
  'classic.SessionStart',
  { source: typeof NEW_SESSION_SOURCES }
> = async ($, e, next) => {
  const sessionId = await $.session.id()
  const start = { root: await $.session.root(), startedAt: await $.clock.now() }
  await showingStoreFailure(
    $,
    () => saveSessionStart($, sessionId, start),
    describeStartNotRecorded,
  )
  await awaitFirstPrompt($, sessionId)

  return next(e)
}

// A slash command is not a prompt that tells sessions apart, so the first prompt is the first text
// typed that runs no command.
const recordFirstPrompt: MatchedHook<'prompt.submit', EveryEvent> = async ($, e, next) => {
  if (isTypedByUser(e.origin) && e.command === undefined) {
    await saveFirstPromptOnce($, e.text)
  }

  return next(e)
}

/**
 * Records `prompt` as the first prompt of the running session, unless the session recorded one
 * already or did not record its start in this process. A prompt of white space alone is not one.
 */
async function saveFirstPromptOnce($: EngineInterface, prompt: string): Promise<void> {
  const sessionId = await $.session.id()
  if (!(await isFirstPromptAwaited($, sessionId))) {
    return
  }
  const firstPrompt = firstPromptOf(prompt)
  if (firstPrompt === '') {
    return
  }
  await stopAwaitingFirstPrompt($)
  await showingStoreFailure(
    $,
    () => saveFirstPrompt($, sessionId, firstPrompt),
    describeFirstPromptNotRecorded,
  )
}

/**
 * Registers the hooks that record the project folder, the start time and the first prompt of each
 * session, by which the imports of goals and reminders find the sessions of a project.
 */
export function registerSessionRecords(on: On): void {
  on('classic.SessionStart', { source: NEW_SESSION_SOURCES }, recordSessionStart)
  on('prompt.submit', EVERY_EVENT, recordFirstPrompt)
}
