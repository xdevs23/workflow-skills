import type { HintKind } from './hintKind'

/** Leaves out a report scoped to one part, such as "nothing needs attention in the parser". */
const FOR_THE_WHOLE = String.raw`(?!\s+(?:in|for|with|on(?!\s+(?:your|my)\b))\b)`

/** The hint after a message that reports that nothing needs action. */
export const IDLE_HINT: HintKind = {
  phrases: [
    new RegExp(String.raw`\bnothing\s+(?:needs|requires|calls\s+for)\s+(?:action|attention|doing|to\s+be\s+done)\b${FOR_THE_WHOLE}`, 'i'),
    new RegExp(String.raw`\bno\s+(?:further\s+|more\s+)?action\s+(?:is\s+)?(?:needed|required|necessary)\b${FOR_THE_WHOLE}`, 'i'),
    /\bnothing\s+(?:to\s+act\s+on|actionable)\b/i,
  ],
  text:
    'Your message reports that nothing needs action. Use the time to make builds faster, the ' +
    'memory footprint smaller, iteration times shorter or workflows more efficient. Make the ' +
    'change in the code itself: run work in parallel, drop work that is not needed, do it more ' +
    'efficiently or cache it for the next run. Do not add services, daemons, hooks or other ' +
    'resident processes to the operating system. Pick one and start it now, in this turn.',
}
