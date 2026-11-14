import type { Cadence, CardDraft, CardInPane, CardWarning, Reminder } from '../../types'
import type { PaneControls } from '../paneModule'
import { CadenceProblem, addItem, defaultCadenceOf, kindOf, removeItem } from './cadenceKind'
import type { CadenceKinds, ListCardField } from './cadenceKind'
import { CardFocus } from './cardFocus'
import type { FieldFocus } from './cardFocus'
import { ReminderPaneActionKind, ReminderSaveOutcome } from './reminderPaneMessages'
import type { ReminderPaneAction, ReminderSaveResult } from './reminderPaneMessages'

// What a press in the Reminders pane changes, stored by its surface module, and what the result of
// a save changes. Only one card at a time is edited or waits for a yes.

/** What the Reminders pane does with a pressed card. */
export enum CardMode {
  Editing = 'editing',
  WaitingForYes = 'waiting-for-yes',
}

/** The card pressed in the Reminders pane in the mode `Mode`. */
type CardInMode<Mode extends CardMode> = Extract<CardInPane, { mode: Mode }>

export type EditingCard = CardInMode<CardMode.Editing>

/** What the drawing of the Reminders pane reads and acts on. */
export type RemindersPaneControls = PaneControls<CardInPane | null, ReminderPaneAction>

/**
 * A card being edited, as the pane draws it: the number drawn on it, its reminder, the ids of its
 * opening and of its fields, and what its fields were drawn with. What was typed into it is in the
 * state alone, as a press can arrive before the pane has drawn the last typing.
 */
export type EditedCard = {
  number: number
  reminderId: string
  openingId: string
  fieldsId: string
  opened: CardDraft
}

type SaveAction = Extract<ReminderPaneAction, { kind: ReminderPaneActionKind.Save }>

type SaveAndSwitchAction = Extract<
  ReminderPaneAction,
  { kind: ReminderPaneActionKind.SaveAndSwitch }
>

export function isCardInMode<Mode extends CardMode>(
  card: CardInPane | null,
  reminderId: string,
  mode: Mode,
): card is CardInMode<Mode> {
  return card?.reminderId === reminderId && card.mode === mode
}

/**
 * `card` with the mode `mode` of the card of `reminderId` ended, while the card is in that mode.
 */
export function endedCard(
  card: CardInPane | null,
  reminderId: string,
  mode: CardMode,
): CardInPane | null {
  return isCardInMode(card, reminderId, mode) ? null : card
}

/**
 * A new card, empty and with the first kind of `kinds`. Its reminder gets its id now and is stored
 * once the card is saved.
 */
export function addedCardOf(kinds: CadenceKinds): EditingCard {
  return openedCardOf(crypto.randomUUID(), draftOf('', defaultCadenceOf(kinds[0])))
}

/** The card of `reminder`, with its text and cadence in fields. */
export function editedCardOf(kinds: CadenceKinds, reminder: Reminder): EditingCard {
  const { text, cadence } = reminder

  return openedCardOf(reminder.id, draftOf(text, editedCadenceOf(kinds, cadence)))
}

/** A card typed as `text` and `cadence`, with an empty field for the next item of each list. */
function draftOf(text: string, cadence: Cadence): CardDraft {
  return { text, cadence, nextItems: {} }
}

/**
 * `cadence` as the fields of a card draw it: with the values read by its kind, every field at its
 * default where the kind cannot read them, and as the first kind of `kinds` when the pane does not
 * have its kind.
 */
function editedCadenceOf(kinds: CadenceKinds, cadence: Cadence): Cadence {
  const kind = kindOf(kinds, cadence.kind)
  if (kind === undefined) {
    return defaultCadenceOf(kinds[0])
  }
  const values = kind.readValues(cadence.values)

  return values instanceof CadenceProblem ? defaultCadenceOf(kind) : { kind: kind.id, values }
}

/**
 * The card of the reminder with the id `reminderId` with its fields, as a new opening drawn with
 * `opened`, with the focus on its text field.
 */
function openedCardOf(reminderId: string, opened: CardDraft): EditingCard {
  return {
    reminderId,
    mode: CardMode.Editing,
    openingId: crypto.randomUUID(),
    fieldsId: crypto.randomUUID(),
    opened,
    draft: opened,
    focus: { field: CardFocus.Text },
  }
}

