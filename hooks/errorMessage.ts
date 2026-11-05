/** The message of an error, or the text of a rejection value that is not an Error. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Whether `error` is an Error whose message contains `text`. The engine types do not define an
 * error class for a rejection of an engine call, so such a rejection is recognized by its text.
 */
export function isErrorWithText(error: unknown, text: string): error is Error {
  return error instanceof Error && error.message.includes(text)
}
