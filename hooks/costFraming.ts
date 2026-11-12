import { EMPHASIS, LIST_MARK } from './lineMarks'
import type { Refusal } from './refusal'

const COST_WORDS = String.raw`(?:what[ \t]+(?:it|that)[ \t]+costs|the[ \t]+cost|cost)`

/** A line or bullet labelled as the cost of an option, such as one that opens on "Cost:". */
export const COST_FRAMING: Refusal = {
  pattern: new RegExp(
    String.raw`^[ \t]*${LIST_MARK}${EMPHASIS}${COST_WORDS}${EMPHASIS}[ \t]*:`,
    'im',
  ),
  reason:
    'It labels a decision as a cost. A good engineering decision and proper architecture are ' +
    'never a cost: the cost comes from the wrong design that now has to change. Look at the ' +
    'option again, choose the right design and build it, and do not present it as a cost.',
}
