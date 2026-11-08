import { COST_FRAMING } from './costFraming'
import { HANDED_DECISION } from './handedDecision'
import { withoutQuotedText } from './quotedText'
import type { Refusal } from './refusal'

/** Every shape of text refused at the end of a turn and in an asked question. */
export const REFUSALS: readonly Refusal[] = [HANDED_DECISION, COST_FRAMING]

/** The refusals whose shape the text has outside its quoted text, in the order of `REFUSALS`. */
export function refusalsIn(text: string): Refusal[] {
  const said = withoutQuotedText(text)

  return REFUSALS.filter(({ pattern }) => pattern.test(said))
}
