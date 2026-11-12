/** A letter or a digit of any script. */
export const LETTER_OR_DIGIT = String.raw`[\p{L}\p{N}]`

/** \x60 is the backtick, which a template literal cannot hold unescaped. */
const FENCED_CODE =
  String.raw`^[ \t]{0,3}(?<fence>\x60{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]{0,3}\k<fence>`
const INLINE_CODE = String.raw`\x60[^\x60\n]+\x60`
/** A mark right after a letter or digit, such as the inch mark in 12", opens no quote. */
const STRAIGHT_QUOTE = String.raw`(?<!${LETTER_OR_DIGIT})"[^"\n]+"(?!${LETTER_OR_DIGIT})`
const CURLY_QUOTE = String.raw`“[^”\n]+”`
const QUOTED_LINE = String.raw`^[ \t]{0,3}>.*$`

const QUOTED_TEXT = new RegExp(
  [FENCED_CODE, INLINE_CODE, STRAIGHT_QUOTE, CURLY_QUOTE, QUOTED_LINE].join('|'),
  'gmu',
)
const WORD = new RegExp(`${LETTER_OR_DIGIT}+`, 'gu')
/** Stands for a blanked word. It is neither a letter nor a space, so no phrase can reach across. */
const BLANKED_WORD = '·'

/**
 * Returns the message with the words of its code, quotations and quoted lines blanked, since the
 * message only mentions them. Marks, stops and line breaks stay, so sentences end where they did.
 */
export function withoutQuotedText(message: string): string {
  return message.replace(QUOTED_TEXT, quoted => quoted.replace(WORD, BLANKED_WORD))
}
