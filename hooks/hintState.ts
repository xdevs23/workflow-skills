import { atom, read, update } from 'claude-code'
import type { EngineInterface, Hook, MatchedHook, SessionAppendMessage } from 'claude-code'

import type { HintKindsSentInTurn } from '../types'
import { isMainConversation } from './conversation'
import { isRoastedHintKind, namesOfHintKinds } from './hintKind'
import type { HintKind, HintKindName, RoastedHintKind } from './hintKind'
import type { TextWithLine } from './sendToModel'
import { ofSession, updateOfSession } from './sessionBoundState'

// A change of HintKindsSentInTurn or of the names of the hint kinds changes the tag, so the kinds
// written by another version of the plugin read as absent.
const hintKindsSentInTurn = atom(
  { plugin: 'workflow-skills', key: 'hintKindsSentInTurn' } as const,
  null,
  { shape: 'hint-kind-names-with-offered-note' },
)

/**
 * The rows that hand the model the reason of a Stop block. Claude Code 2.1.325 stores the reason
 * as a user row "Stop hook feedback: ..." with the door `note` and the origin `engine`, as a
 * session that logged every row showed on 2026-11-20. The engine types give a row appended by a
 * plugin the door `note` with that plugin as origin, so the origin leaves those rows out.
 */
export const STOP_BLOCK_REASON = { door: 'note', origin: { kind: 'engine' } } as const

/**
 * The hint kinds of an end of a turn not yet sent in the turn: the roasted kinds, which count as
 * sent, and the note on the others, offered until the model receives it, if there are any.
 */
export type ClaimedHintKinds = {
  roasted: readonly RoastedHintKind[]
  note: TextWithLine | undefined
}

const NOTHING_CLAIMED: ClaimedHintKinds = { roasted: [], note: undefined }

/**
 * Claims the kinds in `kinds` not yet sent in the running turn of the main conversation. Counts the
 * roasted ones as sent, and sets the note made by `describeNote` on the others in the state as
 * offered until the model receives it. Returns them, or no kinds where every kind was sent or
 * another session runs by now.
 * The turn.complete hook "Fires when a model turn has ended", in the doc of the engine types, and
 * markOfferedHintKindsSent runs once the conversation stores the reason of a Stop block. "`Stop`
 * and `SubagentStop` hooks can control whether Claude continues"
 * (https://code.claude.com/docs/en/hooks#stop-decision-control, checked 2026-11-20), so both run
 * only after the Stop hooks returned, and the state does not change between the read and the
 * update.
 */
export async function claimHintKindsUnsentInTurn(
  $: EngineInterface,
  kinds: readonly HintKind[],
  describeNote: (fixed: readonly HintKind[]) => TextWithLine,
): Promise<ClaimedHintKinds> {
  const sessionId = await $.session.id()
  const sent = ofSession(await read($, hintKindsSentInTurn), sessionId)?.names ?? []
  const unsent = kinds.filter(kind => !sent.includes(kind.name))
  if (unsent.length === 0) {
    return NOTHING_CLAIMED
  }
  const roasted = unsent.filter(isRoastedHintKind)
  const fixed = unsent.filter(kind => !isRoastedHintKind(kind))
  const note = fixed.length === 0 ? undefined : describeNote(fixed)
  const offered = note === undefined ? null : { names: namesOfHintKinds(fixed), text: note.text }
  const recorded = await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: [...(own?.names ?? []), ...namesOfHintKinds(roasted)], offered }),
    change => update($, hintKindsSentInTurn, change),
  )

  return recorded === null ? NOTHING_CLAIMED : { roasted, note }
}

/**
 * Counts the hint kinds `names` as sent in the turn of the main conversation of the session
 * `sessionId` that receives a hint note on them: the running turn, or the turn that a prompt
 * submitted next starts. The kinds sent in a turn are cleared before the session counts as idle,
 * so the kinds counted for a prompt submitted while idle last through the turn of that prompt.
 */
export async function markHintKindsSentInTurn(
  $: EngineInterface,
  sessionId: string,
  names: readonly HintKindName[],
): Promise<void> {
  await updateOfSession<HintKindsSentInTurn>(
    $,
    sessionId,
    own => ({ sessionId, names: [...(own?.names ?? []), ...names], offered: own?.offered ?? null }),
    change => update($, hintKindsSentInTurn, change),
  )
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
