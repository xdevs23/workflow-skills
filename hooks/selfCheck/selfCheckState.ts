import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SelfCheckSchedule } from '../../types'
import { ofSession, updateOfSession } from '../sessionBoundState'
import { MILLISECONDS_PER_HOUR } from '../timeUnits'

/**
 * How long the user sends no message before a fork roasts the work delivered by the main
 * conversation, and again after each roast sent: a product choice.
 */
const CHECK_INTERVAL_HOURS = 4

const CHECK_INTERVAL = CHECK_INTERVAL_HOURS * MILLISECONDS_PER_HOUR

// The engine lists the state read and written by a module from the source of the module, so the
// state reference of the schedule is written in this file with its plugin and key as literals.
const selfCheckSchedule = atom(
  { plugin: 'workflow-skills', key: 'selfCheckSchedule' } as const,
  null,
)

/** The self-check schedule of the main conversation of the session `sessionId`, if it has one. */
export async function readSelfCheckSchedule(
  $: EngineInterface,
  sessionId: string,
): Promise<SelfCheckSchedule | null> {
  return ofSession(await read($, selfCheckSchedule), sessionId)
}

/**
 * Starts the self-check schedule of the session `sessionId` at `startedAt`, the time of a message
 * typed by the user or of a self-check roast sent, and returns the schedule in the state after it.
 */
export function startScheduleAt(
  $: EngineInterface,
  sessionId: string,
  startedAt: number,
): Promise<SelfCheckSchedule | null> {
  return updateSelfCheckSchedule($, sessionId, () => ({
    sessionId,
    dueAt: startedAt + CHECK_INTERVAL,
  }))
}

/**
 * Ends the self-check schedule of the session `sessionId` when the self-check is due, and returns
 * the due schedule. One update does both, so only one of several callers roasts.
 */
export async function takeDueSchedule(
  $: EngineInterface,
  sessionId: string,
): Promise<SelfCheckSchedule | undefined> {
  const now = await $.clock.now()
  if (!isDue(await readSelfCheckSchedule($, sessionId), now)) {
    return undefined
  }
  let taken: SelfCheckSchedule | undefined = undefined
  await updateSelfCheckSchedule($, sessionId, schedule => {
    // A retried write runs this again, and its last run decides.
    taken = isDue(schedule, now) ? schedule : undefined

    return taken === undefined ? schedule : null
  })

  return taken
}

/**
 * Replaces the self-check schedule of the session `sessionId` with what `change` makes of it,
 * unless another session runs by now, and returns the schedule of that session in the state after
 * it. `change` is called with null when the session has no schedule, and the schedule of another
 * session is left in the state while `change` returns null.
 */
function updateSelfCheckSchedule(
  $: EngineInterface,
  sessionId: string,
  change: (schedule: SelfCheckSchedule | null) => SelfCheckSchedule | null,
): Promise<SelfCheckSchedule | null> {
  return updateOfSession($, sessionId, change, changeInState =>
    update($, selfCheckSchedule, changeInState),
  )
}

function isDue(schedule: SelfCheckSchedule | null, now: number): schedule is SelfCheckSchedule {
  return schedule !== null && schedule.dueAt <= now
}
