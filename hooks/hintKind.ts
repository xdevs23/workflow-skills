/**
 * A hint for the model about a message with one of its phrases: the reason with which the end of a
 * turn on that message is blocked, and the context of the next prompt when the turn still ends on
 * such a message.
 */
export type HintKind = {
  phrases: readonly RegExp[]
  text: string
}
