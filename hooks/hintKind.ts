/**
 * A hint for the model, given as the reason when the end of a turn on a message with one of its
 * phrases is blocked.
 */
export type HintKind = {
  phrases: readonly RegExp[]
  text: string
}
