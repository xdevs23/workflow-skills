/** The place right before the end of a clause, which ends at a stop, comma, semicolon, colon, dash
 * or line break. */
export const AT_CLAUSE_END = String.raw`(?=[ \t]*(?:[.!?,;:—–]|\n|$))`

/** Up to 40 characters of the same sentence, the reach between two words of one phrase. */
export const WITHIN_SENTENCE = String.raw`[^.!?\n]{0,40}`
