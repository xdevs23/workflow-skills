import type {
  EngineInterface,
  Frozen,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { messageOf } from './errorMessage'
import { showFailure } from './failureToast'
import { isMessageTypedByUser } from './promptOrigin'
import { callToolWithNote, submitWithNoteOrRestore } from './sendToModel'
import type { NoteSource } from './sendToModel'
import { readSessionAcceptsPluginPrompts } from './sessionState'
import { runDetached } from './timedWork'
import { completeMainTurn } from './turnState'

// The engine runs a prompt from a plugin only once the session is idle, so a text submitted as a
// prompt during a long turn would reach the model only at the end of the turn.

/**
 * A feature that sends its texts to the main conversation with the next tool result of a turn, or
 * as a prompt while the session accepts prompts submitted by the plugin. Its note contains every
 * text waiting for the running session, and taking the note removes them. Only one of several
 * parallel calls returns a text, so the model reads it once.
 */
export type HeldTextSource = NoteSource<string> & {
  /** Removes the texts waiting for the running session, and submits them as a prompt. */
  submit: () => Promise<void>
}

/** The note of the texts taken from a feature, and the function that puts those texts back. */
export type TakenNote = { note: string; restore: () => Promise<void> }

/** A feature whose texts waiting for the running session go beside the next prompt of the user. */
export type PromptNoteSource = {
  /** Removes the texts waiting for the running session and returns their note, if any wait. */
  takeNoteBesidePrompt: () => Promise<TakenNote | undefined>
}

/**
 * Runs the tool call `e`, and appends the texts of `sources` as `callToolWithNote` does. A source
 * that fails shows its toast, and the texts of the other sources go with the result.
 */
export function callToolWithHeldTexts(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
  next: Next<'tool.call'>,
  sources: readonly HeldTextSource[],
): Promise<ToolCallResult> {
  return callToolWithNote(e, next, async () => {
    const notes = await Promise.all(
      sources.map(source =>
        source.takeNote().catch((error: unknown) => {
          showFailure($, source.describeNotSent(messageOf(error)))

          return undefined
        }),
      ),
    )
    const taken = notes.filter(note => note !== undefined)

    return taken.length === 0 ? undefined : taken.join('\n\n')
  })
}

/**
 * Submits the prompt `e` with the notes of `sources` beside it, when the user typed it as a
 * message. Where the prompt enters without the notes, the texts go back to their sources.
 */
export async function submitWithHeldTexts(
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  sources: readonly PromptNoteSource[],
): Promise<PromptSubmitResult> {
  if (!isMessageTypedByUser(e)) {
    return next(e)
  }
  const notes = await Promise.all(sources.map(source => source.takeNoteBesidePrompt()))
  const taken = notes.filter(note => note !== undefined)
  if (taken.length === 0) {
    return next(e)
  }
  const note = taken.map(each => each.note).join('\n\n')
  const delivery = await submitWithNoteOrRestore(e, next, note, async () => {
    for (const each of taken) {
      await each.restore()
    }
  })

  return delivery.result
}

/**
 * Submits the waiting texts of `source` as a prompt without waiting for it, while no turn runs and
 * the session accepts prompts submitted by the plugin. During a turn the texts wait for the next
 * tool result or the end of the turn. After a turn stopped by the user they wait for the next
 * prompt of the user or the next tool result. When reading the state of the session or removing
 * the texts fails, the texts wait the same way.
 */
export function submitWhileSessionAcceptsPrompts(
  $: EngineInterface,
  source: HeldTextSource,
): void {
  runDetached(
    $,
    async () => {
      if (await readSessionAcceptsPluginPrompts($)) {
        await source.submit()
      }
    },
    source.describeNotSent,
  )
}

/**
 * Runs the end of the turn `e` as `completeMainTurn` does, and then submits the texts of `sources`
 * still waiting as `submitWhileSessionAcceptsPrompts` does. A text added after the turn is marked
 * over is submitted at once, because the turn is over.
 */
export function completeTurnWithHeldTexts(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  sources: readonly HeldTextSource[],
): Promise<TurnCompleteResult> {
  return completeMainTurn($, e, next, async () => {
    for (const source of sources) {
      submitWhileSessionAcceptsPrompts($, source)
    }
  })
}
