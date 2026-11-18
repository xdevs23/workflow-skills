import type { HintKind } from './hintKind'
import { EMPHASIS, LIST_MARK } from './lineMarks'
import { phrase } from './phrase'

/** "Run" as in running code, not "run out" or "run into". */
const NOT_RUN_OFF = String.raw`(?!\s+(?:out|into|across|over)\b)`
const CHECKED = String.raw`(?:checked|verified|tested|r[au]n${NOT_RUN_OFF})`
const CHECK = String.raw`(?:check|verify|test|run${NOT_RUN_OFF})`
const NOT = String.raw`(?:\s+not|n['’]t)`
const HAVE = String.raw`(?:\s+have|['’]ve)`

/**
 * The hint after a message that reports work as not checked, not verified or not tested, in the
 * first person, as in "I haven't verified the reload path", or as a sentence that opens on it, as
 * in "Not yet tested on hardware."
 */
export const UNVERIFIED_WORK_HINT: HintKind = {
  phrases: [
    phrase(String.raw`\b(?:I|we)(?:${HAVE}${NOT}|${HAVE}?\s+never)\s+(?:yet\s+)?${CHECKED}\b`),
    phrase(String.raw`\b(?:I|we)(?:\s+(?:did|could|can)${NOT}|\s+cannot)\s+${CHECK}\b`),
    new RegExp(
      String.raw`(?:^[ \t]*${LIST_MARK}|[.!?]\s+)${EMPHASIS}not\s+(?:yet\s+)?${CHECKED}\b`,
      'im',
    ),
  ],
  text: [
    'Your message reports work as not checked, not verified or not tested. Check that work now ' +
      'by running the code path changed by the work, and report what you observed.',
  ],
}
