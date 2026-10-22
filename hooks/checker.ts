import type { EngineInterface, ModelTextBlock } from 'claude-code'

import type { RunningWorkflow, WaitingTask } from '../types'
import { deliver } from './delivery.ts'
import { recordState, sendsTodo, stateOf } from './last-check.ts'
import { noteFailure, noteRetry } from './note.ts'
import { pieceOf } from './piece.ts'
import { removeSent, takePrompts } from './prompts.ts'
import { ask, thrownFailure } from './reply.ts'
import { fixedSystem, systemOf } from './rules.ts'

// The end of a turn: the final message of the agent and the text of TODO.md, each null without
// one, the running workflows, and the other background tasks and wakeups started by the turn.
type Run = {
  final: string | null
  todo: string | null
  running: readonly RunningWorkflow[]
  waiting: readonly WaitingTask[]
  signal?: AbortSignal
  canWait: (ms: number) => boolean
}

// The checks of one loaded module.
type Checks = {
  readonly model: string
  readonly skills: readonly string[]
  fixed?: Promise<ModelTextBlock[]>
}

// Checks the end of a turn. A check succeeds when a reply decoded to a list of findings, or when it
// has nothing to send: no final message and no TODO.md to send. Only a successful check records the
// state of TODO.md and the running workflows, so a TODO.md that a failed check did not get is sent
// by the next one.
export async function checkAtEnd(checks: Checks, $: EngineInterface, run: Run): Promise<void> {
  try {
    const state = stateOf(run.todo, run.running)
    const todo = (await sendsTodo($, state, run.running)) ? run.todo : null
    const isChecked =
      (run.final === null && todo === null) || (await sendCheck(checks, $, run, todo))
    if (isChecked) await recordState($, state)
  } catch (error) {
    await noteFailure($, thrownFailure(error))
  }
}

// Sends one check and delivers its findings. The prompts of the user are removed only once a reply
// decoded to a list of findings, so a failed check leaves them to the next one. Returns whether the
// reply decoded.
async function sendCheck(
  checks: Checks,
  $: EngineInterface,
  { final, running, waiting, signal, canWait }: Run,
  todo: string | null,
): Promise<boolean> {
  const { prompts, upTo } = await takePrompts($)
  checks.fixed ??= fixedSystem($, checks.skills)
  const request = {
    model: checks.model,
    system: await systemOf($, await checks.fixed),
    prompt: pieceOf({ final, user: prompts, running, waiting, todo }),
  }
  const answer = await ask($, request, { signal, canWait, onRetry: error => noteRetry($, error) })
  await noteRetry($, null)
  switch (answer.kind) {
    case 'findings':
      await deliver($, answer.findings)
      await removeSent($, upTo)
      return true
    case 'failed':
      await noteFailure($, answer.reason)
      return false
    case 'aborted':
      return false
  }
}
