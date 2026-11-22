import type {
  EngineInterface,
  Frozen,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { messageOf } from './errorMessage'
import { showFailure } from './failureToast'
import { isMessageTypedByUser } from './promptOrigin'
import { callToolWithNote, logSentLine, submitWithNoteAndLineOrRestore } from './sendToModel'
import type { NoteSource, TextWithLine } from './sendToModel'
import {
  canSubmitPluginPrompt,
  readCanSubmitPluginPrompt,
  readPluginPromptSituation,
} from './promptWaits'
import { SessionActivity } from './sessionState'
import { runDetached } from './timedWork'

/** Where the note for a pending text goes to the model. */
export enum PendingTextPlace {
  /** With a tool result, for a text that came while the turn ran. */
  ToolResult = 'tool result',
  /** Beside a prompt typed by the user, for a text that came before that prompt. */
  BesidePrompt = 'beside prompt',
}

// The engine runs a prompt from a plugin only once the session is idle, so a text submitted as a
// prompt during a long turn would reach the model only at the end of the turn.

/**
 * A feature that sends its texts to the main conversation with the next tool result of a turn, or
 * as a prompt while a prompt submitted by the plugin enters the session. Its note contains every
 * text waiting for the running session, and taking the note removes them. Only one of several
 * parallel calls returns a text, so the model reads it once. The line of the note goes to the
 * transcript once the note went to the model. A text submitted as a prompt shows in the chat as
 * that prompt.
 */
export type PendingTextSource = NoteSource<TextWithLine> & {
  /** Removes the texts waiting for the running session, and submits them as a prompt. */
  submit: () => Promise<void>
  /** The toast for a text added after a turn stopped by the user, while the text waits. */
  waitingAfterStopToast: string
  /**
   * The toast for a text added while no turn runs and the pane titled `paneTitle` makes the prompts
   * submitted by the plugin wait.
   */
  describeWaitingForPane: (paneTitle: string) => string
}

/** The note of the texts taken from a feature, and the function that puts those texts back. */
export type TakenNote = { note: TextWithLine; restore: () => Promise<void> }

/** A feature whose texts waiting for the running session go beside the next prompt of the user. */
export type PromptNoteSource = {
  /** Removes the texts waiting for the running session and returns their note, if any wait. */
  takeNoteBesidePrompt: () => Promise<TakenNote | undefined>
}

/**
 * Runs the tool call `e`, and appends the texts of `sources` as `callToolWithNote` does. A source
 * that fails shows its toast, and the texts of the other sources go with the result.
 */
export function callToolWithPendingTexts(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
  next: Next<'tool.call'>,
  sources: readonly NoteSource<TextWithLine>[],
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
    for (const note of taken) {
      logSentLine($, note.line)
    }

    return taken.length === 0 ? undefined : taken.map(note => note.text).join('\n\n')
  })
}

/**
 * Submits the prompt `e` with the notes of `sources` beside it, when the user typed it as a
 * message. Where the prompt enters without the notes, the texts go back to their sources.
 */
export function submitWithPendingTexts(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  sources: readonly PromptNoteSource[],
): Promise<PromptSubmitResult> {
  return isMessageTypedByUser(e) ? submitWithNotesBeside($, e, next, sources) : next(e)
}

export async function submitWithNotesBeside(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  sources: readonly PromptNoteSource[],
): Promise<PromptSubmitResult> {
  const notes = await Promise.all(sources.map(source => source.takeNoteBesidePrompt()))
  const taken = notes.filter(note => note !== undefined)
  if (taken.length === 0) {
    return next(e)
  }
  const note: TextWithLine = {
    text: taken.map(each => each.note.text).join('\n\n'),
    line: taken.map(each => each.note.line).join('\n\n'),
  }
  const delivery = await submitWithNoteAndLineOrRestore($, e, next, note, async () => {
    for (const each of taken) {
      await each.restore()
    }
  })

  return delivery.result
}

/**
 * Submits the waiting texts of each of `sources` as a prompt without waiting for it, while a prompt
 * submitted by the plugin enters the session. During a turn the texts wait for the next tool result
 * or the end of the turn. After a turn stopped by the user they wait for the next prompt of the
 * user, the next slash command typed by the user or the next tool result. While a pane that makes
 * the prompts submitted by the plugin wait is drawn, they wait for the next prompt of the user or
 * the close of that pane by the user. When
 * reading the state of the session or removing the texts fails, the texts wait the same way.
 */
export function submitPendingTexts(
  $: EngineInterface,
  sources: readonly PendingTextSource[],
): void {
  for (const source of sources) {
    runDetached(
      $,
      async () => {
        if (await readCanSubmitPluginPrompt($)) {
          await source.submit()
        }
      },
      source.describeNotSent,
    )
  }
}

/**
 * Submits the texts of `source`, to which a text was just added, as `submitPendingTexts` does.
 * After a turn stopped by the user, or while no turn runs and a pane makes the prompts submitted by
 * the plugin wait, a toast shows that the text waits.
 */
export function submitAddedText($: EngineInterface, source: PendingTextSource): void {
  runDetached(
    $,
    async () => {
      const situation = await readPluginPromptSituation($)
      if (canSubmitPluginPrompt(situation)) {
        await source.submit()
      } else if (situation.activity === SessionActivity.StoppedByUser) {
        $.ui.toast(source.waitingAfterStopToast)
      } else if (situation.activity === SessionActivity.Idle && situation.waitPane !== undefined) {
        $.ui.toast(source.describeWaitingForPane(situation.waitPane.title))
      }
    },
    source.describeNotSent,
  )
}
