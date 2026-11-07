import type { EngineInterface } from 'claude-code'

import type { CardDraft, Reminder } from '../../types'
import { showFailure } from '../failureToast'
import type { FailedStoreCall } from '../pluginStore'
import { defaultCadenceOf, kindOf } from './cadenceKind'
import type { CadenceKinds } from './cadenceKind'
import { CardFocus } from './cardFocus'
import type { FocusTarget } from './cardFocus'
import {
  removeReminderOfSession,
  saveDraftOfSession,
  switchReminderOfSession,
} from './reminderActions'
import { REMINDERS_PANE } from './reminderNames'
import { Outcome, checkDraft } from './reminders'
import {
  CardMode,
  changeDraft,
  dropCard,
  endSaving,
  readCardInState,
  redrawFields,
  reopenCard,
  setCard,
  startSaving,
  warnOnCard,
} from './reminderState'
import type { ReminderChange } from './reminderStore'
import {
  describeFocusNotMoved,
  describeNotRemoved,
  describeNotSaved,
  describeNotSwitched,
  describeRemovedMeanwhile,
} from './reminderTexts'

// What a press or an entry in the Reminders pane does. The pane draws what the state and the
// reminders in it have after it.

/** What the presses of the pane share: the cadence kinds of its cards and the session it shows. */
export type PaneContext = { kinds: CadenceKinds; sessionId: string }

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

/** The key of the text field of a card with the fields `fieldsId`. */
export function textFieldKeyOf(fieldsId: string): string {
  return `text-${fieldsId}`
}

/** The key of the kind dropdown of the opening `openingId` of a card. */
export function kindDropdownKeyOf(openingId: string): string {
  return `kind-${openingId}`
}

/** The key of the value field with the key `fieldKey` of a card with the fields `fieldsId`. */
export function valueFieldKeyOf(fieldsId: string, fieldKey: string): string {
  return `field-${fieldsId}-${fieldKey}`
}

/**
 * Draws a new card numbered `number`, empty and with the first kind of the pane, and moves the
 * focus to its text field. Its reminder gets its id now and is stored once the card is saved.
 */
export async function startAdding(
  $: EngineInterface,
  { kinds, sessionId }: PaneContext,
  number: number,
): Promise<void> {
  const opened = { text: '', cadence: defaultCadenceOf(kinds[0]) }
  await openCard($, sessionId, number, crypto.randomUUID(), opened)
}

/**
 * Draws the card of `reminder` with its text and cadence in fields, and moves the focus to its
 * text field. A cadence of a kind the pane does not have is drawn as the first kind.
 */
export async function startEditing(
  $: EngineInterface,
  { kinds, sessionId }: PaneContext,
  reminder: Reminder,
): Promise<void> {
  const { text, cadence } = reminder
  const opened = {
    text,
    cadence: kindOf(kinds, cadence.kind) === undefined ? defaultCadenceOf(kinds[0]) : cadence,
  }
  await openCard($, sessionId, reminder.number, reminder.id, opened)
}

/**
 * Draws the card numbered `number` of the reminder with the id `reminderId` with its fields, as a
 * new opening drawn with `opened`, and moves the focus to its text field.
 */
async function openCard(
  $: EngineInterface,
  sessionId: string,
  number: number,
  reminderId: string,
  opened: CardDraft,
): Promise<void> {
  const fieldsId = crypto.randomUUID()
  await setCard($, sessionId, {
    reminderId,
    mode: CardMode.Editing,
    openingId: crypto.randomUUID(),
    fieldsId,
    opened,
    draft: opened,
  })
  await focusField($, textFieldKeyOf(fieldsId), { field: CardFocus.Text, number })
}

export async function typeText(
  $: EngineInterface,
  reminderId: string,
  text: string,
): Promise<void> {
  await changeDraft($, reminderId, draft => ({ ...draft, text }))
}

/**
 * Draws the fields of the card anew with the cadence of the kind with the id `kindId`, every field
 * at its default, and the text typed so far, unless the card has that kind. The fields of the kind
 * are new, so none shows what was typed into a field of the kind before. An id the pane does not
 * have changes nothing.
 */
export async function pickKind(
  $: EngineInterface,
  { kinds }: PaneContext,
  reminderId: string,
  kindId: string,
): Promise<void> {
  const kind = kindOf(kinds, kindId)
  if (kind === undefined) {
    return
  }
  await reopenCard($, reminderId, draft =>
    draft.cadence.kind === kind.id ? draft : { ...draft, cadence: defaultCadenceOf(kind) },
  )
}

/** Gives the field with the key `key` of the cadence of the card the value `value`. */
export async function typeValue(
  $: EngineInterface,
  reminderId: string,
  key: string,
  value: string,
): Promise<void> {
  await changeDraft($, reminderId, ({ text, cadence }) => ({
    text,
    cadence: { kind: cadence.kind, values: { ...cadence.values, [key]: value } },
  }))
}

/**
 * Saves the card with `text`, the whole text of its text field at the Enter pressed in it, and
 * draws the card without its fields once the store has it.
 */
export async function submitText(
  $: EngineInterface,
  pane: PaneContext,
  card: EditedCard,
  text: string,
): Promise<void> {
  await typeText($, card.reminderId, text)
  await finishCard($, pane, card)
}

/**
 * Saves the card with `value` in its field with the key `key`, the whole text of that field at the
 * Enter pressed in it, and draws the card without its fields once the store has it.
 */
export async function submitValue(
  $: EngineInterface,
  pane: PaneContext,
  card: EditedCard,
  { key, value }: { key: string; value: string },
): Promise<void> {
  await typeValue($, card.reminderId, key, value)
  await finishCard($, pane, card)
}

