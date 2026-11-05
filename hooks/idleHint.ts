import type { HintKind } from './hintKind'
import { CHECK_FOR_OPEN_WORK } from './openWork'

/** Leaves out a report scoped to one part, such as "nothing needs attention in the parser". */
const FOR_THE_WHOLE = String.raw`(?!\s+(?:in|for|with|on(?!\s+(?:your|my)\b))\b)`

/** Leaves out a past report with an end or an exception, such as "nothing needed action until …". */
const UP_TO_NOW = String.raw`(?!\s+(?:until|before|after|since|during|while|except|besides|apart\s+from|other\s+than)\b)`

/** The thing that needs doing, with an optional word before it, such as "your attention". */
const NEEDED_THING = String.raw`(?:(?:my|your|any|further|more)\s+)?(?:action|attention|doing|to\s+be\s+done)\b`

/** The hint after a message that reports that nothing needs action. */
export const IDLE_HINT: HintKind = {
  phrases: [
    new RegExp(String.raw`\bnothing(?:\s+else)?\s+(?:needs|requires|calls\s+for)\s+${NEEDED_THING}${FOR_THE_WHOLE}`, 'i'),
    new RegExp(String.raw`\bnothing(?:\s+else)?\s+(?:(?:has|had)\s+)?(?:needed|required|called\s+for)\s+${NEEDED_THING}${FOR_THE_WHOLE}${UP_TO_NOW}`, 'i'),
    new RegExp(String.raw`\bno\s+(?:further\s+|more\s+)?action\s+(?:is\s+)?(?:needed|required|necessary)\b${FOR_THE_WHOLE}`, 'i'),
    new RegExp(String.raw`\bno\s+(?:further\s+|more\s+)?actions?\s+(?:was|were|has\s+been|had\s+been)\s+(?:needed|required|necessary|called\s+for)\b${FOR_THE_WHOLE}${UP_TO_NOW}`, 'i'),
    /\bnothing\s+(?:to\s+act\s+on|actionable)\b/i,
  ],
  text:
    `Your message reports that nothing needs action. Check that claim first. ${CHECK_FOR_OPEN_WORK} ` +
    'Only when nothing is left, use the time to make builds faster, the memory footprint ' +
    'smaller, iteration times shorter or workflows more efficient. Make the change in the code ' +
    'itself: run work in parallel, drop work that is not needed, do it more efficiently or cache ' +
    'it for the next run. Do not add services, daemons, hooks or other resident processes to the ' +
    'operating system. Pick one and start it now, in this turn.',
}
