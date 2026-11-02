import type { HintKind } from './hintKind'
import { COUNT } from './quantityWords'

const FURTHER = String.raw`(?:more|other|another|further|follow-?up)`
const LATER = String.raw`(?:after\s+(?:that|this)|afterwards|later|next|to\s+follow|coming)`

const phrase = (source: string): RegExp => new RegExp(source, 'i')

/** The hint after a message that announces a question in place of asking it. */
export const HELD_QUESTION_HINT: HintKind = {
  phrases: [
    phrase(String.raw`\b(?:I|we)(?:\s+(?:still\s+)?have|['’]ve\s+(?:still\s+)?got)\s+(?:${COUNT}\s+(?:${FURTHER}\s+)?|${FURTHER}\s+)questions?\b`),
    phrase(String.raw`\b${FURTHER}\s+questions?\s+${LATER}\b`),
    phrase(String.raw`\b(?:I['’]ll|I\s+will)\s+ask\s+(?:(?:the\s+)?(?:next|other|remaining)\s+(?:one|questions?)|another\s+(?:one|question)|the\s+rest|${FURTHER}\s+questions?)\b`),
  ],
  text:
    'Your message announces a question in place of asking it. Never announce a question. Run ' +
    'each question you hold back through workflow-skills:question now, act on the answer the ' +
    'subagent finds, and ask the user only what it cannot answer, one question to a message.',
}
