import type { AttachedTodo } from '../../types'
import { readEntryNumber } from '../todoEntry'

/**
 * A TODO entry as its heading in TODO.md shows it, without the state: `#41 - Title`, with white
 * space around it. The title is one line, without control characters or separators of lines and
 * paragraphs.
 */
const ENTRY_HEADING = /^\s*(?<number>#\S+) - (?<title>[^\p{Cc}\p{Zl}\p{Zp}]*?)\s*$/u

/** The number and the title of a TODO entry, as its heading in TODO.md shows them. */
export type TodoEntry = Pick<AttachedTodo, 'number' | 'title'>

/** The heading of the TODO entry in TODO.md, without the state: `#41 - Title`. */
export function describeEntry(todo: TodoEntry): string {
  return `${todo.number} - ${todo.title}`
}

/**
 * Reads `#41 - Title` into the entry, without the white space around the title. Returns undefined
 * for text in another form, such as a title over several lines.
 */
export function readEntryHeading(text: string): TodoEntry | undefined {
  const parts = ENTRY_HEADING.exec(text)?.groups
  const number = readEntryNumber(parts?.number)
  if (number === undefined || parts?.title === undefined) {
    return undefined
  }

  return { number, title: parts.title.trim() }
}
