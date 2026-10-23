import { atom, read, update } from 'claude-code'
import type { BackgroundTaskSummary, EngineInterface, SessionCronSummary } from 'claude-code'

import type { BackgroundIds, RunningWorkflow, WaitingTask } from '../types'

// The background work of the session at a stop: its tasks in flight and its scheduled wakeups.
type InFlight = {
  tasks: readonly BackgroundTaskSummary[]
  crons: readonly SessionCronSummary[]
}

const NONE: BackgroundIds = { tasks: [], crons: [] }

// The ids of the background work at the last stop, and at the start of the current turn, which a
// new turn takes from the last stop. Work already in flight before the first stop of the session
// counts as started by the current turn.
const atLastStop = atom(
  { plugin: 'workflow-skills', key: 'ruleCheckerIdsAtLastStop' } as const,
  NONE,
)
const atTurnStart = atom(
  { plugin: 'workflow-skills', key: 'ruleCheckerIdsAtTurnStart' } as const,
  NONE,
)

const WAKEUP = 'wakeup'

const isWorkflow = (task: BackgroundTaskSummary) => task.type === 'workflow'

const isNotIn =
  (ids: readonly string[]) =>
  ({ id }: { id: string }) =>
    !ids.includes(id)

// The workflows in flight, and the other tasks and the wakeups started by the current turn.
export async function backgroundOf(
  $: EngineInterface,
  { tasks, crons }: InFlight,
): Promise<{ running: RunningWorkflow[]; waiting: WaitingTask[] }> {
  const before = await read($, atTurnStart)
  const started = tasks
    .filter(task => !isWorkflow(task))
    .filter(isNotIn(before.tasks))
    .map(task => ({ kind: task.type, description: task.description }))
  const wakeups = crons
    .filter(isNotIn(before.crons))
    .map(cron => ({ kind: WAKEUP, description: cron.prompt }))

  return {
    running: tasks
      .filter(isWorkflow)
      .map(({ id, name, description }) => ({ id, name, description })),
    waiting: [...started, ...wakeups],
  }
}

export function recordStop($: EngineInterface, { tasks, crons }: InFlight) {
  const ids = { tasks: tasks.map(task => task.id), crons: crons.map(cron => cron.id) }

  return update($, atLastStop, () => ids)
}

export async function clearBackground($: EngineInterface) {
  await update($, atLastStop, () => NONE)
  await update($, atTurnStart, () => NONE)
}

export async function startTurn($: EngineInterface) {
  const ids = await read($, atLastStop)
  await update($, atTurnStart, () => ids)
}
