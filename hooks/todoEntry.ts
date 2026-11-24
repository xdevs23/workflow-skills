declare const ENTRY_NUMBER_BRAND: unique symbol

/**
 * The number of an entry in TODO.md in dot notation, such as #161.5.2 under #161.5, without leading
 * zeros, so each entry has one spelling. Each part is 1 or higher, as in TODO.md.
 */
export type EntryNumber = string & { readonly [ENTRY_NUMBER_BRAND]: true }

export enum EntryState {
  Recorded = 'RECORDED',
  Ready = 'READY',
  InProgress = 'IN PROGRESS',
}

/** A number in dot notation as the model may write it, with leading zeros. */
export const ENTRY_NUMBER_PATTERN = /^#0*[1-9]\d*(?:\.0*[1-9]\d*)*$/

/** The zeros in front of the last digit of each part of a number in dot notation. */
const LEADING_ZEROS = /(?<=[#.])0+(?=\d)/g

const ENTRY_ORDER = new Intl.Collator('en', { numeric: true })

/** How an entry is given, as the texts for the model write it. */
export const ENTRY_NUMBER_RULE =
  'its number in dot notation, every part 1 or higher, such as #161.5.2'

/** `value` as an entry number without leading zeros, or undefined when it is none. */
export function readEntryNumber(value: unknown): EntryNumber | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const withoutLeadingZeros = value.replace(LEADING_ZEROS, '')

  return isEntryNumber(withoutLeadingZeros) ? withoutLeadingZeros : undefined
}

/** Whether `entry` is `top` or an entry under it, such as #161.5.2 under #161.5. */
export function isEntryAtOrUnder(entry: EntryNumber, top: EntryNumber): boolean {
  return entry === top || entry.startsWith(`${top}.`)
}

/** Orders entries by their numbers, such as #9 before #10 and #10 before #10.1. */
export function compareEntries(one: EntryNumber, other: EntryNumber): number {
  return ENTRY_ORDER.compare(one, other)
}

function isEntryNumber(text: string): text is EntryNumber {
  return ENTRY_NUMBER_PATTERN.test(text)
}
