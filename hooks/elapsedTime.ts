import { MONTH_AND_DAY, TIME_OF_DAY } from './dayAndTime'
import { DAY, HOUR, MINUTE } from './timeUnits'
import type { UnitOfTime } from './timeUnits'

/** A unit an elapsed time is counted in, with the format of the time at which it started. */
type CountedUnit = { unit: UnitOfTime; start: Intl.DateTimeFormat }

/** The units an elapsed time is counted in, longest first. */
const COUNTED_UNITS: readonly CountedUnit[] = [
  { unit: DAY, start: MONTH_AND_DAY },
  { unit: HOUR, start: TIME_OF_DAY },
  { unit: MINUTE, start: TIME_OF_DAY },
]

const UNDER_A_MINUTE = 'less than a minute'

/** An elapsed time, such as "13 days", and the time at which it started, such as "Nov 9". */
export type ElapsedTime = { elapsed: string; start: string }

/**
 * The time from `start` to `end` in the longest unit it fills, rounded down, such as "13 days"
 * since "Nov 9" and "2 hours" since "06:10". A time shorter than a minute is "less than a minute",
 * also one that ends before it starts, after the clock of the machine was set back.
 */
export function describeElapsedTime(start: number, end: number): ElapsedTime {
  const elapsed = end - start
  const counted = COUNTED_UNITS.find(({ unit }) => elapsed >= unit.milliseconds)

  return counted === undefined
    ? { elapsed: UNDER_A_MINUTE, start: TIME_OF_DAY.format(start) }
    : {
        elapsed: counted.unit.amount.format(Math.floor(elapsed / counted.unit.milliseconds)),
        start: counted.start.format(start),
      }
}
