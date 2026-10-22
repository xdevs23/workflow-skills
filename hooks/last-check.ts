import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { RunningWorkflow } from '../types'

const lastState = atom({ plugin: 'workflow-skills', key: 'ruleCheckerLastState' } as const, null)

// The text of TODO.md, or null without one, and the ids of the running workflows, sorted, so a
// different order of the same workflows is no change.
export const stateOf = (todo: string | null, running: readonly RunningWorkflow[]): string =>
  JSON.stringify({ todo, workflows: running.map(workflow => workflow.id).sort() })

// TODO.md is sent only while no workflow runs, and only when TODO.md or the running workflows
// changed since the last successful check, so work waiting in an unchanged TODO.md is reported once.
export async function sendsTodo(
  $: EngineInterface,
  state: string,
  running: readonly RunningWorkflow[],
): Promise<boolean> {
  return running.length === 0 && (await read($, lastState)) !== state
}

export function recordState($: EngineInterface, state: string) {
  return update($, lastState, () => state)
}
