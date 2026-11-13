import type {
  EngineInterface,
  Frozen,
  Next,
  SessionCompactInput,
  SessionCompactResult,
} from 'claude-code'

import { REPLACES_CONVERSATION } from './compactionTrigger'
import { isMainConversation } from './conversation'
import { showFailure } from './failureToast'
import { PromptOutcome, submitToSessionOrRestore } from './sendToModel'
import { readIsTurnRunning } from './sessionState'
import { runDetached } from './timedWork'

/** A text read by the main conversation after a compaction. */
export type CompactionNote = {
  text: string
  /** Puts back the state recorded as sent when the note was taken, once the text was not sent. */
  restore?: () => Promise<void>
}

/** A feature that sends a note to the main conversation after every compaction of it. */
export type CompactionNoteSource = {
  /** Takes the note to send, or returns undefined when there is nothing to send. */
  takeNote: () => Promise<CompactionNote | undefined>
  /** The toast for the note left unsent, with the reason given by the engine or the failure. */
  describeNotSent: (reason: string) => string
}

/** A note taken from `source`. */
type TakenNote = { source: CompactionNoteSource; note: CompactionNote }

/**
 * Runs the compaction `e`, and sends the notes of `sources` to the main conversation once the
 * compaction replaced it. A compaction skipped by a hook beneath, a `precompute`, and a compaction
 * by a subagent or a workflow agent, which has the agent id, do not send the notes. The texts go as
 * one message, which shows in the transcript itself, so the plugin does not log a line for it. A
 * compaction during a turn is followed by the next model call of that turn, which reads the
 * messages after the summary, so the message goes there. A compaction while no turn runs, such as
 * /compact or a compaction run on an idle session, is followed by no model call, so the message
 * goes as a prompt submitted by the plugin, which starts a turn.
 */
export async function compactWithNotes(
  $: EngineInterface,
  e: Frozen<SessionCompactInput>,
  next: Next<'session.compact'>,
  sources: readonly CompactionNoteSource[],
): Promise<SessionCompactResult> {
  const compacted = await next(e)
  if (
    compacted.skip !== undefined ||
    !REPLACES_CONVERSATION[e.trigger] ||
    !isMainConversation(e)
  ) {
    return compacted
  }
  const taken = await takeNotes(sources)
  if (taken.length === 0) {
    return compacted
  }
  if (!(await readIsTurnRunning($))) {
    const sessionId = await $.session.id()
    runDetached($, () => submitNotes($, sessionId, taken), reason => describeNotSent(taken, reason))

    return compacted
  }

  return {
    ...compacted,
    messages: [...compacted.messages, { role: 'user', text: textOf(taken), toolUses: [] }],
  }
}

/**
 * Takes the note of every source. When one source fails, the notes taken by the others are put
 * back.
 */
export async function takeNotes(sources: readonly CompactionNoteSource[]): Promise<TakenNote[]> {
  const results = await Promise.allSettled(
    sources.map(async (source): Promise<TakenNote[]> => {
      const note = await source.takeNote()

      return note === undefined ? [] : [{ source, note }]
    }),
  )
  const taken = results.flatMap(result => (result.status === 'fulfilled' ? result.value : []))
  const failed = results.find(result => result.status === 'rejected')
  if (failed !== undefined) {
    await restoreNotes(taken)
    throw failed.reason
  }

  return taken
}

/**
 * Submits the texts of `taken` as one prompt submitted by the plugin to the session `sessionId`. A
 * prompt that does not enter puts back what each note recorded as sent, and a dropped prompt shows
 * the toast of each source.
 */
async function submitNotes(
  $: EngineInterface,
  sessionId: string,
  taken: readonly TakenNote[],
): Promise<void> {
  const submitted = await submitToSessionOrRestore(
    $,
    sessionId,
    { text: textOf(taken) },
    () => restoreNotes(taken),
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeNotSent(taken, submitted.reason))
  }
}

async function restoreNotes(taken: readonly TakenNote[]): Promise<void> {
  await Promise.all(taken.map(({ note }) => note.restore?.()))
}

/** The texts of `taken`, in one text. */
function textOf(taken: readonly TakenNote[]): string {
  return taken.map(({ note }) => note.text).join('\n\n')
}

/** The toasts of the sources of `taken`, each with `reason`, in one text. */
function describeNotSent(taken: readonly TakenNote[], reason: string): string {
  return taken.map(({ source }) => source.describeNotSent(reason)).join(' ')
}
