/** A list mark at the start of a line, with the space after it. */
export const LIST_MARK = String.raw`(?:[-*•][ \t]+)?`
/** A heading mark at the start of a line, with the space after it. */
export const HEADING_MARK = String.raw`(?:#{1,6}[ \t]*)?`
/** Bold or italic emphasis around a word, in either form of Markdown. */
export const EMPHASIS = String.raw`(?:\*\*?|__?)?`
