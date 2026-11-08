import type { HintKind } from './hintKind'
import { EMPHASIS, HEADING_MARK, LIST_MARK } from './lineMarks'
import { WORK_GERUND, WORK_VERB } from './workVerbs'

/** The start of a sentence or clause: the start of a line past any list mark or heading mark, or
 * the place after a stop, colon, semicolon, comma, dash or "and", in both cases past any emphasis. */
const SENTENCE_START = String.raw`(?:^[ \t]*${LIST_MARK}${HEADING_MARK}|[.!?:;,]\s+|\s*[—–]\s*|\s-\s+|\band\s+)${EMPHASIS}`
const NEXT = String.raw`next(?:[ \t]+(?:steps?|up)|[ \t-]+in[ \t-]+line)?`
const NEXT_LABEL = String.raw`(?:(?:what['’]s|up)[ \t]+)?${NEXT}`
const NEXT_LEAD = String.raw`(?:(?:up|the|my|our)[ \t]+)?${NEXT}`
/** What follows "next is" when the next thing is no work, such as "up to you" or "your call". */
const NOT_WORK_NEXT = String.raw`${EMPHASIS}\s+(?:up\s+to|your|yours|not)\b`
const PLAN_LEAD = String.raw`(?:then|${NEXT_LEAD}|after\s+that|afterwards|first|finally)`
const WILL = String.raw`(?:['’]ll|\s+will|(?:['’](?:m|re)|\s+(?:am|are))\s+(?:going|about)\s+to)`
/** A plan said after a condition, as in "if you want, I'll rebase", waits on that condition. */
const NOT_AFTER_CONDITION = String.raw`(?<!\b(?:if|once|when|whenever|unless|as\s+soon\s+as)\b[^.!?\n]*)`
const SELF_NOW = String.raw`\b(?:I(?:['’]m|\s+am)|we(?:['’]re|\s+are))\s+(?:(?:now|currently|still|also|meanwhile|already)\s+)?`

/** The hint after a message that announces work as next or as underway while the turn ends. */
export const ANNOUNCED_WORK_HINT: HintKind = {
  phrases: [
    new RegExp(String.raw`${SENTENCE_START}${NEXT_LABEL}${EMPHASIS}[ \t]*(?::|${EMPHASIS}[ \t]*$)`, 'im'),
    new RegExp(String.raw`${SENTENCE_START}${NEXT_LEAD}\s+(?:is|are|comes)\b(?!${NOT_WORK_NEXT})`, 'im'),
    new RegExp(
      String.raw`${NOT_AFTER_CONDITION}(?:${SENTENCE_START}${PLAN_LEAD},?\s+(?:I|we)${WILL}?|\b(?:I|we)${WILL})\s+${WORK_VERB}`,
      'im',
    ),
    /\b(?:now\s+I['’]ll|I['’]ll\s+now)\b/i,
    /\bwhat\s+(?:I|we)(?:['’]m|\s+am|['’]re|\s+are|['’]ll|\s+will)\s+(?:doing|do)\s+next\b/i,
    /\b(?:I(?:['’]m|\s+am)|we(?:['’]re|\s+are))\s+not\s+stopping\b(?!\s+(?:the|a|an|it|this|that|them)\b)/i,
    new RegExp(String.raw`${SELF_NOW}${WORK_GERUND}`, 'i'),
    new RegExp(String.raw`\blet\s+me\s+${WORK_VERB}`, 'i'),
  ],
  text:
    'Your message announces work as next or as underway, and your turn is ending. If no running ' +
    'task, workflow or agent does that work, start it now, in this turn. If one does, say in your ' +
    'message which one does it. If the work cannot start, remove the claim and say what it waits ' +
    'on.',
}
