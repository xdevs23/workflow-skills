import type { SelectOption } from 'claude-code'

import { CadenceProblem, FieldKind } from './cadenceKind'
import type { CadenceKind } from './cadenceKind'

// The cadence kind "every", which sends a reminder every given number of minutes or hours: the
// fields of its card, how their values are read, and its cadence line.

/** The units of the interval of a reminder, stored by these values. */
export enum TimeUnit {
  Minutes = 'minutes',
  Hours = 'hours',
}

const MILLISECONDS_PER_MINUTE = 60_000

/**
 * A unit by its length, how the cadence line and the dropdown write an amount of it, and the label
 * of the field the amount is typed into.
 */
type UnitOfTime = { milliseconds: number; amount: Intl.NumberFormat; amountLabel: string }

const UNITS: Record<TimeUnit, UnitOfTime> = {
  [TimeUnit.Minutes]: {
    milliseconds: MILLISECONDS_PER_MINUTE,
    amount: amountFormatOf('minute'),
    amountLabel: 'Minutes',
  },
  [TimeUnit.Hours]: {
    milliseconds: 60 * MILLISECONDS_PER_MINUTE,
    amount: amountFormatOf('hour'),
    amountLabel: 'Hours',
  },
}

/** Writes an amount of `unit` in words, such as "1 hour" and "2 hours". */
function amountFormatOf(unit: 'minute' | 'hour'): Intl.NumberFormat {
  return new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long' })
}

/**
 * The option of `unit` in the dropdown beside the amount typed as `typed`, such as "1" and "hour".
 */
function unitOptionOf(unit: TimeUnit, typed: string): SelectOption {
  const words = UNITS[unit].amount.formatToParts(Number(typed)).filter(part => part.type === 'unit')

  return { value: unit, label: words.map(part => part.value).join('') }
}

/** The settings of a reminder of the kind: the amount and unit of the time between due times. */
export type TimeSettings = { amount: number; unit: TimeUnit }

const WHOLE_NUMBER = /^[1-9]\d*$/u

const AMOUNT_PROBLEM = 'Type how many, as a whole number from 1.'

const UNIT_PROBLEM = 'Pick minutes or hours.'

const EVERY = 'every'

/** The label of the amount on a card whose unit this version cannot read. */
const AMOUNT_LABEL = 'Amount'

export const TIME_KIND: CadenceKind<TimeSettings, 'amount' | 'unit'> = {
  id: 'every',
  label: EVERY,
  fields: [
    {
      kind: FieldKind.Text,
      key: 'amount',
      label: valueOf => amountLabelOf(valueOf('unit')),
      initial: '1',
    },
    {
      kind: FieldKind.Choice,
      key: 'unit',
      options: valueOf => [
        unitOptionOf(TimeUnit.Hours, valueOf('amount')),
        unitOptionOf(TimeUnit.Minutes, valueOf('amount')),
      ],
    },
  ],
  read: valueOf => {
    const unit = valueOf('unit')
    if (!isTimeUnit(unit)) {
      return new CadenceProblem(UNIT_PROBLEM)
    }
    const typed = valueOf('amount').trim()
    const settings = { amount: Number(typed), unit }

    return WHOLE_NUMBER.test(typed) && Number.isSafeInteger(intervalOf(settings))
      ? settings
      : new CadenceProblem(AMOUNT_PROBLEM)
  },
  describe: ({ amount, unit }) => `${EVERY} ${UNITS[unit].amount.format(amount)}`,
}

/** The time between two due times of a reminder with `settings`, in milliseconds. */
export function intervalOf({ amount, unit }: TimeSettings): number {
  return amount * UNITS[unit].milliseconds
}

/** The label of the amount on a card with the unit `unit` picked. */
function amountLabelOf(unit: string): string {
  return isTimeUnit(unit) ? UNITS[unit].amountLabel : AMOUNT_LABEL
}

function isTimeUnit(text: string): text is TimeUnit {
  return Object.values<string>(TimeUnit).includes(text)
}
