import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type {
  CardDraft,
  CardInPane,
  CardWarning,
  Reminder,
  ReminderCard,
  ReminderNextSends,
  SessionReminders,
} from '../../types'
import { keepReadOverFailure, ofRunningSession, updateOfSession } from '../sessionBoundState'
import { Outcome } from './reminders'
import type { Failed, ReadReminders, RemindersNotRead } from './reminderStore'

// The engine lists the state a module reads and writes from the source of the module, so every
// state reference of the reminders is written in this file with its plugin and key as literals.
const sessionReminders = atom(
  { plugin: 'workflow-skills', key: 'sessionReminders' } as const,
  null,
)
const reminderCard = atom({ plugin: 'workflow-skills', key: 'reminderCard' } as const, null, {
  shape: 'card-with-next-items',
})
const savingReminder = atom({ plugin: 'workflow-skills', key: 'savingReminder' } as const, null)
const reminderNextSends = atom(
  { plugin: 'workflow-skills', key: 'reminderNextSends' } as const,
  null,
)

/** The next send times of reminders, by the id of their cadence kind, then of the reminder. */
export type NextSends = ReminderNextSends['byKind']

/** What the Reminders pane does with a pressed card. */
export enum CardMode {
  Editing = 'editing',
  WaitingForYes = 'waiting-for-yes',
}

/**
 * The reminders in the state while their session runs, and null otherwise, such as before the
 * session read them or after a switch to another session.
 */
export async function readRemindersInState($: EngineInterface): Promise<SessionReminders | null> {
  return ofRunningSession($, await read($, sessionReminders))
}

/**
 * Puts the reminders read for the session `sessionId` into the state, unless another session runs
 * by now, and returns the reminders of that session in the state after it, when they were read.
 * Reminders that could not be read replace only reminders that were not read either, so a failed
 * request leaves the last reminders read on screen.
 */
export async function setLoadedReminders(
  $: EngineInterface,
  sessionId: string,
  loaded: ReadReminders | Failed,
): Promise<readonly Reminder[] | undefined> {
  const inState = await updateOfSession<SessionReminders>(
    $,
    sessionId,
    shown => keepReadOverFailure(shown, { sessionId, ...plainOf(loaded) }, Outcome.Read),
    changeInState => update($, sessionReminders, changeInState),
  )

  return inState?.outcome === Outcome.Read ? inState.reminders : undefined
}

/** `loaded` as plain data for the state, a failure with the message of its error alone. */
function plainOf(loaded: ReadReminders | Failed): ReadReminders | RemindersNotRead {
  if (loaded.outcome === Outcome.Read) {
    return loaded
  }
  const { outcome, call, key, cause } = loaded

  return { outcome, call, key, cause: { message: cause.message } }
}

/** The card of the running session pressed in the Reminders pane, if any. */
export async function readCardInState($: EngineInterface): Promise<ReminderCard | null> {
  return ofRunningSession($, await read($, reminderCard))
}

/**
 * Puts `card` of the session `sessionId` into the Reminders pane, in place of any card there
 * before, so only one card at a time is edited or waits for a yes.
 */
export async function setCard(
  $: EngineInterface,
  sessionId: string,
  card: CardInPane,
): Promise<void> {
  await updateOfSession(
    $,
    sessionId,
    () => ({ sessionId, ...card }),
    changeInState => update($, reminderCard, changeInState),
  )
}

/**
 * Replaces what was typed into the card of the reminder with the id `reminderId` with what
 * `change` makes of it, while that card is edited. A warning on the card was for what was typed
 * before, so the change takes it off.
 */
export async function changeDraft(
  $: EngineInterface,
  reminderId: string,
  change: (draft: CardDraft) => CardDraft,
): Promise<void> {
  await update($, reminderCard, inState => {
    if (inState?.reminderId !== reminderId || inState.mode !== CardMode.Editing) {
      return inState
    }
    const { sessionId, openingId, fieldsId, opened, draft } = inState

    return {
      sessionId,
      reminderId,
      mode: CardMode.Editing,
      openingId,
      fieldsId,
      opened,
      draft: change(draft),
    }
  })
}

