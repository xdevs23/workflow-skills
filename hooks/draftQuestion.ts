import type { Question } from '../types'
import { VISUAL_DECISIONS_SKILL, WITHDRAW_TOOL } from './names'

/** Wordings by which a question points at a draft page: a page in the project cache, or the word
 * "draft" outside a draft pull request or release. */
const DRAFT_PHRASES: readonly RegExp[] = [
  /\.cache\/\S*\.html?\b/i,
  /\bdrafts?\b(?!\s+(?:pull\s+requests?|PRs?|releases?)\b)/i,
]

function draftReminderOf(number: number): string {
  return [
    `Question #${number} may ask about a draft. A draft of a change is opened for the user and`,
    `never asked about, as ${VISUAL_DECISIONS_SKILL} describes in its section Choices. If the`,
    `question asks the user to approve or choose the shape shown in a draft, withdraw it now with`,
    `${WITHDRAW_TOOL} and open the draft page for the user.`,
  ].join(' ')
}

/** The reminders for the model after it asked `question`: one when its text or a choice names a
 * draft, none otherwise. */
export function draftRemindersFor(question: Question): string[] {
  const asked = [question.text, ...question.choices].join('\n')

  return DRAFT_PHRASES.some(phrase => phrase.test(asked)) ? [draftReminderOf(question.number)] : []
}
