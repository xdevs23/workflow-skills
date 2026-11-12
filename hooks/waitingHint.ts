import { AT_CLAUSE_END } from './clauses'
import type { HintKind } from './hintKind'
import { phrase } from './phrase'
import { COUNT } from './quantityWords'

/** Text up to the end of the sentence: a stop counts only before a space, and a line break only
 * before a blank line, an indented line or a list item. */
const SENTENCE = String.raw`(?:[^.!?\n]|[.!?](?=\S)|\n(?![\s\-*•]|\d+[.)]))*`
/** Text up to the end of the clause, which also ends at a comma, a semicolon, a colon or a dash. */
const CLAUSE = String.raw`(?:[^.!?\n,;:—–]|[.!?](?=\S))*`
const MESSAGE = String.raw`(?:messages?|repl(?:y|ies)|turns?|posts?)`
const MY_EARLIER_MESSAGE = String.raw`\bmy\s+(?:previous|earlier|prior|last|other)\s+${MESSAGE}`
const MY_MESSAGE_BEFORE = String.raw`\bmy\s+${MESSAGE}\s+(?:before|above)`
const MESSAGE_ABOVE = String.raw`\b${MESSAGE}\s+(?:above|before\s+the\s+last)`
const MESSAGE_AGO = String.raw`\b(?:two|three|[2-9])\s+${MESSAGE}\s+ago`
const EARLIER_MESSAGE =
  String.raw`(?:${MY_EARLIER_MESSAGE}|${MY_MESSAGE_BEFORE}|${MESSAGE_ABOVE}|${MESSAGE_AGO})\b`
const ASKED = String.raw`\b(?:questions?|asked)\b`
const OPEN_WORD = String.raw`(?:open|unanswered|pending)`
const OPEN_STATE = String.raw`(?:${OPEN_WORD}|outstanding|unresolved|there|in\s+my|above)\b`
const NUMBER = String.raw`#?\d+`
/** Numbers listed one after the other, such as 2, 3 and 4. */
const NUMBERS = String.raw`${NUMBER}(?:(?:\s*,\s*|\s+and\s+)${NUMBER})*`
/** The numbers that name an item, such as 2, #21, (#21) or (#21, #22). */
const ITEM_NUMBER = String.raw`(?:\s+${NUMBERS}|\s*\(${NUMBERS}\))`
/** An item named after a pull request or an issue, whose state is not an open question. */
const NOT_AFTER_TRACKER = String.raw`(?<!\b(?:PRs?|pull\s+requests?|issues?)\b[^.!?\n]{0,40})`
/** What is left to the user besides a question, such as a decision or point 2. */
const OPEN_ITEM =
  String.raw`\b(?:decisions?|answers?|approvals?|choices?|points?|items?)${ITEM_NUMBER}?`

const HAVE_NOT_ANSWERED = String.raw`(?:have\s+not|haven['’]t)\s+(?:yet\s+)?answered`
const DID_NOT_ANSWER = String.raw`(?:did\s+not|didn['’]t)\s+(?:yet\s+)?answer`
const STILL_STANDS = String.raw`still\s+(?:stands?|applies|needs?)`
const IS_NOT_YET_ANSWERED = String.raw`(?:has|have|is|are)\s+not\s+(?:yet\s+)?(?:been\s+)?answered`

/** The hint after a message that waits for an answer from the user. */
export const WAITING_HINT: HintKind = {
  phrases: [
    phrase(
      String.raw`${NOT_AFTER_TRACKER}${OPEN_ITEM}(?:\s+(?:on|about|of|for|from)\b${CLAUSE})?` +
        String.raw`\s+(?:is|are|remains?|stays?)\s+still\s+${OPEN_WORD}\b`,
    ),
    phrase(String.raw`\bstill\s+${OPEN_WORD}\s*:`),
    phrase(
      String.raw`\b${OPEN_WORD}\s+from\s+(?:(?:earlier|before)${AT_CLAUSE_END}|${EARLIER_MESSAGE})`,
    ),
    /\bstill\s+waiting\b/i,
    /\b(?:waiting|waits)\s+(?:for|on)\s+you(?:r)?\b/i,
    /\bawait(?:s|ing)?\s+your\b/i,
    phrase(String.raw`\byour\s+answer\s+on\s+${SENTENCE}\s+is\s+still\b`),
    /(?<!\b(?:blocks?|holds?|stops?|pauses?)\b[^.!?\n]{0,40})\b(?:once|until)\s+you\s+answer\b/i,
    phrase(String.raw`\byou\s+(?:${HAVE_NOT_ANSWERED}|${DID_NOT_ANSWER})\b`),
    /\byou\s+have\s+yet\s+to\s+answer\b/i,
    /\bonce\s+you(?:['’]ve|\s+have)\s+answered\b/i,
    /\bneeds\s+your\s+(?:answer|approval|go)\b/i,
    phrase(
      String.raw`\bstill\s+(?:have|has)\s+(?:${COUNT}\s+)?(?:more\s+)?` +
        String.raw`(?:open\s+questions?\b|questions?\b${CLAUSE}\bfor\s+you\b)`,
    ),
    phrase(
      String.raw`\bquestions?\b${CLAUSE}(?:\s+(?:is|are|remains?|stays?)|['’](?:s|re))` +
        String.raw`\s+(?:still\s+)?${OPEN_STATE}`,
    ),
    phrase(String.raw`\bquestions?\b${CLAUSE}\b(?:${STILL_STANDS}|${IS_NOT_YET_ANSWERED})\b`),
    phrase(String.raw`${ASKED}${SENTENCE}${EARLIER_MESSAGE}`),
    phrase(String.raw`${EARLIER_MESSAGE}${SENTENCE}${ASKED}`),
    /\bmy\s+(?:earlier|previous|last|other)\s+questions?\b/i,
    /\bmy\s+questions?\s+(?:above|from\s+(?:before|earlier))\b/i,
    /\bquestions?\s+(?:I|we)\s+(?:asked|put|posted|raised)\b/i,
  ],
  text:
    "If you're waiting for an answer from the user, ensure you have first researched whether the " +
    'question is already answered by rules, instructions or older transcripts. Read around the ' +
    'context you find and do not trust markdown files in the project that paraphrase or take out ' +
    'of context what the user has said. Open the draft page of every question that has one for ' +
    'the user. Do not repeat open questions, and pick up independent work in the meantime.',
}
