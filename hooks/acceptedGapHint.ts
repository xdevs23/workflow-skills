import { HintKindName } from './hintKind'
import type { HintKind } from './hintKind'
import { labelledLine } from './lineMarks'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from './quotedText'

const TRADE_OFF = String.raw`${NO_LETTER_BEFORE}trade[\s\p{Pd}]?offs?${NO_LETTER_AFTER}`
const BOUNDARY = String.raw`boundar(?:y|ies)${NO_LETTER_AFTER}`
/** A boundary declared on the work. A bare "Boundary:" label stays out, since it also opens a test
 * case for a boundary value, and "module boundary" or "boundary between layers" name design. */
const BOUNDARY_FRAMING = [
  labelledLine(String.raw`(?:scope[ \t]+boundar(?:y|ies)|boundaries)`),
  String.raw`${NO_LETTER_BEFORE}(?:deliberate|accepted|chosen|narrowed)\s+${BOUNDARY}`,
].join('|')

/**
 * The hint after a message that names a trade-off, or declares a boundary on the work, such as
 * "There's one trade-off you might want to change", "Boundaries:" or "my narrowed boundary".
 */
export const ACCEPTED_GAP_HINT: HintKind<HintKindName.AcceptedGap> = {
  name: HintKindName.AcceptedGap,
  phrases: [new RegExp(`${TRADE_OFF}|${BOUNDARY_FRAMING}`, 'imu')],
  text: [
    'Your message names a trade-off or a boundary. Where your message calls a gap in the work ' +
      'a trade-off or a boundary, check whether the gap is real: read the code the gap concerns ' +
      'and run that code. Fix every gap that is real now. Do not label such a gap as a cost and ' +
      'do not ask the user to handle such a gap.',
  ],
}
