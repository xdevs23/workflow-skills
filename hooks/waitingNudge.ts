import { atom, update } from 'claude-code'
import type { EngineInterface, Frozen, PromptSubmitInput, TurnCompleteInput } from 'claude-code'

import { isMainConversation } from './conversation'
import { messageOf } from './errorMessage'
import { isWaitingForAnswer } from './waitingPhrases'

export const NUDGE =
  "If you're waiting for an answer from the user, ensure you have first researched whether the " +
  'question is already answered by rules, instructions or older transcripts. Read around the ' +
  'context you find and do not trust markdown files in the project that paraphrase or take out ' +
  'of context what the user has said.'

// The engine lists the state a module reads and writes from the source of the module, so the
// reference is written here with its plugin and key as literals. The value is the id of a session,
// since the state may outlive a switch to another session by /clear or /resume.
const nudgeDueInSession = atom(
  { plugin: 'workflow-skills', key: 'nudgeDueInSession' } as const,
  null,
)

/**
 * Sets the nudge due for the session when a turn of the main conversation ended on a message that
 * waits for an answer, and clears it after any other end of such a turn. A message of a subagent
 * goes only to the session, so it changes nothing. A failure goes to the debug log.
 */
export async function setOrClearNudgeFromAnswer(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
): Promise<void> {
  if (!isMainConversation(e)) {
    return
  }
  const isWaiting = !e.isAborted && isWaitingForAnswer(e.answer)
  try {
    const dueIn = isWaiting ? await $.session.id() : null
    await update($, nudgeDueInSession, () => dueIn)
  } catch (error) {
    logNudgeFailure($, messageOf(error))
  }
}

/**
 * Returns the prompt with the nudge in its context when the nudge is due for this session, whatever
 * started the prompt, such as a scheduled check, and clears the nudge. A slash command does not
 * clear the nudge, since the text of a command may never reach the model. On a failure to read or
 * write the nudge, the prompt goes on without it, and the failure goes to the debug log.
 */
export async function withNudge(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
): Promise<Frozen<PromptSubmitInput>> {
  if (e.command !== undefined) {
    return e
  }
  try {
    const [sessionId, dueIn] = await Promise.all([$.session.id(), claimNudge($)])

    return dueIn === sessionId ? { ...e, context: [...(e.context ?? []), NUDGE] } : e
  } catch (error) {
    logNudgeFailure($, messageOf(error))

    return e
  }
}

/** Clears the nudge in one write, and returns the id of the session it was due for. */
async function claimNudge($: EngineInterface): Promise<string | null> {
  let claimed: string | null = null
  await update($, nudgeDueInSession, dueIn => {
    claimed = dueIn

    return null
  })

  return claimed
}

function logNudgeFailure($: EngineInterface, message: string): void {
  $.ui.log(`The reminder to look for the answer first failed: ${message}`, { to: 'debug' })
}
