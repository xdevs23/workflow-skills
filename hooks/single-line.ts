// The text on one line: its lines without the blanks at their ends, joined by one space.
export const oneLine = (text: string): string =>
  text
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => line !== '')
    .join(' ')
