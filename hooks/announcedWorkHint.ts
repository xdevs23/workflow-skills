import type { HintKind } from './hintKind'

const LIST_MARK = String.raw`(?:[-*•][ \t]+)?`
const HEADING_MARK = String.raw`(?:#{1,6}[ \t]*)?`
const EMPHASIS = String.raw`(?:\*\*?|__?)?`
const NEXT_LABEL = String.raw`(?:(?:what['’]s|up)[ \t]+)?next(?:[ \t]+(?:steps?|up))?`
/** Gerunds of work, without sayings such as "reading this as", "working on the assumption" or
 * "checking in". */
const WORK_GERUND = String.raw`(?:working\s+out|working\s+on(?!\s+the\s+assumption\b)|looking\s+into|investigating|digging\s+into|reading(?!\s+(?:\S+\s+){0,3}?(?:as|right)\b)|checking(?!\s+in\b)|tracing|figuring\s+out|analy[sz]ing|researching|measuring|fixing|writing|implementing|building|rebasing|testing|reviewing|drafting|starting(?!\s+to\b)|stopping(?!\s+(?:here|now|for|at)\b)|restarting|launching|kicking\s+off|picking(?!\s+up\s+on\b)|running(?!\s+(?:out|low|short|late|behind)\b)|(?:going|carrying|moving)\s+on\s+with|(?:going|pressing)\s+ahead\s+with|continuing\s+with|proceeding\s+with|moving\s+on\s+to)`
const SELF_NOW = String.raw`\b(?:I(?:['’]m|\s+am)|we(?:['’]re|\s+are))\s+(?:(?:now|currently|still|also|meanwhile|already)\s+)?`
const WORK_VERB = String.raw`(?:look\s+into|check|investigate|dig\s+into|fix|work\s+out|figure\s+out|find\s+out|trace|read|try)`
const NEXT_ACTION = String.raw`(?:pick|start|run|launch|build|stop|restart|merge|push|open|fix|write|rebase|kick\s+off)`
const SENTENCE_START = String.raw`(?:^|[.!?:]\s+)`

/** The hint after a message that announces work as next or as underway while the turn ends. */
export const ANNOUNCED_WORK_HINT: HintKind = {
  phrases: [
    new RegExp(String.raw`^[ \t]*${LIST_MARK}${HEADING_MARK}${EMPHASIS}${NEXT_LABEL}${EMPHASIS}[ \t]*(?::|${EMPHASIS}[ \t]*$)`, 'im'),
    /(?:^|[.!?:]\s+)next(?:\s+(?:up|steps?))?,?\s+I(?:['’]ll|\s+will|['’]m|\s+am)\b/im,
    new RegExp(String.raw`${SENTENCE_START}next(?:\s+up)?\s+(?:is|are|comes)\b`, 'im'),
    new RegExp(String.raw`${SENTENCE_START}then\s+I(?:['’]ll|\s+will|\s+${NEXT_ACTION})\b`, 'im'),
    /\b(?:now\s+I['’]ll|I['’]ll\s+now)\b/i,
    /\bwhat\s+(?:I|we)(?:['’]m|\s+am|['’]re|\s+are|['’]ll|\s+will)\s+(?:doing|do)\s+next\b/i,
    /\b(?:I(?:['’]m|\s+am)|we(?:['’]re|\s+are))\s+not\s+stopping\b(?!\s+(?:the|a|an|it|this|that|them)\b)/i,
    new RegExp(String.raw`${SELF_NOW}${WORK_GERUND}\b`, 'i'),
    new RegExp(String.raw`\blet\s+me\s+${WORK_VERB}\b`, 'i'),
  ],
  text:
    'Your message announces work as next or as underway, and your turn is ending. If no running ' +
    'task, workflow or agent does that work, start it now, in this turn. If one does, say in your ' +
    'message which one does it. If the work cannot start, remove the claim and say what it waits ' +
    'on.',
}
