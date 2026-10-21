import type { EngineInterface, ModelTextBlock } from 'claude-code'

import { deliver } from './delivery.ts'
import { noteFailure, noteRetry } from './note.ts'
import { pieceOf } from './piece.ts'
import type { TurnEnd } from './piece.ts'
import { ask, thrownFailure } from './reply.ts'
import { fixedSystem, systemOf } from './rules.ts'
import { removeSent, takeWork } from './work.ts'

type Run = { end?: TurnEnd; signal?: AbortSignal; canWait: (ms: number) => boolean }

// The checks of one loaded module. At most one runs beside the turn at a time, so a check never
// sends work another one is sending, and the check at the end of a turn replaces them.
type Checks = {
  readonly model: string
  readonly skills: readonly string[]
  fixed?: Promise<ModelTextBlock[]>
  queue: Promise<void>
  // The number of turns ended so far, so a check queued before the last end is dropped.
  turn: number
  beside?: AbortController
}

export const checksOf = (model: string, skills: readonly string[]): Checks => ({
  model,
  skills,
  queue: Promise.resolve(),
  turn: 0,
})

// Checks the work collected since the last successful check. The work stays collected until a
// reply decoded to a list of findings, so a failed check leaves it for the next one.
async function run(
  checks: Checks,
  $: EngineInterface,
  { end, signal, canWait }: Run,
): Promise<void> {
  try {
    const { entries, upTo } = await takeWork($)
    if (entries.length === 0 && (end?.todo ?? null) === null) return
    checks.fixed ??= fixedSystem($, checks.skills)
    const request = {
      model: checks.model,
      system: await systemOf($, await checks.fixed),
      prompt: pieceOf(entries, end),
    }
    const answer = await ask($, request, { signal, canWait, onRetry: error => noteRetry($, error) })
    await noteRetry($, null)
    switch (answer.kind) {
      case 'findings':
        await deliver($, answer.findings)
        await removeSent($, upTo)
        return
      case 'failed':
        await noteFailure($, answer.reason)
        return
      case 'aborted':
        return
    }
  } catch (error) {
    await noteFailure($, thrownFailure(error))
  }
}

// Queues a check beside the turn: the agent keeps working and reads the findings at the step after
// they arrive.
export function checkBeside(checks: Checks, $: EngineInterface): void {
  const queuedIn = checks.turn
  $.clock.after(0, () => {
    checks.queue = checks.queue
      .then(async () => {
        if (queuedIn !== checks.turn) return
        checks.beside = new AbortController()
        await run(checks, $, { signal: checks.beside.signal, canWait: () => true })
        checks.beside = undefined
      })
      .catch(error => $.ui.log(`rule checker: ${String(error)}`, { to: 'debug' }))
  })
}

// Checks at the end of a turn, in place of the checks beside it: the running one is aborted, the
// queued ones are dropped, and this check sends the work they leave.
export async function checkAtEnd(
  checks: Checks,
  $: EngineInterface,
  check: Run & { end: TurnEnd },
): Promise<void> {
  checks.turn += 1
  checks.beside?.abort()
  await run(checks, $, check)
}
