import { atom, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import { showFailure } from './failureToast'
import type { HintKindName } from './hintKind'
import { markHintKindsSentInTurn } from './hintState'
import { writeHintTextsWithEachStepOnce } from './hintText'
import type { HintText } from './hintText'
import { PendingTextPlace, submitAddedText } from './pendingTexts'
import type { PendingTextSource, PromptNoteSource, TakenNote } from './pendingTexts'
import { PromptOutcome, submitToSessionOrRestore } from './sendToModel'
import type { TextWithLine } from './sendToModel'
import { updateOfSession } from './sessionBoundState'

/** A note on the hints of `kinds` that has not gone to the model of the session `sessionId` yet. */
export type PendingHintNote = { sessionId: string; kinds: readonly HintKindName[]; text: string }

const pendingHintNote = atom({ plugin: 'workflow-skills', key: 'pendingHintNote' } as const, null)

/** Ends the hints. The user reads only the message, where an answer to a hint reads as nonsense. */
const HINT_CLOSING = 'Act on this reminder without mentioning the reminder in your message.'

/** The note on `texts`, the texts of the hints, with the closing sentence. */
export function writeHintNote(texts: readonly HintText[]): string {
  return [...writeHintTextsWithEachStepOnce(texts), HINT_CLOSING].join('\n\n')
}

const HINT_SENT_LINE_OPENINGS: Record<PendingTextPlace, string> = {
  [PendingTextPlace.ToolResult]: 'Hint sent to Claude with a tool result:',
  [PendingTextPlace.BesidePrompt]: 'Hint sent to Claude beside your message:',
}

const HINT_NOTE_WAITING_AFTER_STOP =
  "The hint on Claude's last turn is sent to Claude once you type a slash command or send a " +
  'message.'

function describeHintNoteWaitingForPane(paneTitle: string): string {
  return (
    `The hint on Claude's last turn is sent to Claude once you close the ${paneTitle} pane or ` +
    'send a message.'
  )
}

/** The toast for a hint note left unsent for `reason`, which waits for the next try. */
function describeHintNoteNotSent(reason: string): string {
  return (
    `The hint on Claude's last turn was not sent to Claude: ${reason}. It goes to Claude with ` +
    'your next message, or with the next tool result if a turn is running by then.'
  )
}

const HINT_NOTE_OF_OTHER_SESSION =
  "The hint on Claude's last turn was dropped: another session runs by now, and the hint " +
  'concerns the one before.'

/** The hint notes that have not gone to the model yet, as a source of texts sent to the model. */
export function hintNotesSource($: EngineInterface): PendingTextSource & PromptNoteSource {
  return {
    takeNote: async () => {
      const taken = await takePendingHintNote($)

      return taken && noteAt(taken, PendingTextPlace.ToolResult)
    },
    takeNoteBesidePrompt: () => takeHintNoteBesidePrompt($),
    submit: () => submitPendingHintNote($),
    describeNotSent: describeHintNoteNotSent,
    waitingAfterStopToast: HINT_NOTE_WAITING_AFTER_STOP,
    describeWaitingForPane: describeHintNoteWaitingForPane,
  }
}

/**
 * Puts the note on `texts`, the texts of the hints of `kinds`, among the pending hint notes of the
 * session `sessionId`, and sends it to the model once, as `submitAddedText` describes.
 */
export async function deliverHintNote(
  $: EngineInterface,
  sessionId: string,
  kinds: readonly HintKindName[],
  texts: readonly HintText[],
): Promise<void> {
  await addPendingHintNote($, { sessionId, kinds, text: writeHintNote(texts) })
  submitAddedText($, hintNotesSource($))
}

/**
 * Joins `note` to the pending hint note of its session. Drops `note` where another session runs by
 * now, and writes that to the debug log.
 */
async function addPendingHintNote($: EngineInterface, note: PendingHintNote): Promise<void> {
  const pending = await updateOfSession<PendingHintNote>(
    $,
    note.sessionId,
    own =>
      own === null
        ? note
        : { ...own, kinds: [...own.kinds, ...note.kinds], text: `${own.text}\n\n${note.text}` },
    change => update($, pendingHintNote, change),
  )
  if (pending === null) {
    $.ui.log(HINT_NOTE_OF_OTHER_SESSION, { to: 'debug' })
  }
}

/**
 * Removes the pending hint note of the running session from the state, and returns it. Its kinds
 * count as sent in the turn that receives the note, so the reply to the note cannot start the same
 * hints again.
 */
async function takePendingHintNote($: EngineInterface): Promise<PendingHintNote | undefined> {
  let taken: PendingHintNote | undefined
  const sessionId = await $.session.id()
  await updateOfSession<PendingHintNote>(
    $,
    sessionId,
    own => {
      // A retried write runs this again, and its last run decides.
      taken = own ?? undefined

      return null
    },
    change => update($, pendingHintNote, change),
  )
  if (taken !== undefined) {
    await markHintKindsSentInTurn($, sessionId, taken.kinds)
  }

  return taken
}

function noteAt({ text }: PendingHintNote, place: PendingTextPlace): TextWithLine {
  return { text, line: `${HINT_SENT_LINE_OPENINGS[place]} ${text}` }
}

async function takeHintNoteBesidePrompt($: EngineInterface): Promise<TakenNote | undefined> {
  const taken = await takePendingHintNote($)

  return (
    taken && {
      note: noteAt(taken, PendingTextPlace.BesidePrompt),
      restore: () => addPendingHintNote($, taken),
    }
  )
}

/** Submits the pending hint note of the running session as a prompt of the plugin. */
async function submitPendingHintNote($: EngineInterface): Promise<void> {
  const taken = await takePendingHintNote($)
  if (taken === undefined) {
    return
  }
  // The prompt shows in the transcript itself, so it is sent without a transcript line.
  const submitted = await submitToSessionOrRestore($, taken.sessionId, { text: taken.text }, () =>
    addPendingHintNote($, taken),
  )
  if (submitted.outcome === PromptOutcome.Dropped) {
    showFailure($, describeHintNoteNotSent(submitted.reason))
  }
}
