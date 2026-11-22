// The units of time: their lengths in milliseconds, the unit of the clock and the timers of the
// engine, and the format of an amount of each.

export const MILLISECONDS_PER_SECOND = 1000

export const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND

export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE

export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR

/** A unit of time: its length in milliseconds and the format of an amount of it. */
export type UnitOfTime = { milliseconds: number; amount: Intl.NumberFormat }

export const MINUTE: UnitOfTime = {
  milliseconds: MILLISECONDS_PER_MINUTE,
  amount: amountFormatOf('minute'),
}

export const HOUR: UnitOfTime = {
  milliseconds: MILLISECONDS_PER_HOUR,
  amount: amountFormatOf('hour'),
}

export const DAY: UnitOfTime = {
  milliseconds: MILLISECONDS_PER_DAY,
  amount: amountFormatOf('day'),
}

/** Writes an amount of `unit` with the name of the unit, such as "1 hour" and "13 days". */
function amountFormatOf(unit: 'minute' | 'hour' | 'day'): Intl.NumberFormat {
  return new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long' })
}
