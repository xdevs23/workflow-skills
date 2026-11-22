const DAY_OPTIONS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}

/** A day and a time of day in the time zone set on the machine, such as "Nov 8, 15:00". */
export const DAY_AND_TIME = new Intl.DateTimeFormat('en', { ...DAY_OPTIONS, ...TIME_OPTIONS })

/** A time of day in the time zone set on the machine, such as "15:00". */
export const TIME_OF_DAY = new Intl.DateTimeFormat('en', TIME_OPTIONS)

/** A day in the time zone set on the machine, such as "Nov 8". */
export const MONTH_AND_DAY = new Intl.DateTimeFormat('en', DAY_OPTIONS)
