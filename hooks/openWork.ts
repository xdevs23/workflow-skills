import type { SharedStep } from './hintText'

/** The step shared by the hints that find a session idle: look for work that is still open. */
export const CHECK_FOR_OPEN_WORK: SharedStep = {
  text:
    'Read the result of every run and build that ended, and fix every failure. Pick up every ' +
    'todo that is IN PROGRESS or READY.',
}

/** The use of idle time shared by the hints that find a session idle, once no work is open. */
export const OPTIMIZE_IDLE_TIME: SharedStep = {
  text:
    'Only when nothing is left, use the time to make builds faster, the memory footprint ' +
    'smaller, iteration times shorter or workflows more efficient. Make the change in the code ' +
    'itself: run work in parallel, drop work that is not needed, do the needed work more ' +
    'efficiently or cache the result of that work for the next run. Do not add services, ' +
    'daemons, hooks or other resident processes to the operating system. Pick one such change ' +
    'and start that change now, in this turn.',
}
