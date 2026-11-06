/** The step shared by the hints that find a session idle: look for work that is still open. */
export const CHECK_FOR_OPEN_WORK =
  'Read the result of every run and build that ended, and fix every failure. Pick up every ' +
  'todo that is IN PROGRESS or QUEUED.'

/** The use of idle time shared by the hints that find a session idle, once no work is open. */
export const OPTIMIZE_IDLE_TIME =
  'Only when nothing is left, use the time to make builds faster, the memory footprint ' +
  'smaller, iteration times shorter or workflows more efficient. Make the change in the code ' +
  'itself: run work in parallel, drop work that is not needed, do it more efficiently or cache ' +
  'it for the next run. Do not add services, daemons, hooks or other resident processes to the ' +
  'operating system. Pick one and start it now, in this turn.'
