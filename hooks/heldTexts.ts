import type {
  EngineInterface,
  Frozen,
  Next,
  ToolCallInput,
  ToolCallResult,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import { messageOf } from './errorMessage'
import { showFailure } from './failureToast'
import { callToolWithNote } from './sendToModel'
import type { NoteSource } from './sendToModel'
import { readIsTurnRunning } from './sessionState'
import { runDetached } from './timedWork'
import { completeMainTurn } from './turnState'

// The engine runs a prompt from a plugin only once the session is idle, so a text submitted as a
// prompt during a long turn would reach the model only at the end of the turn.

/**
 * A feature that sends its texts to the main conversation with the next tool result of a turn, or
 * as a prompt while no turn runs. Its note contains every text waiting for the running session, and
 * taking the note removes them. Only one of several parallel calls returns a text, so the model
 * reads it once.
 */
export type HeldTextSource = NoteSource<string> & {
  /** Removes the texts waiting for the running session, and submits them as a prompt. */
  submit: () => Promise<void>
  /** What becomes of the texts waiting at the end of a turn stopped by the user. */
  afterStoppedTurn: AfterStoppedTurn
}

/** What becomes of the texts of a feature waiting at the end of a turn stopped by the user. */
export enum AfterStoppedTurn {
  /** The texts go with the next prompt of the user or the next tool result. */
  WaitForPrompt = 'wait for prompt',
  /** The texts go as a prompt once the session is idle. */
  Submit = 'submit',
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
 * Submits the waiting texts of `source` as a prompt without waiting for it, while no turn runs.
 * During a turn the texts wait for the next tool result or the end of the turn. When reading
 * whether a turn runs or removing the texts fails, the texts wait the same way.
 */
export function submitWhileNoTurnRuns($: EngineInterface, source: HeldTextSource): void {
  runDetached(
    $,
    async () => {
      if (!(await readIsTurnRunning($))) {
        await source.submit()
      }
    },
    source.describeNotSent,
  )
}

/**
 * Runs the end of the turn `e` as `completeMainTurn` does, and then submits the texts of `sources`
 * still waiting. A text added after the turn is marked over is submitted at once, because the turn
 * is over.
 */
export function completeTurnWithHeldTexts(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  sources: readonly HeldTextSource[],
): Promise<TurnCompleteResult> {
  return completeMainTurn($, e, next, async () => {
    for (const source of sources) {
      if (!e.isAborted || source.afterStoppedTurn === AfterStoppedTurn.Submit) {
        runDetached($, source.submit, source.describeNotSent)
      }
    }
  })
}
