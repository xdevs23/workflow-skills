import type { HintKind } from './hintKind'

/** Text up to the end of the sentence: a stop counts only before a space, and a line break only
 * before a blank line, an indented line or a list item. */
const SENTENCE = String.raw`(?:[^.!?\n]|[.!?](?=\S)|\n(?![\s\-*•]|\d+[.)]))*`
/** Text up to the end of the clause, which also ends at a comma, a semicolon, a colon or a dash. */
const CLAUSE = String.raw`(?:[^.!?\n,;:—–]|[.!?](?=\S))*`
const COUNT = String.raw`(?:an?|one|two|three|four|five|several|some|a\s+few|[1-9]\d*)`
const MESSAGE = String.raw`(?:messages?|repl(?:y|ies)|turns?|posts?)`
const EARLIER_MESSAGE = String.raw`(?:\bmy\s+(?:previous|earlier|prior|last|other)\s+${MESSAGE}|\bmy\s+${MESSAGE}\s+(?:before|above)|\b${MESSAGE}\s+(?:above|before\s+the\s+last)|\b(?:two|three|[2-9])\s+${MESSAGE}\s+ago)\b`
const ASKED = String.raw`\b(?:questions?|asked)\b`
const OPEN_STATE = String.raw`(?:open|unanswered|pending|outstanding|unresolved|there|in\s+my|above)\b`

const phrase = (source: string): RegExp => new RegExp(source, 'i')

/** The hint after a message that waits for an answer from the user. */
export const WAITING_HINT: HintKind = {
  phrases: [
    /\bstill\s+open\b/i,
    /\bstill\s+unanswered\b/i,
    /\bstill\s+pending\b/i,
    /\bstill\s+waiting\b/i,
    /\b(?:waiting|waits)\s+(?:for|on)\s+you(?:r)?\b/i,
    /\bawait(?:s|ing)?\s+your\b/i,
    phrase(String.raw`\byour\s+answer\s+on\s+${SENTENCE}\s+is\s+still\b`),
    /\b(?:once|until)\s+you\s+answer\b/i,
    /\bonce\s+you(?:['’]ve|\s+have)\s+answered\b/i,
    /\bneeds\s+your\s+(?:answer|approval|go)\b/i,
    phrase(String.raw`\bstill\s+(?:have|has)\s+(?:${COUNT}\s+)?(?:more\s+)?(?:open\s+questions?\b|questions?\b${CLAUSE}\bfor\s+you\b)`),
    phrase(String.raw`\bquestions?\b${CLAUSE}(?:\s+(?:is|are|remains?|stays?)|['’](?:s|re))\s+(?:still\s+)?${OPEN_STATE}`),
    phrase(String.raw`\bquestions?\b${CLAUSE}\b(?:still\s+(?:stands?|applies|needs?)|(?:has|have|is|are)\s+not\s+(?:yet\s+)?(?:been\s+)?answered)\b`),
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
