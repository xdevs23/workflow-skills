/**
 * A hint for the model, added to the next prompt after a turn ended on a message with one of its
 * phrases.
 */
export type HintKind = {
  phrases: readonly RegExp[]
  text: string
}
