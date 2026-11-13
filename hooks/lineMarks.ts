/** A list mark at the start of a line, with the space after it. */
export const LIST_MARK = String.raw`(?:[-*•][ \t]+)?`
/** A heading mark at the start of a line, with the space after it. */
export const HEADING_MARK = String.raw`(?:#{1,6}[ \t]*)?`
/** Bold or italic emphasis around a word, in either form of Markdown. */
export const EMPHASIS = String.raw`(?:\*\*?|__?)?`
/** The question marks of the scripts the refusals read, as the body of a character class. */
export const QUESTION_MARKS = '?？'
/** A question mark that ends the text, with any emphasis, marks or space after it. */
export const QUESTION_MARK_AT_END = String.raw`[${QUESTION_MARKS}][${QUESTION_MARKS}!*_~\s]*$`
