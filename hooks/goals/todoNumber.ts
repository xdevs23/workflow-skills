const TODO_NUMBER = /^[1-9]\d*(?:\.[1-9]\d*)*$/

/** Whether the value is the number of an entry in TODO.md, such as 41, or 41.1 for a sub-unit. */
export function isTodoNumber(value: unknown): value is string {
  return typeof value === 'string' && TODO_NUMBER.test(value)
}
