import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  MatchedHook,
  SessionMessage,
  ToolResultSummary,
  ToolUseSummary,
} from 'claude-code'

import { replacesMainConversation } from '../compactionTrigger'
import { isMainConversation } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { ofRunningSession, updateOfSession } from '../sessionBoundState'

const forkView = atom({ plugin: 'workflow-skills', key: 'forkView' } as const, null)

// `$.session.messages()` returns the newest 4096 rows, as its type in Claude Code 2.1.325 states.
// In a longer transcript, a count of rows no longer points at the same row.
export const ROW_LIMIT = 4096

/**
 * How many rows of `$.session.messages()` of the main conversation of the session `sessionId` a
 * fork made from it sees.
 */
export type ForkView = { readonly sessionId: string; readonly rowCount: number }

/** Why the messages that a fork does not see are unknown. */
export enum ForkViewUnknown {
  NotRecorded = 'not recorded',
  TranscriptShortened = 'transcript shortened',
  PastRowLimit = 'past row limit',
}

/**
 * A message of a conversation as its model read it: the text, the tool calls and the text
 * of each tool result, without the records that the tools stored.
 */
export type MessageAsRead = {
  readonly role: SessionMessage['role']
  readonly text: string
  readonly toolUses: readonly Pick<ToolUseSummary, 'tool_use_id' | 'tool' | 'input'>[]
  readonly toolResults: readonly Pick<ToolResultSummary, 'tool_use_id' | 'text' | 'isError'>[]
}

/** The messages of the main conversation that a fork does not see, or why they are unknown. */
export type MessagesUnseenByFork =
  | { readonly isKnown: true; readonly messages: readonly MessageAsRead[] }
  | { readonly isKnown: false; readonly cause: ForkViewUnknown }

/**
 * Sets the view of a fork to every row of the main conversation once a step of it gets a response.
 * In a test session with Claude Code 2.1.325 on 2026-11-19, the rows read after such a step ended
 * on its answer, and a fork made after an interrupted request lacked every row after the last step
 * with a response: the interrupted prompt, the cut-off reply and the interrupt.
 */
export const recordForkView: MatchedHook<'turn.step', EveryEvent> = async function* ($, e, next) {
  const response = yield* next(e)
  if (isMainConversation(e) && response.stopReason !== null) {
    const sessionId = await $.session.id()
    const view = { sessionId, rowCount: (await $.session.messages()).length }
    await changeForkView($, sessionId, () => view)
  }

  return response
}

/**
 * Forgets the view of a fork once a compaction replaced the main conversation, since the rows then
 * begin with the summary.
 */
export const forgetForkViewOnCompaction: MatchedHook<'session.compact', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const compacted = await next(e)
  if (compacted.skip === undefined && replacesMainConversation(e)) {
    await changeForkView($, await $.session.id(), () => null)
  }

  return compacted
}

/**
 * The messages of the main conversation that a fork made from it does not see, oldest first. Each
 * step with a response moves the view, so these are only the messages after the last answer, such
 * as an interrupted prompt and its cut-off reply. Empty where the fork sees the newest message.
 */
export async function readMessagesUnseenByFork($: EngineInterface): Promise<MessagesUnseenByFork> {
  const view = await ofRunningSession($, await read($, forkView))
  if (view === null) {
    return { isKnown: false, cause: ForkViewUnknown.NotRecorded }
  }
  const rows = await $.session.messages()
  if (rows.length < view.rowCount) {
    return { isKnown: false, cause: ForkViewUnknown.TranscriptShortened }
  }
  if (rows.length >= ROW_LIMIT) {
    return { isKnown: false, cause: ForkViewUnknown.PastRowLimit }
  }

  return { isKnown: true, messages: rows.slice(view.rowCount).map(readAsModelRead) }
}

/** Replaces the view of a fork in the session `sessionId` with what `change` makes of it. */
async function changeForkView(
  $: EngineInterface,
  sessionId: string,
  change: (own: ForkView | null) => ForkView | null,
): Promise<void> {
  await updateOfSession($, sessionId, change, changeInState => update($, forkView, changeInState))
}

function readAsModelRead(message: SessionMessage): MessageAsRead {
  return {
    role: message.role,
    text: message.text,
    toolUses: message.toolUses.map(use => ({
      tool_use_id: use.tool_use_id,
      tool: use.tool,
      input: use.input,
    })),
    toolResults: (message.toolResults ?? []).map(result => ({
      tool_use_id: result.tool_use_id,
      text: result.text,
      isError: result.isError,
    })),
  }
}