/**
 * `card` with what `change` makes of what was typed into it, while the card of `reminderId` is
 * edited. A warning on the card was for what was typed before, so the change removes it.
 */
function changedDraft(
  card: CardInPane | null,
  reminderId: string,
  change: (draft: CardDraft) => CardDraft,
): CardInPane | null {
  return isCardInMode(card, reminderId, CardMode.Editing)
    ? { ...withoutWarning(card), draft: change(card.draft) }
    : card
}

/** `card` without the warning from its last save. */
function withoutWarning(card: EditingCard): EditingCard {
  const copy = { ...card }
  delete copy.warning

  return copy
}

/**
 * `card` with its fields drawn anew, under new keys, with what `change` makes of what was typed
 * into it, and the focus on `focus`, while the card of `reminderId` is edited. The kind dropdown
 * draws under the same key, so the focus is still on it. A `change` that returns the draft it got
 * leaves the card as it is.
 */
function reopenedCard(
  card: CardInPane | null,
  reminderId: string,
  change: (draft: CardDraft) => CardDraft,
  focus?: FieldFocus,
): CardInPane | null {
  if (!isCardInMode(card, reminderId, CardMode.Editing)) {
    return card
  }
  const changed = change(card.draft)
  if (changed === card.draft) {
    return card
  }
  return {
    ...withoutWarning(card),
    fieldsId: crypto.randomUUID(),
    opened: changed,
    draft: changed,
    focus: focus ?? card.focus,
  }
}

/**
 * `card` with its text field and value fields drawn anew with what was typed into them, while the
 * card of `reminderId` is edited.
 */
function redrawnCard(card: CardInPane | null, reminderId: string): CardInPane | null {
  return isCardInMode(card, reminderId, CardMode.Editing)
    ? { ...card, fieldsId: crypto.randomUUID(), opened: card.draft }
    : card
}

/** `card` with `warning` on it, while the card of `reminderId` is edited. */
function warnedCard(
  card: CardInPane | null,
  reminderId: string,
  warning: CardWarning,
): CardInPane | null {
  return isCardInMode(card, reminderId, CardMode.Editing) ? { ...card, warning } : card
}

export function typedText(
  card: CardInPane | null,
  reminderId: string,
  text: string,
): CardInPane | null {
  return changedDraft(card, reminderId, draft => ({ ...draft, text }))
}

/** `card` with the value `value` in the field with the key `key` of its cadence. */
export function typedValue(
  card: CardInPane | null,
  reminderId: string,
  { key, value }: { key: string; value: string },
): CardInPane | null {
  return changedDraft(card, reminderId, draft => ({
    ...draft,
    cadence: { ...draft.cadence, values: { ...draft.cadence.values, [key]: value } },
  }))
}

/**
 * `card` with `typed` as the text typed into the field that adds an item to the list field `key`.
 */
export function typedNextItem(
  card: CardInPane | null,
  reminderId: string,
  { key, typed }: { key: string; typed: string },
): CardInPane | null {
  return changedDraft(card, reminderId, draft => ({
    ...draft,
    nextItems: { ...draft.nextItems, [key]: typed },
  }))
}

/**
 * `card` with its fields drawn anew with the cadence of the kind with the id `kindId`, every field
 * at its default, and the text typed so far, unless the card has that kind. The fields of the kind
 * are new, so none shows what was typed into a field of the kind before. An id the pane does not
 * have changes nothing.
 */
export function pickedKind(
  kinds: CadenceKinds,
  card: CardInPane | null,
  reminderId: string,
  kindId: string,
): CardInPane | null {
  const kind = kindOf(kinds, kindId)
  if (kind === undefined) {
    return card
  }

  return reopenedCard(card, reminderId, draft =>
    draft.cadence.kind === kind.id ? draft : draftOf(draft.text, defaultCadenceOf(kind)),
  )
}

/**
 * `card` with `typed`, the whole text of the field that adds an item at the Enter pressed in it,
 * added to the list field `field`, and the focus on the empty field that adds the next item. The
 * pane records its focus as a position among the fields and buttons it draws, and the row of the
 * new item is drawn at the position of that field. So the fields are drawn anew under new keys.
 */
