/** The message of an error, or the text of a rejection value that is not an Error. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