/**
 * Draws the fields of the card of the reminder with the id `reminderId` anew, as the fields with
 * the id `fieldsId`, with what `change` makes of what was typed into it, while the card is edited.
 * The kind dropdown keeps its key, so the focus stays on it. A `change` that returns the draft it
 * got leaves the card as it is.
 */
export async function reopenCard(
  $: EngineInterface,
  { reminderId, fieldsId }: { reminderId: string; fieldsId: string },
  change: (draft: CardDraft) => CardDraft,
): Promise<void> {
  await update($, reminderCard, inState => {
    if (inState?.reminderId !== reminderId || inState.mode !== CardMode.Editing) {
      return inState
    }
    const changed = change(inState.draft)
    if (changed === inState.draft) {
      return inState
    }
    const { sessionId, openingId } = inState

    return {
      sessionId,
      reminderId,
      mode: CardMode.Editing,
      openingId,
      fieldsId,
      opened: changed,
      draft: changed,
    }
  })
}

/**
 * Draws the text field and the value fields of the card of the reminder with the id `reminderId`
 * anew with what was typed into them, while the card is edited.
 */
export async function redrawFields($: EngineInterface, reminderId: string): Promise<void> {
  await update($, reminderCard, inState =>
    inState?.reminderId === reminderId && inState.mode === CardMode.Editing
      ? { ...inState, fieldsId: crypto.randomUUID(), opened: inState.draft }
      : inState,
  )
}

/** Shows `warning` on the card of the reminder with the id `reminderId`, while it is edited. */
export async function warnOnCard(
  $: EngineInterface,
  reminderId: string,
  warning: CardWarning,
): Promise<void> {
  await update($, reminderCard, inState =>
    inState?.reminderId === reminderId && inState.mode === CardMode.Editing
      ? { ...inState, warning }
      : inState,
  )
}

/**
 * Ends the mode `mode` of the card of the reminder with the id `reminderId`, while the card is
 * still in that mode.
 */
export async function dropCard(
  $: EngineInterface,
  reminderId: string,
  mode: CardMode,
): Promise<void> {
  await update($, reminderCard, inState =>
    inState?.reminderId === reminderId && inState.mode === mode ? null : inState,
  )
}

/**
 * Marks a save of the reminder with the id `reminderId` in the Reminders pane as running, and
 * returns false when a save of the pane runs already.
 */
export async function startSaving($: EngineInterface, reminderId: string): Promise<boolean> {
  let isStarted = false
  await update($, savingReminder, saving => {
    isStarted = saving === null

    return saving ?? reminderId
  })

  return isStarted
}

export async function endSaving($: EngineInterface): Promise<void> {
  await update($, savingReminder, () => null)
}

/** The id of the reminder whose save in the Reminders pane runs, if one runs. */
export async function readSavingReminder($: EngineInterface): Promise<string | null> {
  return read($, savingReminder)
}

/**
 * Puts the next send times `at` of the reminders of the cadence kind `kindId` into the state, by
 * the id of the reminder, in place of those the kind put there before, unless another session runs
 * by now.
 */
export async function setNextSends(
  $: EngineInterface,
  sessionId: string,
  kindId: string,
  at: Readonly<Record<string, number>>,
): Promise<void> {
  await updateOfSession<ReminderNextSends>(
    $,
    sessionId,
    own => ({ sessionId, byKind: { ...own?.byKind, [kindId]: at } }),
    changeInState => update($, reminderNextSends, changeInState),
  )
}

/** The next send times of the reminders of the running session, as their kinds put them. */
export async function readNextSends($: EngineInterface): Promise<NextSends> {
  return (await ofRunningSession($, await read($, reminderNextSends)))?.byKind ?? {}
}
