/** A day and a time of day in the time zone of the machine, such as "Nov 8, 15:00". */
export const DAY_AND_TIME = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
