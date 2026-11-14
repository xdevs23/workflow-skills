import { atom, read, update } from 'claude-code'
import type { EngineInterface, MatchedHook, On, Timer } from 'claude-code'

import type { Reminder, TimedRemindersHandled } from '../../types'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { callToolWithNote, submitToSessionOrRestore } from '../sendToModel'
import { ofSession, updateOfSession } from '../sessionBoundState'
import { SWITCHING_SOURCES } from '../sessionSources'
import { readIsTurnRunning } from '../sessionState'
import { firstDueTimeAfter, runAfter, waitAgainAfterTurn } from '../timedWork'
import { describeReminderNote, enabledRemindersOf, readEnabledReminders } from './reminderDelivery'
import type { ReminderOfKind } from './reminderDelivery'
import { setNextSends } from './reminderState'
import { TIME_KIND, intervalOf } from './timeKind'
import type { TimeSettings } from './timeKind'

// The delivery of the reminders of the kind "every". Their due times follow the time the reminder
// was added at equal intervals, so they are computed from the record whenever it is read. A due
// time that passes during a turn goes with the next tool result of the main conversation, and
// otherwise with a prompt once the session is idle. Every change of the handled times also puts
// the next due time of each reminder switched on into the state, where its card shows it.

type TimedReminder = ReminderOfKind<TimeSettings>

/** The toast for timed reminders that could not be sent, with the message of the failure. */
function describeTimedRemindersFailed(message: string): string {
  return (
    `The reminders due could not be sent to Claude: ${message}. They are sent with the next ` +
    'tool result, or at the next due time.'
  )
}

// The engine lists the state a module reads and writes from the source of the module, so the state
// reference is written in this file with its plugin and key as literals.
const timedRemindersHandled = atom(
  { plugin: 'workflow-skills', key: 'timedRemindersHandled' } as const,
  null,
)

// The one wait for the next due time, of the running session. A reload of the plugin cancels it
// and loads this module again, and the start that follows reads the reminders, which waits again.
let wait: Timer | undefined = undefined

/** The due times handled by a send: the reminders sent, and the handled times before and at it. */
type TakenReminders = { due: TimedReminder[]; before: TimedRemindersHandled; at: number }

/** Registers the hooks that send the reminders of the kind "every" when they are due. */
export function registerTimeCadence(on: On): void {
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, watchAfterSwitch)
  on('tool.call', EVERY_EVENT, addDueRemindersToToolResult)
  on('turn.complete', EVERY_EVENT, watchAfterTurn)
}

/** Waits for the reminders switched on among `reminders`, read into the state by the core. */
export async function followTimedReminders(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly Reminder[],
): Promise<void> {
  await watchReminders($, sessionId, enabledRemindersOf(TIME_KIND, reminders))
}

// A session switched back to may find its reminders in the state, and then requests nothing from
// the store. A request it makes runs beneath and waits again with the reminders read.
const watchAfterSwitch: MatchedHook<
  'classic.SessionStart',
  { source: typeof SWITCHING_SOURCES }
> = async ($, e, next) => {
  await watchRunningSession($)

  return next(e)
}

// The note is taken once the tool ran, so no hook beneath can drop it, and nothing is restored.
const addDueRemindersToToolResult: MatchedHook<'tool.call', EveryEvent> = ($, e, next) =>
  callToolWithNote(e, next, async () => {
    const sessionId = await $.session.id()
    const taken = await takeDueReminders($, sessionId, await readEnabledReminders($, TIME_KIND))
    const note = taken === undefined ? undefined : describeReminderNote(taken.due)
    if (note !== undefined) {
      $.ui.log(note.line)
    }

    return note?.text
  })

// A due time that passed during the turn and went with no tool result is sent once the turn ended.
const watchAfterTurn: MatchedHook<'turn.complete', EveryEvent> = ($, e, next) =>
  waitAgainAfterTurn(e, next, () => watchRunningSession($))

async function watchRunningSession($: EngineInterface): Promise<void> {
  await watchReminders($, await $.session.id(), await readEnabledReminders($, TIME_KIND))
}

/**
 * Starts counting the due times of each reminder of `reminders` switched on since the last count,
 * forgets the others, and replaces the wait with one for the first due time of `reminders`. A due
 * time that passed already is sent at once.
 */
async function watchReminders(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly TimedReminder[],
): Promise<void> {
  const now = await $.clock.now()
  const nextDueTimes = await updateHandled($, sessionId, reminders, now, inState =>
    handledFrom(sessionId, reminders, inState, now),
  )
  wait?.cancel()
  wait = undefined
  if (nextDueTimes === null || reminders.length === 0) {
    return
  }
  const delay = Math.max(Math.min(...Object.values(nextDueTimes)) - now, 0)
  wait = runAfter($, delay, () => sendAtDueTime($), describeTimedRemindersFailed)
}

