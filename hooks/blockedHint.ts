import { AT_CLAUSE_END } from './clauses'
import { HintKindName } from './hintKind'
import type { HintKind } from './hintKind'
import { CHECK_FOR_OPEN_WORK } from './openWork'
import { phrase } from './phrase'
import { WAITING_FOR_YOU } from './waitingHint'

/** "Right now" or the end of the clause, after "nothing can start". A start followed by an object,
 * as in "nothing can start the server twice", gets no hint. */
const RIGHT_NOW_OR_CLAUSE_END = String.raw`(?:${AT_CLAUSE_END}|\s+right\s+now\b)`

/** The hint after a message that reports work as blocked or idle. */
export const BLOCKED_HINT: HintKind<HintKindName.Blocked> = {
  name: HintKindName.Blocked,
  phrases: [
    /\bstill\s+blocked\b/i,
    /\b(?:is|are|stays|remains)\s+blocked\s+on\b/i,
    /\b(?:can['’]t|cannot|can\s+not)\s+continue\b/i,
    /\bneeds\s+you\b/i,
    /\bnothing\s+to\s+do\b(?!\s+with\b)/i,
    /\bno\s+workflows\s+(?:are\s+)?running\b/i,
    /\bnothing\s+is\s+running\b(?!\s+on\b)/i,
    /\bnothing\s+has\s+changed\b(?!\s+in\b)/i,
    /(?:^|[.!?:])\s*(?:still\s+)?no\s+change\b(?!\s+(?:to|in)\b)/im,
    /\bnothing\s+new\s+came\s+in\b/i,
    phrase(String.raw`\bnothing\s+can\s+start${RIGHT_NOW_OR_CLAUSE_END}`),
    /\beverything\s+left\s+is\s+blocked\b/i,
    /\beverything\s+left\s+waits\s+on\s+you(?:r)?\b/i,
    WAITING_FOR_YOU,
    /\bnext\s+time\s+you(?:['’]re|\s+are)\s+(?:here|back|around)\b/i,
    /\b(?:once|when)\s+you(?:['’]re|\s+are)\s+back\b/i,
    /\bwhat(?:['’]s|\s+is)\s+left\s+for\s+you\b(?![\s:,—–-]*(?:nothing|none)\b)/i,
  ],
  text: [
    CHECK_FOR_OPEN_WORK,
    'If nothing is startable, try splitting up the blocked units into smaller sub-units and ' +
      "start the ones that don't depend on the blocker.",
  ],
  roasterTask:
    'The reply reports work as blocked or idle. Name what it says blocks the work, and the work ' +
    'that the assistant could start in this turn without that blocker.',
}
