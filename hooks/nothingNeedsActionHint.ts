import type { HintKind } from './hintKind'
import { CHECK_FOR_OPEN_WORK, OPTIMIZE_IDLE_TIME } from './openWork'
import { phrase } from './phrase'

/** Leaves out a report scoped to one part, such as "nothing needs attention in the parser". */
const FOR_THE_WHOLE = String.raw`(?!\s+(?:in|for|with|on(?!\s+(?:your|my)\b))\b)`

const END_OR_EXCEPTION =
  String.raw`(?:until|before|after|since|during|while|except|besides|apart\s+from|other\s+than)`

/**
 * Leaves out a past report with an end or an exception, such as "nothing needed action until …".
 */
const UP_TO_NOW = String.raw`(?!\s+${END_OR_EXCEPTION}\b)`

/** The thing that needs doing, with an optional word before it, such as "your attention". */
const NEEDED_THING =
  String.raw`(?:(?:my|your|any|further|more)\s+)?(?:action|attention|doing|to\s+be\s+done)\b`

/** The hint after a message that reports that nothing needs action. */
export const NOTHING_NEEDS_ACTION_HINT: HintKind = {
  phrases: [
    phrase(
      String.raw`\bnothing(?:\s+else)?\s+(?:needs|requires|calls\s+for)\s+` +
        String.raw`${NEEDED_THING}${FOR_THE_WHOLE}`,
    ),
    phrase(
      String.raw`\bnothing(?:\s+else)?\s+(?:(?:has|had)\s+)?(?:needed|required|called\s+for)\s+` +
        String.raw`${NEEDED_THING}${FOR_THE_WHOLE}${UP_TO_NOW}`,
    ),
    phrase(
      String.raw`\bno\s+(?:further\s+|more\s+)?action\s+(?:is\s+)?` +
        String.raw`(?:needed|required|necessary)\b${FOR_THE_WHOLE}`,
    ),
    phrase(
      String.raw`\bno\s+(?:further\s+|more\s+)?actions?\s+(?:was|were|has\s+been|had\s+been)\s+` +
        String.raw`(?:needed|required|necessary|called\s+for)\b${FOR_THE_WHOLE}${UP_TO_NOW}`,
    ),
    /\bnothing\s+(?:to\s+act\s+on|actionable)\b/i,
  ],
  text:
    'Your message reports that nothing needs action. Check that claim first. ' +
    `${CHECK_FOR_OPEN_WORK} ${OPTIMIZE_IDLE_TIME}`,
}
