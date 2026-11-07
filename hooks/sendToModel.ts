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

/** The result of a delivery, and whether the model received what was handed to it. */
export type Delivery<T> = { result: T; isAccepted: boolean }

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

/**
 * Runs the end of the turn `e`, and blocks it with the note made by `takeNote` from the last
 * message as the reason, so the main conversation goes back to work with the note. A block asked
 * by a hook beneath comes first in the reason. Only the first end of a turn is blocked: the engine
 * marks the next end of that turn as one that follows a block, and that end passes, so a turn that
 * finds nothing more to do can end. `takeNote` runs only for the first end of a turn of the main
 * conversation, on a message, where no hook beneath stopped the session.
 */
export async function stopWithNote(
  e: Frozen<Args<'classic.Stop'>>,
  next: Next<'classic.Stop'>,
  takeNote: (message: string) => Promise<string | undefined> | string | undefined,
): Promise<ClassicResultOf['classic.Stop']> {
  const stopped = await next(e)
  const message = e.last_assistant_message
  const followsBlock = e.stop_hook_active
  if (
    message === undefined ||
    followsBlock ||
    stopped.preventContinuation === true ||
    !isMainConversation({ agentId: e.agent_id })
  ) {
    return stopped
  }
  const note = await takeNote(message)
  if (note === undefined) {
    return stopped
  }
  const reasons = stopped.block === undefined ? [note] : [stopped.block, note]

  return { ...stopped, block: reasons.join('\n\n') }
}

/** Submits the prompt `e` with `note` beside it, and tells whether the prompt entered with it. */
export async function submitWithNote(
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  note: string,
): Promise<Delivery<PromptSubmitResult>> {
  const entered = await next({ ...e, context: [...(e.context ?? []), note] })

  return { result: entered, isAccepted: entered.context?.includes(note) === true }
}

/**
 * Submits the prompt `e` with `note` beside it, and runs `restore` when the prompt entered without
 * the note or the submit failed.
 */
export function submitWithNoteOrRestore(
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  note: string,
  restore: () => Promise<void>,
): Promise<Delivery<PromptSubmitResult>> {
  return sendOrRestore(() => submitWithNote(e, next, note), ({ isAccepted }) => isAccepted, restore)
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

/**
 * Submits `prompt` as a prompt of the plugin to the session `sessionId`, and runs `restore` when
 * the prompt did not enter or the submit failed.
 */
export async function submitToSessionOrRestore(
  $: EngineInterface,
  sessionId: string,
  prompt: PromptSubmitArgs,
  restore: () => Promise<void>,
): Promise<void> {
  await sendOrRestore(
    () => submitToSession($, sessionId, prompt),
    ({ outcome }) => outcome === PromptOutcome.Entered,
    restore,
  )
}

/** Runs `send`, and runs `restore` when `send` failed or `isSent` is false for its result. */
async function sendOrRestore<T>(
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
