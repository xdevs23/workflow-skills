import { HintKindName, HintRoastKept } from './hintKind'
import { labelledLine } from './lineMarks'
import type { Refusal } from './refusal'

const COST_WORDS = String.raw`(?:what[ \t]+(?:it|that)[ \t]+costs|the[ \t]+cost|cost)`

/** A line or bullet labelled as the cost of an option, such as one that opens on "Cost:". */
export const COST_FRAMING: Refusal<HintKindName.CostFraming> = {
  name: HintKindName.CostFraming,
  pattern: new RegExp(labelledLine(COST_WORDS), 'im'),
  reason: [
    'Your text labels a decision as a cost. A good engineering decision and proper architecture ' +
      'are never a cost: the cost comes from the wrong design that now has to change. Look at ' +
      'the option again, choose the right design and build that design. Do not present the ' +
      'design as a cost.',
  ],
  roaster: {
    task:
      'The reply labels a decision as a cost. Name the wrong design that the cost comes from, ' +
      'and the design that the assistant could build in this turn in its place. A cost that ' +
      'concerns no design in the work, such as the price of a service the user asked about, is ' +
      'not a point.',
    kept: HintRoastKept.UntilUserMessage,
  },
}