/**
 * Sends the reminders due as a prompt that starts a turn, while no turn runs. During a turn they go
 * with the next tool result, and the end of the turn waits again.
 */
async function sendAtDueTime($: EngineInterface): Promise<void> {
  if (await readIsTurnRunning($)) {
    return
  }
  const sessionId = await $.session.id()
  const reminders = await readEnabledReminders($, TIME_KIND)
  const taken = await takeDueReminders($, sessionId, reminders)
  await watchReminders($, sessionId, reminders)
  const note = taken === undefined ? undefined : describeReminderNote(taken.due)
  if (taken === undefined || note === undefined) {
    return
  }
  // The prompt shows in the transcript itself, so the transcript line of the note is not shown.
  await submitToSessionOrRestore($, sessionId, { text: note.text }, () =>
    restoreHandled($, sessionId, reminders, taken),
  )
}

/**
 * Marks every due time of `reminders` up to now as handled when one of them is due, and returns
 * the reminders due. One update does both, so that only one of several parallel sends includes
 * them.
 */
async function takeDueReminders(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly TimedReminder[],
): Promise<TakenReminders | undefined> {
  if (reminders.length === 0) {
    return undefined
  }
  const now = await $.clock.now()
  const inState = ofSession(await read($, timedRemindersHandled), sessionId)
  if (inState === null || !reminders.some(reminder => isDue(reminder, inState, now))) {
    return undefined
  }
  let taken: TakenReminders | undefined = undefined
  await updateHandled($, sessionId, reminders, now, own => {
    const before = handledFrom(sessionId, reminders, own, now)
    const due = reminders.filter(reminder => isDue(reminder, before, now))
    taken = due.length === 0 ? undefined : { due, before, at: now }

    return due.length === 0 ? before : handledAt(sessionId, reminders, now)
  })

  return taken
}

/**
 * Puts back the handled times of the reminders of `taken`, after they were not sent, for each
 * reminder of `reminders` no later send handled since.
 */
async function restoreHandled(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly TimedReminder[],
  taken: TakenReminders,
): Promise<void> {
  await updateHandled($, sessionId, reminders, taken.at, own =>
    own === null
      ? null
      : {
          sessionId,
          handledUntil: Object.fromEntries(
            Object.entries(own.handledUntil).map(([id, until]) => [
              id,
              until === taken.at ? (taken.before.handledUntil[id] ?? until) : until,
            ]),
          ),
        },
  )
}

/**
 * The handled times of `reminders`, each as `inState` has it, or `now` for a reminder switched on
 * since, so its first due time comes after it was switched on.
 */
function handledFrom(
  sessionId: string,
  reminders: readonly TimedReminder[],
  inState: TimedRemindersHandled | null,
  now: number,
): TimedRemindersHandled {
  return {
    sessionId,
    handledUntil: Object.fromEntries(
      reminders.map(({ id }) => [id, inState?.handledUntil[id] ?? now]),
    ),
  }
}

function handledAt(
  sessionId: string,
  reminders: readonly TimedReminder[],
  now: number,
): TimedRemindersHandled {
  return { sessionId, handledUntil: Object.fromEntries(reminders.map(({ id }) => [id, now])) }
}

/** Whether a due time of `reminder` passed after the time up to which `handled` has it handled. */
function isDue(reminder: TimedReminder, handled: TimedRemindersHandled, now: number): boolean {
  return nextDueTimeOf(reminder, handled, now) <= now
}

/** The first due time of `reminder` after the time up to which `handled` has it handled. */
function nextDueTimeOf(
  reminder: TimedReminder,
  handled: TimedRemindersHandled,
  now: number,
): number {
  return firstDueTimeAfter(
    reminder.addedAt,
    intervalOf(reminder.settings),
    handled.handledUntil[reminder.id] ?? now,
  )
}

/**
 * Replaces the handled times of the session `sessionId` with what `change` makes of them, unless
 * another session runs by now. Puts the next due time of each of `reminders` after them into the
 * state, and returns those times by the id of the reminder, or null when another session runs.
 */
async function updateHandled(
  $: EngineInterface,
  sessionId: string,
  reminders: readonly TimedReminder[],
  now: number,
  change: (handled: TimedRemindersHandled | null) => TimedRemindersHandled | null,
): Promise<Record<string, number> | null> {
  const handled = await updateOfSession($, sessionId, change, changeInState =>
    update($, timedRemindersHandled, changeInState),
  )
  if (handled === null) {
    return null
  }
  const nextDueTimes = Object.fromEntries(
    reminders.map(reminder => [reminder.id, nextDueTimeOf(reminder, handled, now)]),
  )
  await setNextSends($, sessionId, TIME_KIND.id, nextDueTimes)

  return nextDueTimes
}
