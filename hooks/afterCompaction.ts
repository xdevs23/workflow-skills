import type { Args, ClassicResultOf, EngineInterface, Frozen, Next } from 'claude-code'

import { isMainConversation } from './conversation'
import { showFailure } from './failureToast'
import { PromptOutcome, submitToSessionOrRestore } from './sendToModel'
import type { TextWithLine } from './sendToModel'
import { readIsTurnRunning } from './sessionState'
import { runDetached } from './timedWork'

/** A text read by the main conversation after a compaction. */
export type CompactionNote = TextWithLine & {
  /** Puts back the state recorded as sent when the note was taken, once the text was not sent. */
  restore?: () => Promise<void>
}

/** A feature that sends a note to the main conversation after every compaction. */
export type CompactionNoteSource = {
  /** Takes the note to send, or returns undefined when there is nothing to send. */
  takeNote: () => Promise<CompactionNote | undefined>
  /** The toast for the note left unsent, with the reason given by the engine or the failure. */
  describeNotSent: (reason: string) => string
}

/** A note taken from `source`. */
type TakenNote = { source: CompactionNoteSource; note: CompactionNote }

/**
 * Runs the start `e` that follows a compaction, and sends the notes of `sources` to the main
 * conversation. A compaction during a turn is followed by the next model call of that turn, which
 * reads the context block after the summary, so the texts go there, and their lines in the
 * transcript show that they were sent. A compaction while no turn runs, such as /compact or a
 * compaction run on an idle session, is followed by no model call, so the texts go as one prompt
 * submitted by the plugin, which starts a turn.
 */
export async function startWithNotesAfterCompaction(
  $: EngineInterface,
  e: Frozen<Args<'classic.SessionStart'>>,
  next: Next<'classic.SessionStart'>,
  sources: readonly CompactionNoteSource[],
): Promise<ClassicResultOf['classic.SessionStart']> {
  const ran = await next(e)
  if (!isMainConversation({ agentId: e.agent_id })) {
    return ran
  }
  const taken = await takeNotes(sources)
  if (taken.length === 0) {
    return ran
  }
  if (!(await readIsTurnRunning($))) {
    const sessionId = await $.session.id()
    runDetached($, () => submitNotes($, sessionId, taken), reason => describeNotSent(taken, reason))

    return ran
  }
  for (const { note } of taken) {
    $.ui.log(note.line)
  }

  return { ...ran, additionalContext: [...(ran.additionalContext ?? []), ...textsOf(taken)] }
}

/** Takes the note of every source. When one source fails, the notes taken by the others are put back. */
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
 * Submits the texts of `taken` as one prompt submitted by the plugin to the session `sessionId`.
 * The prompt shows in the transcript itself, so the lines are not shown. A prompt that does not
 * enter puts back what each note recorded as sent, and a dropped prompt shows the toast of each
 * source.
 */
async function submitNotes(
  $: EngineInterface,
  sessionId: string,
  taken: readonly TakenNote[],
): Promise<void> {
  const submitted = await submitToSessionOrRestore(
    $,
    sessionId,
    { text: textsOf(taken).join('\n\n') },
    () => restoreNotes(taken),
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeNotSent(taken, submitted.reason))
  }
}

async function restoreNotes(taken: readonly TakenNote[]): Promise<void> {
  await Promise.all(taken.map(({ note }) => note.restore?.()))
}

function textsOf(taken: readonly TakenNote[]): string[] {
  return taken.map(({ note }) => note.text)
}

/** The toasts of the sources of `taken`, each with `reason`, in one text. */
function describeNotSent(taken: readonly TakenNote[], reason: string): string {
  return taken.map(({ source }) => source.describeNotSent(reason)).join(' ')
}
