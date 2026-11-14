import type { Cadence, CardDraft, CardWarning, Reminder } from '../../types'
import type { NextSends } from './reminderState'

// What the hooks module and the surface module of the Reminders pane hand each other: the
// reminders to draw, each save of the pane as an action, and the result of the save.

/** How far the reminders of the session have been read. */
export enum RemindersShown {
  Loading = 'loading',
  NotRead = 'not-read',
  Read = 'read',
}

/**
 * What the Reminders pane draws: while the reminders are read, the reason they could not be read,
 * or the reminders of the session with a text for each stored record that could not be read, the
 * next send times put by the cadence kinds, the time the pane is drawn at, and the text drawn under
 * the reminders.
 */
export type RemindersPaneView =
  | { shown: RemindersShown.Loading }
  | { shown: RemindersShown.NotRead; failure: string }
  | {
      shown: RemindersShown.Read
      reminders: readonly Reminder[]
      unreadable: readonly string[]
      nextSends: NextSends
      now: number
      notice?: string
    }

export enum ReminderPaneActionKind {
  Save = 'save',
  /**
   * Saves the card, and then switches its reminder, so a new card is stored before it is switched.
   */
  SaveAndSwitch = 'save-and-switch',
  Switch = 'switch',
  Remove = 'remove',
}

/** A save of the Reminders pane, on the reminder with the id `reminderId` drawn as `number`. */
export type ReminderPaneAction = { reminderId: string; number: number } & (
  | { kind: ReminderPaneActionKind.Save; draft: CardDraft }
  | { kind: ReminderPaneActionKind.SaveAndSwitch; draft: CardDraft; isEnabled: boolean }
  | { kind: ReminderPaneActionKind.Switch; isEnabled: boolean }
  | { kind: ReminderPaneActionKind.Remove }
)

/** How a save of the Reminders pane ended. */
export enum ReminderSaveOutcome {
  /** A switch or a removal saved by the store. */
  Saved = 'saved',
  /** A card saved by the store, or unchanged. */
  CardSaved = 'card-saved',
  /** A card that cannot be saved as typed, which shows a warning. */
  CardRefused = 'card-refused',
  /** Refused for a reminder removed since the pane drew it, which a toast showed. */
  Removed = 'removed',
  /** Not saved by the store, which a toast showed. */
  Failed = 'failed',
}

/** How a save ended, with the cadence of a card saved, or the warning on a card refused. */
export type ReminderSaveResult =
  | {
      outcome:
        | ReminderSaveOutcome.Saved
        | ReminderSaveOutcome.Removed
        | ReminderSaveOutcome.Failed
    }
  | { outcome: ReminderSaveOutcome.CardSaved; cadence: Cadence }
  | { outcome: ReminderSaveOutcome.CardRefused; warning: CardWarning }
