import { describe, expect, test } from 'claude-code/testing'

import { oneLine } from './single-line.ts'

describe('a text on one line', () => {
  test('joins its lines with one space, without the blanks around each break', () => {
    expect(oneLine('a\r\n  b')).toBe('a b')
    expect(oneLine('a\nb\n\nc')).toBe('a b c')
  })

  test('keeps the blanks inside a line', () => {
    expect(oneLine('a  b')).toBe('a  b')
  })
})
