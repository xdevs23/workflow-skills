import type { Cadence, CadenceValue, CardDraft, CardWarning, Reminder } from '../../types'
import { addItem, isListField, kindOf } from './cadenceKind'
import type { CadenceKinds } from './cadenceKind'

// The rules of the reminders of a session: a reminder is never deleted, so its number is never
// given to another reminder. A removed reminder is never shown and never sent.

/** What became of a request, a check or a change of the reminders of a session. */
export enum Outcome {
  Read = 'read',
  Checked = 'checked',
  Changed = 'changed',
  Unchanged = 'unchanged',
  Refused = 'refused',
  Failed = 'failed',
}

/** Why a change of a reminder was refused. A refused change leaves the reminders as they were. */
export enum Refusal {
  BlankText = 'blank-text',
  /** The cadence is of a kind this version of the plugin does not know. */
  UnknownCadence = 'unknown-cadence',
  CadenceProblem = 'cadence-problem',
  /** The reminder was removed since the card was drawn, by another process of the session. */
  Removed = 'removed',
}

export type Changed = { outcome: Outcome.Changed }

export type Unchanged = { outcome: Outcome.Unchanged }

export type RemovedRefused = { outcome: Outcome.Refused; refusal: Refusal.Removed }

/** A card that cannot be saved as typed, with the warning the card shows for it. */
export type DraftRefused = { outcome: Outcome.Refused } & CardWarning

/**
 * A card as typed, with the white space around its text removed and each text typed for the next
 * item of a list added to it, ready to be saved.
 */
export type CheckedDraft = { outcome: Outcome.Checked; text: string; cadence: Cadence }

export function isRemoved(reminder: Reminder): boolean {
  return reminder.removedAt !== undefined
}

/** The reminders shown in the pane, every reminder that is not removed. */
export function shownRemindersOf(reminders: readonly Reminder[]): Reminder[] {
  return reminders.filter(reminder => !isRemoved(reminder))
}

/** The number of the next reminder added: one more than the highest number, removed or not. */
export function nextNumberOf(reminders: readonly Reminder[]): number {
  return Math.max(0, ...reminders.map(({ number }) => number)) + 1
}

/**
 * The card `draft` checked against `kinds`: a text that is not blank, and a cadence of a kind of
 * `kinds` that reads its values, with the text typed for the next item of each list added to it.
 */
export function checkDraft(draft: CardDraft, kinds: CadenceKinds): CheckedDraft | DraftRefused {
  const text = draft.text.trim()
  if (text === '') {
    return { outcome: Outcome.Refused, refusal: Refusal.BlankText }
  }
  const kind = kindOf(kinds, draft.cadence.kind)
  if (kind === undefined) {
    return { outcome: Outcome.Refused, refusal: Refusal.UnknownCadence }
  }
  const values = kind.fields
    .filter(isListField)
    .reduce(
      (added, field) => addItem(field, added, draft.nextItems[field.key] ?? ''),
      draft.cadence.values,
    )
  const problem = kind.problemOf(values)

  return problem === undefined
    ? { outcome: Outcome.Checked, text, cadence: { kind: kind.id, values } }
    : { outcome: Outcome.Refused, refusal: Refusal.CadenceProblem, problem: problem.text }
}

/** Whether two cadences have one kind and one value for each field. */
export function isSameCadence(first: Cadence, second: Cadence): boolean {
  const keys = new Set([...Object.keys(first.values), ...Object.keys(second.values)])

  return (
    first.kind === second.kind &&
    [...keys].every(key => isSameValue(first.values[key], second.values[key]))
  )
}

/** Whether two values of a field are one text, or lists of the same items in the same order. */
function isSameValue(first: CadenceValue | undefined, second: CadenceValue | undefined): boolean {
  return typeof first === 'object' && typeof second === 'object'
    ? first.length === second.length && first.every((item, index) => item === second[index])
    : first === second
}
