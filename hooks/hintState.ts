import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, MatchedHook, SessionAppendMessage } from 'claude-code'

import type { HintKindsSentInTurn } from '../types'
import { isMainConversation } from './conversation'
import type { HintKind } from './hintKind'
import type { TextWithLine } from './sendToModel'
import { ofSession, updateOfSession } from './sessionBoundState'

const hintKindsSentInTurn = atom(
  { plugin: 'workflow-skills', key: 'hintKindsSentInTurn' } as const,
  null,
)

/**
 * The rows that hand the model the reason of a Stop block. Claude Code 2.1.325 stores the reason
 * as a user row "Stop hook feedback: ..." with the door `note` and the origin `engine`, as a
 * session that logged every row showed on 2026-11-20. The engine types give a row appended by a
 * plugin the door `note` with that plugin as origin, so the origin leaves those rows out.
 */
export const STOP_BLOCK_REASON = { door: 'note', origin: { kind: 'engine' } } as const

/**
 * Makes with `describeNote` the note on the kinds in `kinds` not yet sent in the running turn of
 * the main conversation, and sets it in the state as offered until the model receives it. Returns
 * undefined without a note or when another session runs by now. The turn.complete hook "Fires when
 * a model turn has ended", in the doc of the engine types, and markOfferedHintKindsSent runs once
 * the conversation stores the reason of a Stop block. "`Stop` and `SubagentStop` hooks can
 * control whether Claude continues" (https://code.claude.com/docs/en/hooks#stop-decision-control,
 * checked 2026-11-20), so both run only after the Stop hooks returned, and the state does not
 * change between the read and the update.
 */
export async function offerNoteOnKindsUnsentInTurn(
  $: EngineInterface,
  kinds: readonly HintKind[],
  describeNote: (unsent: readonly HintKind[]) => Promise<TextWithLine | undefined>,
): Promise<TextWithLine | undefined> {
  const sessionId = await $.session.id()
  const sent = ofSession(await read($, hintKindsSentInTurn), sessionId)?.names ?? []
  const unsent = kinds.filter(kind => !sent.includes(kind.name))
  const note = await describeNote(unsent)
  if (note === undefined) {
    return undefined
  }
  const offered = { names: unsent.map(kind => kind.name), text: note.text }
  const recorded = await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: own?.names ?? [], offered }),
    change => update($, hintKindsSentInTurn, change),
  )

  return recorded === null ? undefined : note
}

/**
 * Counts the kinds of the hint note offered in the turn as sent once the main conversation stores
 * the row `e` with the note. When a hook above drops the note from the row, the kinds of the note
 * do not count as sent.
 */
export const markOfferedHintKindsSent: MatchedHook<
  'session.append',
  typeof STOP_BLOCK_REASON
> = async ($, e, next) => {
  const stored = await next(e)
  if (isMainConversation(e) && stored.deny === undefined) {
    await markOfferedKindsSentWhenNoteIn($, textOfRow(stored.message))
  }

  return stored
}

/** The text blocks of `row`, joined. */
function textOfRow(row: SessionAppendMessage): string {
  return row.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('\n')
}

/** Counts the kinds of the hint note offered in the turn as sent when `text` contains the note. */
async function markOfferedKindsSentWhenNoteIn($: EngineInterface, text: string): Promise<void> {
  const sessionId = await $.session.id()
  const offered = ofSession(await read($, hintKindsSentInTurn), sessionId)?.offered ?? null
  if (offered === null || !text.includes(offered.text)) {
    return
  }
  await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: [...(own?.names ?? []), ...offered.names], offered: null }),
    change => update($, hintKindsSentInTurn, change),
  )
}

/** Clears the hint kinds sent in the turn of the main conversation that `e` ends, if any. */
export const forgetHintKindsSentInTurn: Hook<'turn.complete'> = async ($, e, next) => {
  if (isMainConversation(e) && (await read($, hintKindsSentInTurn)) !== null) {
    await update($, hintKindsSentInTurn, () => null)
  }

  return next(e)
}
