// A line of a Markdown document, with its heading where the line is an ATX heading (`## Title`).
// A line inside a fenced code block or an HTML comment is never a heading.
export type MarkdownLine = { text: string; heading: Heading | null }

export type Heading = { depth: number; title: string }

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
// A fence inside a list item is indented deeper than three spaces, so any indentation opens one. A
// line with another backtick after the backticks of the fence starts with inline code.
const FENCE_OPENING = /^\s*(`{3,}(?=[^`]*$)|~{3,})/
const FENCE_CLOSING = /^\s*(`{3,}|~{3,})\s*$/
const COMMENT_OPENING = /^ {0,3}<!--/
const COMMENT_CLOSING = '-->'

const headingOf = (text: string): Heading | null => {
  const match = HEADING.exec(text)
  if (match === null) return null
  const [, hashes = '', title = ''] = match

  return { depth: hashes.length, title }
}

// A closing fence repeats the character of the opening one, at least as many times.
const closes = (opening: string, text: string): boolean => {
  const closing = FENCE_CLOSING.exec(text)?.[1]

  return closing !== undefined && closing[0] === opening[0] && closing.length >= opening.length
}

export function* markdownLines(document: string): Generator<MarkdownLine> {
  let fence: string | null = null
  let isInComment = false
  for (const raw of document.split(/\r?\n/)) {
    const text = raw.trimEnd()
    const opening = FENCE_OPENING.exec(text)?.[1]
    if (fence !== null) {
      if (closes(fence, text)) fence = null
      yield { text, heading: null }
    } else if (isInComment) {
      isInComment = !text.includes(COMMENT_CLOSING)
      yield { text, heading: null }
    } else if (opening !== undefined) {
      fence = opening
      yield { text, heading: null }
    } else if (COMMENT_OPENING.test(text)) {
      isInComment = !text.replace(COMMENT_OPENING, '').includes(COMMENT_CLOSING)
      yield { text, heading: null }
    } else {
      yield { text, heading: headingOf(text) }
    }
  }
}
