import type { HintKind } from './hintKind'

/** The hint after a message that reports that nothing needs action. */
export const IDLE_HINT: HintKind = {
  phrases: [
    /\bnothing\s+(?:needs|requires|calls\s+for)\s+(?:action|attention|doing)\b/i,
    /\bno\s+action\s+(?:is\s+)?(?:needed|required)\b/i,
    /\bnothing\s+(?:to\s+act\s+on|actionable)\b/i,
  ],
  text:
    'Your message reports that nothing needs action. Use the time for optimizations: speed up ' +
    'builds, reduce memory footprint, shorten iteration times and make workflows more ' +
    'efficient. Optimize the code itself: run work in parallel, drop work that is not needed, ' +
    'do it more efficiently or cache it for the next run. Do not add services, daemons, hooks or ' +
    'other resident processes to the operating system to keep things alive or warm. Pick one ' +
    'and start it now, in this turn.',
}
