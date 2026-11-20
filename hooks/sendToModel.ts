import type {
  Args,
  ClassicResultOf,
  EngineInterface,
  Frozen,
  Next,
  PromptSubmitArgs,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { isMainConversation, isModelToolCall } from './conversation'

/**
 * A text read by the model, and the line in the transcript that shows it was sent. The model does
 * not read the line. Each paragraph of the line goes to rows of its own, as logSentLine writes it.
 */
export type TextWithLine = { text: string; line: string }

/** The characters of a row of the transcript that the terminal draws, as `$.ui.log` states. */
const DRAWN_ROW_LENGTH = 2000

/** A piece of a row that the terminal draws whole, counted in code points. */
const DRAWN_ROW_PIECE = new RegExp(`[\\s\\S]{1,${DRAWN_ROW_LENGTH}}`, 'gu')

/** The result of a delivery, and whether the model received what was handed to it. */
export type Delivery<T> = { result: T; isAccepted: boolean }

/** A feature that sends a note to the main conversation. */
export type NoteSource<Note> = {
  /** Takes the note to send, or returns undefined when there is nothing to send. */
  takeNote: () => Promise<Note | undefined>
  /** The toast for the note left unsent, with the reason given by the engine or the failure. */
  describeNotSent: (reason: string) => string
}

/** What became of a prompt that the plugin submitted to a session. */
export enum PromptOutcome {
  Entered = 'entered',
  /** Another session runs by now, so the prompt was not submitted. */
  OtherSession = 'other session',
  Dropped = 'dropped',
}

export type SubmittedPrompt =
  | { outcome: PromptOutcome.Entered | PromptOutcome.OtherSession }
  | { outcome: PromptOutcome.Dropped; reason: string }

/**
 * Runs the tool call `e`, and appends the note made by `takeNote` to its result when the model of
 * the main conversation made the call and no hook beneath denied it. `takeNote` runs only then.
 */
export async function callToolWithNote(
  e: Frozen<ToolCallInput>,
  next: Next<'tool.call'>,
  takeNote: () => Promise<string | undefined>,
): Promise<ToolCallResult> {
  const ran = await next(e)
  if (ran.deny !== undefined || !isModelToolCall(e, next.origin)) {
    return ran
  }
  const note = await takeNote()

  return note === undefined ? ran : { ...ran, context: [...(ran.context ?? []), note] }
}

/** Makes the note for the end of a turn on `message`, or returns undefined without one. */
type TakeStopNote = (
  message: string,
) => Promise<TextWithLine | undefined> | TextWithLine | undefined

/**
 * Runs the end of the turn `e` as stopWithNoteAlsoAfterBlock does, but only for the first end of a
 * turn. The engine marks the next end of that turn as one that follows a blocked end, and for that
 * end stopWithNote returns the result of the hooks beneath, so a turn that finds nothing more to do
 * can end.
 */
export function stopWithNote(
  $: EngineInterface,
  e: Frozen<Args<'classic.Stop'>>,
  next: Next<'classic.Stop'>,
  takeNote: TakeStopNote,
): Promise<ClassicResultOf['classic.Stop']> {
  return e.stop_hook_active ? next(e) : stopWithNoteAlsoAfterBlock($, e, next, takeNote)
}

/**
 * Runs the end of the turn `e`, and returns a block for it with the note made by `takeNote` from
 * the last message as the reason, so the main conversation goes back to work with the note. The
 * engine does not show the reason, so the line of the note goes to the transcript. A block asked
 * by a hook beneath comes first in the reason. Also an end that follows a blocked end gets a block
 * whenever `takeNote` makes a note, so the turn ends only once `takeNote` returns undefined.
 * `takeNote` runs only for an end of a turn of the main conversation, on a message, where no hook
 * beneath stopped the session.
 */
export async function stopWithNoteAlsoAfterBlock(
  $: EngineInterface,
  e: Frozen<Args<'classic.Stop'>>,
  next: Next<'classic.Stop'>,
  takeNote: TakeStopNote,
): Promise<ClassicResultOf['classic.Stop']> {
  const stopped = await next(e)
  const message = e.last_assistant_message
  if (
    message === undefined ||
    stopped.preventContinuation === true ||
    !isMainConversation({ agentId: e.agent_id })
  ) {
    return stopped
  }
  const note = await takeNote(message)
  if (note === undefined) {
    return stopped
  }
  logSentLine($, note.line)
  const reasons = stopped.block === undefined ? [note.text] : [stopped.block, note.text]

  return { ...stopped, block: reasons.join('\n\n') }
}

/**
 * Writes `line`, the line of a text sent to the model, to the transcript, each paragraph on rows of
 * its own. The terminal draws a row without its line breaks and only up to DRAWN_ROW_LENGTH
 * characters, so a paragraph has spaces in place of its line breaks, and a longer one goes on to
 * the next row.
 */
export function logSentLine($: EngineInterface, line: string): void {
  for (const paragraph of line.split(/\n\s*\n/u)) {
    for (const piece of paragraph.replace(/\s*\n\s*/gu, ' ').match(DRAWN_ROW_PIECE) ?? []) {
      $.ui.log(piece)
    }
  }
}

/** Submits the prompt `e` with `note` beside it, and tells whether the prompt entered with it. */
async function submitWithNote(
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  note: string,
): Promise<Delivery<PromptSubmitResult>> {
  const entered = await next({ ...e, context: [...(e.context ?? []), note] })

  return { result: entered, isAccepted: entered.context?.includes(note) === true }
}

/**
 * Submits the prompt `e` with the text of `note` beside it, writes the line of `note` once the
 * prompt entered with it, and tells whether it did.
 */
export async function submitWithNoteAndLine(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  note: TextWithLine,
): Promise<Delivery<PromptSubmitResult>> {
  const delivery = await submitWithNote(e, next, note.text)
  if (delivery.isAccepted) {
    logSentLine($, note.line)
  }

  return delivery
}

/**
 * Submits the prompt `e` as `submitWithNoteAndLine` does, and runs `restore` when the prompt
 * entered without the note or the submit failed.
 */
export function submitWithNoteAndLineOrRestore(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  note: TextWithLine,
  restore: () => Promise<void>,
): Promise<Delivery<PromptSubmitResult>> {
  return sendOrRestore(
    () => submitWithNoteAndLine($, e, next, note),
    ({ isAccepted }) => isAccepted,
    restore,
  )
}

/**
 * Submits `prompt` as a prompt of the plugin to the session `sessionId`. After /resume or /clear
 * switched to another session, the prompt would go to that session, so it is not submitted then.
 */
export async function submitToSession(
  $: EngineInterface,
  sessionId: string,
  prompt: PromptSubmitArgs,
): Promise<SubmittedPrompt> {
  if ((await $.session.id()) !== sessionId) {
    return { outcome: PromptOutcome.OtherSession }
  }
  const entered = await $.prompt.submit(prompt)

  return entered.drop === undefined
    ? { outcome: PromptOutcome.Entered }
    : { outcome: PromptOutcome.Dropped, reason: entered.drop }
}

/** Whether `submitted` entered its session. Only then did the prompt reach the model. */
export function isPromptEntered({ outcome }: SubmittedPrompt): boolean {
  return outcome === PromptOutcome.Entered
}

/**
 * Submits `prompt` as a prompt of the plugin to the session `sessionId`, runs `restore` when the
 * prompt did not enter or the submit failed, and returns what became of the prompt.
 */
export function submitToSessionOrRestore(
  $: EngineInterface,
  sessionId: string,
  prompt: PromptSubmitArgs,
  restore: () => Promise<void>,
): Promise<SubmittedPrompt> {
  return sendOrRestore(() => submitToSession($, sessionId, prompt), isPromptEntered, restore)
}

/** Runs `send`, and runs `restore` when `send` failed or `isSent` is false for its result. */
export async function sendOrRestore<T>(
  send: () => Promise<T>,
  isSent: (sent: T) => boolean,
  restore: () => Promise<void>,
): Promise<T> {
  const sent = await send().catch(async (error: unknown) => {
    await restore()
    throw error
  })
  if (!isSent(sent)) {
    await restore()
  }

  return sent
}
