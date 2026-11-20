import { HintKindName } from './hintKind'
import type { HintKind } from './hintKind'
import { EMPHASIS, HEADING_MARK, LIST_MARK } from './lineMarks'
import { phrase } from './phrase'
import { SAYING_WITHOUT_WORK, WORK_GERUND, WORK_VERB } from './workVerbs'

/** The start of a sentence or clause: the start of a line past any list mark or heading mark, or
 * the place after a stop, colon, semicolon, comma, dash or "and", in both cases past any
 * emphasis. */
const SENTENCE_START =
  String.raw`(?:^[ \t]*${LIST_MARK}${HEADING_MARK}|[.!?:;,]\s+|\s*[—–]\s*|\s-\s+|\band\s+)` +
  EMPHASIS
const NEXT = String.raw`next(?:[ \t]+(?:steps?|up)|[ \t-]+in[ \t-]+line)?`
const NEXT_LABEL = String.raw`(?:(?:what['’]s|up)[ \t]+)?${NEXT}`
const NEXT_LEAD = String.raw`(?:(?:up|the|my|our)[ \t]+)?${NEXT}`
/** What follows "next is" when the next thing is no work, such as "up to you" or "your call". */
const NOT_WORK_NEXT = String.raw`${EMPHASIS}\s+(?:up\s+to|your|yours|not)\b`
const PLAN_LEAD = String.raw`(?:then|${NEXT_LEAD}|after\s+that|afterwards|first|finally)`
const WILL = String.raw`(?:['’]ll|\s+will|(?:['’](?:m|re)|\s+(?:am|are))\s+(?:going|about)\s+to)`
/** A plan said after a condition, as in "if you want, I'll rebase", waits on that condition. It
 * looks back from the end of the plan's start, so it runs only where a plan starts. */
const NOT_AFTER_CONDITION =
  String.raw`(?<!\b(?:if|once|when|whenever|unless|as\s+soon\s+as)\b[^.!?\n]*)`

/** The source of an expression for the start of a plan up to its verb, past any emphasis: what
 * leads it, "I" or "we", then the form of "will". */
function planStart(lead: string, will: string): string {
  return String.raw`${lead}(?:I|we)${will}${NOT_AFTER_CONDITION}\s+${EMPHASIS}`
}

/** A plan said after a lead word, as in "then I'll rebase", or without one, as in "I'll rebase". */
const PLAN_WITH_LEAD = planStart(String.raw`${SENTENCE_START}${PLAN_LEAD},?\s+`, `${WILL}?`)
const PLAN_WITHOUT_LEAD = planStart(String.raw`\b`, WILL)
/** A plan said after "next" is work for after the turn, so any verb names work, as in "Next I'll
 * resolve API#33". The other leads also order steps told in the message itself, as in "first
 * I'll explain", so they need a work verb. */
const NEXT_PLAN = planStart(String.raw`${SENTENCE_START}${NEXT_LEAD},?\s+`, WILL)
const I_AM_OR_WE_ARE = String.raw`\b(?:I(?:['’]m|\s+am)|we(?:['’]re|\s+are))`
const SELF_NOW =
  String.raw`${I_AM_OR_WE_ARE}\s+(?:(?:now|currently|still|also|meanwhile|already)\s+)?`

/** The hint after a message that announces work as next or as underway while the turn ends. */
export const ANNOUNCED_WORK_HINT: HintKind<HintKindName.AnnouncedWork> = {
  name: HintKindName.AnnouncedWork,
  phrases: [
    new RegExp(
      String.raw`${SENTENCE_START}${NEXT_LABEL}${EMPHASIS}[ \t]*(?::|${EMPHASIS}[ \t]*$)`,
      'im',
    ),
    new RegExp(
      String.raw`${SENTENCE_START}${NEXT_LEAD}\s+(?:is|are|comes)\b(?!${NOT_WORK_NEXT})`,
      'im',
    ),
    new RegExp(String.raw`(?:${PLAN_WITH_LEAD}|${PLAN_WITHOUT_LEAD})${WORK_VERB}`, 'im'),
    new RegExp(String.raw`${NEXT_PLAN}(?!${SAYING_WITHOUT_WORK})[a-z]`, 'im'),
    /\b(?:now\s+I['’]ll|I['’]ll\s+now)\b/i,
    /\bwhat\s+(?:I|we)(?:['’]m|\s+am|['’]re|\s+are|['’]ll|\s+will)\s+(?:doing|do)\s+next\b/i,
    phrase(
      String.raw`${I_AM_OR_WE_ARE}\s+not\s+stopping\b(?!\s+(?:the|a|an|it|this|that|them)\b)`,
    ),
    phrase(String.raw`${SELF_NOW}${WORK_GERUND}`),
    phrase(String.raw`\blet\s+me\s+${WORK_VERB}`),
  ],
  text: [
    'Your message announces work as next or as underway, and your turn is ending. If no running ' +
      'task, workflow or agent does that work, start the work now, in this turn. If one does, ' +
      'say in your message which one does the work. If the work cannot start, remove the claim ' +
      'and say what the work waits on.',
  ],
}
