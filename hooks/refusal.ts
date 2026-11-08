/** A shape of text refused at the end of a turn and in an asked question, with the reason why. */
export type Refusal = {
  pattern: RegExp
  reason: string
}
