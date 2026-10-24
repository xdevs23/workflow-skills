import { describe, expect, test } from 'claude-code/testing'

import { markdownLines } from './markdown-lines.ts'

const headingsOf = (lines: readonly string[]) =>
  [...markdownLines(lines.join('\n'))].map(line => line.heading)

describe('a line of Markdown', () => {
  test('is a heading with its depth and title, without the closing hashes', () => {
    expect(
      headingsOf(['# One', '### Three ###', '   ## Indented', '######', '#5 - Not a heading']),
    ).toEqual([
      { depth: 1, title: 'One' },
      { depth: 3, title: 'Three' },
      { depth: 2, title: 'Indented' },
      { depth: 6, title: '' },
      null,
    ])
  })

  test('indented by four spaces or with seven hashes is no heading', () => {
    expect(headingsOf(['    # Code', '####### Seven'])).toEqual([null, null])
  })

  test('inside a fenced code block is no heading, up to the fence that closes it', () => {
    expect(
      headingsOf([
        '````md',
        '# Inside',
        '```',
        '~~~~',
        '# Still inside',
        '````',
        '# After',
        '  ~~~',
        '  # In a fence of a list item',
        '  ~~~',
        '# Last',
      ]).map(heading => heading?.title ?? null),
    ).toEqual([null, null, null, null, null, null, 'After', null, null, null, 'Last'])
  })

  test('after inline code at the start of a line is a heading', () => {
    expect(headingsOf(['```code``` and text', '# After'])).toEqual([
      null,
      { depth: 1, title: 'After' },
    ])
  })

  test('inside an HTML comment is no heading', () => {
    expect(
      headingsOf(['<!-- # One line -->', '# After', '<!--', '# Inside', '-->', '# Last']).map(
        heading => heading?.title ?? null,
      ),
    ).toEqual([null, 'After', null, null, null, 'Last'])
  })

  test('keeps its text without the line break, also after CRLF', () => {
    expect([...markdownLines('# A  \r\nb\r\n')].map(line => line.text)).toEqual(['# A', 'b', ''])
  })
})
