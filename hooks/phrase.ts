/** A pattern that matches whatever the case of the letters in the message. */
export const phrase = (source: string): RegExp => new RegExp(source, 'i')