/**
 * Saves the card, and draws it without its fields once the store has it. A card the store does not
 * have is drawn with its fields anew, as the engine empties the field an Enter was pressed in.
 */
export async function finishCard(
  $: EngineInterface,
  pane: PaneContext,
  card: EditedCard,
): Promise<void> {
  await saveOnce($, card.reminderId, async () => {
    if (await saveCard($, pane, card)) {
      await dropCard($, card.reminderId, CardMode.Editing)
    } else {
      await redrawFields($, card.reminderId)
    }
  })
}

/**
 * Saves the card, and then switches its reminder on or off as `isEnabled` sets it, so a new card is
 * stored before it is switched. The card is still drawn with its fields.
 */
export async function switchCard(
  $: EngineInterface,
  pane: PaneContext,
  card: EditedCard,
  isEnabled: boolean,
): Promise<void> {
  await saveOnce($, card.reminderId, async () => {
    if (await saveCard($, pane, card)) {
      await switchReminder($, pane, card, isEnabled)
    }
  })
}

/** Switches the reminder of the card `card` on or off as `isEnabled` sets it. */
export async function switchOnScreen(
  $: EngineInterface,
  pane: PaneContext,
  card: Pick<EditedCard, 'number' | 'reminderId'>,
  isEnabled: boolean,
): Promise<void> {
  await saveOnce($, card.reminderId, () => switchReminder($, pane, card, isEnabled))
}

/** Shows the yes and the keep of a removal in place of the buttons of the card. */
export async function askToRemove(
  $: EngineInterface,
  { sessionId }: PaneContext,
  reminderId: string,
): Promise<void> {
  await setCard($, sessionId, { reminderId, mode: CardMode.WaitingForYes })
}

/**
 * Removes the reminder of the card `card`. A failed removal still shows the yes and the keep, so
 * the user can press Yes again.
 */
export async function removeOnScreen(
  $: EngineInterface,
  { sessionId }: PaneContext,
  card: Pick<EditedCard, 'number' | 'reminderId'>,
): Promise<void> {
  await saveOnce($, card.reminderId, async () => {
    const removed = await removeReminderOfSession($, sessionId, card.reminderId)
    if (removed.outcome !== Outcome.Failed) {
      await dropCard($, card.reminderId, CardMode.WaitingForYes)
    }
    showChangeFailure($, card, removed, describeNotRemoved)
  })
}

/**
 * Runs `save` of the reminder with the id `reminderId` unless another save of the pane runs. Button
 * and Input have no disabled state, so a press or an entry that arrives meanwhile is ignored, while
 * the card shows the save in progress.
 */
async function saveOnce(
  $: EngineInterface,
  reminderId: string,
  save: () => Promise<void>,
): Promise<void> {
  if (!(await startSaving($, reminderId))) {
    return
  }
  try {
    await save()
  } finally {
    await endSaving($)
  }
}

async function switchReminder(
  $: EngineInterface,
  { sessionId }: PaneContext,
  card: Pick<EditedCard, 'number' | 'reminderId'>,
  isEnabled: boolean,
): Promise<void> {
  const switched = await switchReminderOfSession($, sessionId, card.reminderId, isEnabled)
  showChangeFailure($, card, switched, describeNotSwitched)
}

/**
 * Saves what was typed into the card, while it is edited, and returns whether the store has it
 * now. A refused save shows its warning on the card, or for a reminder removed since, a toast, and
 * closes the card.
 */
async function saveCard(
  $: EngineInterface,
  { kinds, sessionId }: PaneContext,
  card: EditedCard,
): Promise<boolean> {
  const inState = await readCardInState($)
  if (inState?.reminderId !== card.reminderId || inState.mode !== CardMode.Editing) {
    return false
  }
  const checked = checkDraft(inState.draft, kinds)
  if (checked.outcome === Outcome.Refused) {
    await warnOnCard($, card.reminderId, checked)

    return false
  }
  const saved = await saveDraftOfSession($, sessionId, card.reminderId, checked)
  if (saved.outcome === Outcome.Refused) {
    await dropCard($, card.reminderId, CardMode.Editing)
  }
  showChangeFailure($, card, saved, describeNotSaved)

  return saved.outcome === Outcome.Changed || saved.outcome === Outcome.Unchanged
}
/**
 * Shows a toast for `change` of the reminder of `card` that did not happen: the failure of the
 * store as `describeFailure` writes it, or the removal of the reminder since the card was drawn.
 */
function showChangeFailure(
  $: EngineInterface,
  card: Pick<EditedCard, 'number'>,
  change: ReminderChange,
  describeFailure: (failed: FailedStoreCall) => string,
): void {
  switch (change.outcome) {
    case Outcome.Failed:
      showFailure($, describeFailure(change))
      break
    case Outcome.Refused:
      $.ui.toast(describeRemovedMeanwhile(card.number))
      break
    case Outcome.Changed:
    case Outcome.Unchanged:
      break
  }
}

/**
 * Moves the focus to the field `target` with the key `key` in the Reminders pane. The engine
 * denies the move once the pane no longer has the keys, and the focus then does not move from the
 * field the user chose. A denied move is written to the debug log.
 */
async function focusField($: EngineInterface, key: string, target: FocusTarget): Promise<void> {
  const focused = await $.ui.focus({ requestId: REMINDERS_PANE, key })
  if (focused.deny !== undefined) {
    $.ui.log(describeFocusNotMoved(focused.deny, target), { to: 'debug' })
  }
}