export function addedItem(
  card: CardInPane | null,
  reminderId: string,
  field: ListCardField,
  typed: string,
): CardInPane | null {
  return reopenedCard(
    card,
    reminderId,
    draft => ({
      ...draft,
      cadence: { ...draft.cadence, values: addItem(field, draft.cadence.values, typed) },
      nextItems: { ...draft.nextItems, [field.key]: '' },
    }),
    { field: CardFocus.NextItem, key: field.key },
  )
}

/** `card` without `item`, drawn at `index` of the list field `field`. */
export function removedItem(
  card: CardInPane | null,
  reminderId: string,
  field: ListCardField,
  drawn: { index: number; item: string },
): CardInPane | null {
  return changedDraft(card, reminderId, draft => ({
    ...draft,
    cadence: { ...draft.cadence, values: removeItem(field, draft.cadence.values, drawn) },
  }))
}

/** The save of what was typed into `card`, drawn as `number`. */
export function saveActionOf(card: EditingCard, number: number): SaveAction {
  return {
    kind: ReminderPaneActionKind.Save,
    reminderId: card.reminderId,
    number,
    draft: card.draft,
  }
}

/**
 * The save of what was typed into `card`, drawn as `number`, and then the switch to `isEnabled`.
 */
export function saveAndSwitchActionOf(
  card: EditingCard,
  number: number,
  isEnabled: boolean,
): SaveAndSwitchAction {
  return { ...saveActionOf(card, number), kind: ReminderPaneActionKind.SaveAndSwitch, isEnabled }
}

/**
 * `card` once the save `action` ended as `result`. The press of a removal ends the question. One
 * not saved by the store draws the question again, so the user can press Yes again, unless another
 * card was pressed since.
 */
export function settleCard(
  card: CardInPane | null,
  action: ReminderPaneAction,
  result: ReminderSaveResult,
): CardInPane | null {
  switch (action.kind) {
    case ReminderPaneActionKind.Save:
      return settledSave(card, action.reminderId, result)
    case ReminderPaneActionKind.SaveAndSwitch:
      return settledSaveAndSwitch(card, action.reminderId, result)
    case ReminderPaneActionKind.Switch:
      return card
    case ReminderPaneActionKind.Remove:
      return result.outcome === ReminderSaveOutcome.Failed
        ? (card ?? { reminderId: action.reminderId, mode: CardMode.WaitingForYes })
        : card
  }
}

/**
 * `card` once the save of the card of `reminderId` ended as `result`: drawn without its fields once
 * the store has it, and with its fields anew otherwise, as the engine empties the field an Enter
 * was pressed in. A refused card shows its warning, and a card of a reminder removed since closes.
 */
function settledSave(
  card: CardInPane | null,
  reminderId: string,
  result: ReminderSaveResult,
): CardInPane | null {
  switch (result.outcome) {
    case ReminderSaveOutcome.Saved:
    case ReminderSaveOutcome.CardSaved:
    case ReminderSaveOutcome.Removed:
      return endedCard(card, reminderId, CardMode.Editing)
    case ReminderSaveOutcome.CardRefused:
      return redrawnCard(warnedCard(card, reminderId, result.warning), reminderId)
    case ReminderSaveOutcome.Failed:
      return redrawnCard(card, reminderId)
  }
}

/**
 * `card` once the save and the switch of the card of `reminderId` ended as `result`. A saved card
 * is still drawn with its fields, on the cadence saved, so the text typed for the next item of a
 * list shows as an item.
 */
function settledSaveAndSwitch(
  card: CardInPane | null,
  reminderId: string,
  result: ReminderSaveResult,
): CardInPane | null {
  switch (result.outcome) {
    case ReminderSaveOutcome.CardSaved:
      return reopenedCard(card, reminderId, draft => draftOf(draft.text, result.cadence))
    case ReminderSaveOutcome.CardRefused:
      return warnedCard(card, reminderId, result.warning)
    case ReminderSaveOutcome.Removed:
      return endedCard(card, reminderId, CardMode.Editing)
    case ReminderSaveOutcome.Saved:
    case ReminderSaveOutcome.Failed:
      return card
  }
}
