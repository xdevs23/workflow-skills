import type { HintKind } from './hintKind'
import { phrase } from './phrase'
import { COUNT } from './quantityWords'

const FURTHER = String.raw`(?:more|other|another|further|follow-?up)`
const LATER = String.raw`(?:after\s+(?:that|this)|afterwards|later|next|to\s+follow|coming)`
const NEXT_QUESTION = String.raw`(?:the\s+)?(?:next|other|remaining)\s+(?:one|questions?)`
const ANOTHER_QUESTION = String.raw`another\s+(?:one|question)`

/** The hint after a message that announces a question in place of asking it. */
export const HELD_QUESTION_HINT: HintKind = {
  phrases: [
    phrase(
      String.raw`\b(?:I|we)(?:\s+(?:still\s+)?have|['’]ve\s+(?:still\s+)?got)\s+` +
        String.raw`(?:${COUNT}\s+(?:${FURTHER}\s+)?|${FURTHER}\s+)questions?\b`,
    ),
    phrase(String.raw`\b${FURTHER}\s+questions?\s+${LATER}\b`),
    phrase(
      String.raw`\b(?:I['’]ll|I\s+will)\s+ask\s+` +
        String.raw`(?:${NEXT_QUESTION}|${ANOTHER_QUESTION}|the\s+rest|${FURTHER}\s+questions?)\b`,
    ),
  ],
  text:
    'Your message announces a question in place of asking it. Never announce a question. Run ' +
    'each question you hold back through workflow-skills:question now, act on the answer the ' +
    'subagent finds, and ask the user only what it cannot answer, one question to a message.',
}
