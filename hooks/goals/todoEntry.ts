import type { AttachedTodo } from '../../types'

const TODO_NUMBER = /^[1-9]\d*(?:\.[1-9]\d*)*$/
/**
 * A TODO entry as its heading in TODO.md shows it, without the state: `#41 - Title`, with white
 * space around it. The title is one line, without control characters or separators of lines and
 * paragraphs.
 */
const ENTRY_HEADING = /^\s*#(?<number>\S+) - (?<title>[^\p{Cc}\p{Zl}\p{Zp}]*?)\s*$/u
/** A TODO entry by its number alone, with white space around it: `#41`. */
const ENTRY_NUMBER = /^\s*#(?<number>\S+)\s*$/

/** The number and the title of a TODO entry, as its heading in TODO.md shows them. */
export type TodoEntry = Pick<AttachedTodo, 'number' | 'title'>

/** Whether the value is the number of an entry in TODO.md, such as 41, or 41.1 for a sub-unit. */
export function isTodoNumber(value: unknown): value is string {
  return typeof value === 'string' && TODO_NUMBER.test(value)
}

/** The number of a TODO entry as TODO.md writes it: `#41`. */
export function describeTodoNumber(number: string): string {
  return `#${number}`
}

/** The heading of the TODO entry in TODO.md, without the state: `#41 - Title`. */
export function describeEntry(todo: TodoEntry): string {
  return `${describeTodoNumber(todo.number)} - ${todo.title}`
}

/**
 * Reads `#41 - Title` into the entry, without the white space around the title. Returns undefined
 * for text in another form, such as a title over several lines.
 */
export function readEntryHeading(text: string): TodoEntry | undefined {
  const parts = ENTRY_HEADING.exec(text)?.groups
  if (parts?.number === undefined || parts.title === undefined) {
    return undefined
  }

  return { number: parts.number, title: parts.title.trim() }
}

/** Reads the number in `#41`, undefined for text in another form. */
export function readEntryNumber(text: string): string | undefined {
  return ENTRY_NUMBER.exec(text)?.groups?.number
}
