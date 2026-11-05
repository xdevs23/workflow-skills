/** The place right before the end of a clause, which ends at a stop, comma, semicolon, colon, dash
 * or line break. */
export const AT_CLAUSE_END = String.raw`(?=[ \t]*(?:[.!?,;:—–]|\n|$))`
