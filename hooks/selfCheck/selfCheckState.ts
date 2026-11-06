import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SelfCheckSchedule } from '../../types'
import { ofSession, updateOfSession } from '../sessionBoundState'

/**
 * How long the user sends no message before the main conversation is told to check the work
 * delivered by it, and again after each further interval of that length: a product choice.
 */
const CHECK_INTERVAL_HOURS = 4

const MILLISECONDS_PER_HOUR = 3_600_000

const CHECK_INTERVAL = CHECK_INTERVAL_HOURS * MILLISECONDS_PER_HOUR

// The engine lists the state read and written by a module from the source of the module, so the
// state reference of the schedule is written in this file with its plugin and key as literals.
const selfCheckSchedule = atom(
  { plugin: 'workflow-skills', key: 'selfCheckSchedule' } as const,
  null,
)

/** A due time taken for sending: the schedule with that due time, and the one that replaces it. */
export type TakenDueTime = { due: SelfCheckSchedule; next: SelfCheckSchedule }

/** The self-check schedule of the main conversation of the session `sessionId`, if it has one. */
export async function readSelfCheckSchedule(
  $: EngineInterface,
  sessionId: string,
): Promise<SelfCheckSchedule | null> {
  return ofSession(await read($, selfCheckSchedule), sessionId)
}

/**
 * Starts the self-check schedule of the session `sessionId` at the message typed by the user at
 * `typedAt`, and returns the schedule in the state after it.
 */
export function startScheduleAt(
  $: EngineInterface,
  sessionId: string,
  typedAt: number,
): Promise<SelfCheckSchedule | null> {
  return updateSelfCheckSchedule($, sessionId, () => ({
    sessionId,
    dueAt: typedAt + CHECK_INTERVAL,
  }))
}

/**
 * Moves the self-check schedule of the session `sessionId` to the next due time when the
 * self-check is due, and returns the due time taken. One update does both, so only one of several
 * parallel prompts sends the self-check.
 */
export async function takeDueTime(
  $: EngineInterface,
  sessionId: string,
): Promise<TakenDueTime | undefined> {
  const now = await $.clock.now()
  if (!isDue(await readSelfCheckSchedule($, sessionId), now)) {
    return undefined
  }
  let taken: TakenDueTime | undefined = undefined
  await updateSelfCheckSchedule($, sessionId, schedule => {
    if (!isDue(schedule, now)) {
      taken = undefined

      return schedule
    }
    const next = { ...schedule, dueAt: firstDueTimeAfter(schedule.dueAt, now) }
    taken = { due: schedule, next }

    return next
  })

  return taken
}

/**
 * Puts back the due time of `taken`, after the self-check was not sent, while no message of the
 * user started the schedule again since.
 */
export async function restoreDueTime($: EngineInterface, taken: TakenDueTime): Promise<void> {
  await updateSelfCheckSchedule($, taken.due.sessionId, schedule =>
    schedule?.dueAt === taken.next.dueAt ? taken.due : schedule,
  )
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

/**
 * The first due time after `now`, of the due times every CHECK_INTERVAL from `dueAt` on. A session
 * that is idle through several due times is sent the self-check once.
 */
function firstDueTimeAfter(dueAt: number, now: number): number {
  return dueAt + (Math.floor((now - dueAt) / CHECK_INTERVAL) + 1) * CHECK_INTERVAL
}
