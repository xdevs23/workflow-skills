import { WITHIN_SENTENCE } from './clauses'
import { DECISION_AS_DRAFT } from './decisionDraft'
import type { HintText } from './hintText'
import { QUESTION_MARKS, QUESTION_MARK_AT_END } from './lineMarks'
import { phrase } from './phrase'
import { blankSpan, withoutQuotedSpans } from './quotedText'
import { OPEN_DECISION_PHRASES } from './waitingHint'

export const REQUEST_DEFINITION =
  'A request asks the user for work that only the user can do outside this session.'

export const NOT_A_REQUEST =
  'A draft or a page to approve or look at, a question, or a note that a question or a decision ' +
  'is still open is not a request.'

/** A web address, whose query may hold a question mark. */
const WEB_ADDRESS = /\bhttps?:\/\/\S+/gi

/**
 * A path to a page, which a web address or a code span still points at. It needs a folder, since
 * a bare file name such as index.html also names a file of a device or a site.
 */
const PAGE_PATH =
  /(?<![^\s"'`()<>])[^\s"'`()<>]*\/[^\s"'`()<>/]*\.html?(?=[.,;:!]?(?:[\s"'`)>?#]|$))/i

/** A draft, and never a draft pull request or a draft release. */
const DRAFT = String.raw`\bdrafts?\b(?!\s+(?:pull\s+requests?|PRs?|releases?)\b)`
const LOOK_AT =
  String.raw`\b(?:approv(?:e|es|ed|ing|al)|(?:review|check|open|pick)(?:s|ed|ing)?|` +
  String.raw`look(?:s|ed|ing)?\s+(?:at|over|through))\b`
const OPEN_DECISION =
  String.raw`\b(?:open\s+(?:questions?|decisions?)\b|` +
  String.raw`(?:questions?|decisions?|answers?|picks?|choices?)\b${WITHIN_SENTENCE}` +
  String.raw`\b(?:is|are|remains?|stays?|still)\s+(?:still\s+)?` +
  String.raw`(?:open|pending|unanswered|outstanding|undecided)\b|` +
  String.raw`(?:questions?|decisions?)\b${WITHIN_SENTENCE}\b(?:pending|unanswered|undecided)\b|` +
  String.raw`\bwait(?:s|ing)?\s+(?:on|for)\s+your\s+(?:answer|pick|choice|decision)\b)`

/** A sentence that ends on a question mark, from its start. */
const QUESTION = new RegExp(
  String.raw`(?<=^|[.!${QUESTION_MARKS}\n])[^.!${QUESTION_MARKS}\n]*` +
    String.raw`(?:[${QUESTION_MARKS}](?=[\s)\]}"'”’])|${QUESTION_MARK_AT_END})`,
)

/** The wordings read outside web addresses and quoted text, which the text only mentions. */
const SAID_WORDINGS: readonly RegExp[] = [
  phrase(`${LOOK_AT}${WITHIN_SENTENCE}${DRAFT}|${DRAFT}${WITHIN_SENTENCE}${LOOK_AT}`),
  ...OPEN_DECISION_PHRASES,
  phrase(OPEN_DECISION),
  QUESTION,
]

/**
 * The wording by which `text` points at a draft or a page to look at, names a question or a
 * decision as still left to the user, or asks a question, and undefined for a text that does none
 * of these.
 */
export function findNotRequestWording(text: string): string | undefined {
  const said = withoutQuotedSpans(text.replace(WEB_ADDRESS, blankSpan))
  const match = [PAGE_PATH.exec(text), ...SAID_WORDINGS.map(wording => wording.exec(said))].find(
    found => found !== null,
  )
  if (match === undefined) {
    return undefined
  }

  // Blanking keeps every mark at its place, so the match names the words of `text`.
  return text.slice(match.index, match.index + match[0].length).trim()
}

/** Why a text with `wording` is refused as a request. */
export function describeNotRequest(wording: string): HintText {
  return [
    `The request is refused, since it says "${wording}". ${NOT_A_REQUEST} ${REQUEST_DEFINITION}`,
    DECISION_AS_DRAFT,
  ]
}
