import { atom, update } from 'claude-code'
import type { EngineInterface, Frozen, PromptSubmitInput, TurnCompleteInput } from 'claude-code'

import type { DueHints } from '../types'
import { isMainConversation } from './conversation'
import { messageOf } from './errorMessage'
import { kindIdsWithPhraseIn, textsOfKinds } from './hintKinds'

// The engine lists the state a module reads and writes from the source of the module, so the
// reference is written here with its plugin and key as literals. The hints contain the id of a
// session, since the state may outlive a switch to another session by /clear or /resume.
const dueHints = atom({ plugin: 'workflow-skills', key: 'dueHints' } as const, null)

/**
 * Marks every kind of hint with a phrase in the message that ended a turn of the main conversation
 * as due for the session, and clears the hints after any other end of such a turn. A message of a
 * subagent goes only to the session, so it changes nothing. A failure goes to the debug log.
 */
export async function setDueHintsFromAnswer(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
): Promise<void> {
  if (!isMainConversation(e)) {
    return
  }
  const dueKindIds = e.isAborted ? [] : kindIdsWithPhraseIn(e.answer)
  try {
    const due = dueKindIds.length === 0 ? null : { sessionId: await $.session.id(), dueKindIds }
    await update($, dueHints, () => due)
  } catch (error) {
    logHintFailure($, messageOf(error))
  }
}

/**
 * Returns the prompt with the text of every hint due for this session in its context, whatever
 * started the prompt, such as a scheduled check, and clears the hints. A slash command does not
 * clear them, since the text of a command may never reach the model. On a failure to read or write
 * the hints, the prompt goes on without them, and the failure goes to the debug log.
 */
export async function withDueHints(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
): Promise<Frozen<PromptSubmitInput>> {
  if (e.command !== undefined) {
    return e
  }
  try {
    const [sessionId, due] = await Promise.all([$.session.id(), claimDueHints($)])
    const texts = due?.sessionId === sessionId ? textsOfKinds(due.dueKindIds) : []

    return texts.length === 0 ? e : { ...e, context: [...(e.context ?? []), ...texts] }
  } catch (error) {
    logHintFailure($, messageOf(error))

    return e
  }
}

/** Clears the due hints in one write, and returns them. */
async function claimDueHints($: EngineInterface): Promise<DueHints | null> {
  let claimed: DueHints | null = null
  await update($, dueHints, due => {
    claimed = due

    return null
  })

  return claimed
}

function logHintFailure($: EngineInterface, message: string): void {
  $.ui.log(`The hints for the next prompt failed: ${message}`, { to: 'debug' })
}
