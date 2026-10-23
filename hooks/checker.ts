import type { EngineInterface, ModelTextBlock } from 'claude-code'

import type { RuleCheckerSettings, RunningWorkflow, WaitingTask } from '../types'
import { deliver } from './delivery.ts'
import { recordState, sendsTodo, stateOf } from './last-check.ts'
import { noteFailure, noteRetry } from './note.ts'
import { pieceOf } from './piece.ts'
import { removeSent, takePrompts } from './prompts.ts'
import { ask, thrownFailure } from './reply.ts'
import { fixedSystem, systemOf } from './rules.ts'
import { lastSent, recordSent } from './sent-findings.ts'

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

// The fixed part of the system prompt as last read, and the list of skills it was read for.
type FixedSystem = { skills: readonly string[]; blocks: Promise<ModelTextBlock[]> }

// The fixed part of the system prompt of the checks of one loaded module, read again only when the
// list of skills changes, or after a read that failed.
export type FixedSystemCache = { last: FixedSystem | null }

// The settings of a check, and the cache of its fixed system prompt.
type Checks = { settings: RuleCheckerSettings; cache: FixedSystemCache }

export const fixedSystemCache = (): FixedSystemCache => ({ last: null })

const isSameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index])

async function cachedFixedSystem(
  cache: FixedSystemCache,
  $: EngineInterface,
  skills: readonly string[],
): Promise<ModelTextBlock[]> {
  if (cache.last !== null && isSameList(cache.last.skills, skills)) return cache.last.blocks
  const blocks = fixedSystem($, skills)
  cache.last = { skills, blocks }
  try {
    return await blocks
  } catch (error) {
    if (cache.last?.blocks === blocks) cache.last = null
    throw error
  }
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
  const { settings, cache } = checks
  const request = {
    model: settings.model,
    system: await systemOf($, await cachedFixedSystem(cache, $, settings.skills)),
    prompt: pieceOf({ final, user: prompts, running, waiting, sent: await lastSent($), todo }),
  }
  const answer = await ask($, request, { signal, canWait, onRetry: error => noteRetry($, error) })
  await noteRetry($, null)
  switch (answer.kind) {
    case 'findings':
      await deliver($, answer.findings)
      await recordSent($, answer.findings)
      await removeSent($, upTo)
      return true
    case 'failed':
      await noteFailure($, answer.reason)
      return false
    case 'aborted':
      return false
  }
}
