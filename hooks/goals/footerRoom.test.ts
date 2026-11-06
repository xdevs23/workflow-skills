import { describe, expect, test } from 'claude-code/testing'

import { hasFooterRoomForButton, mostColumnsOf } from './footerRoom'

const HINT = 'claude-fable-5-1 (high)'
// Padding of 2 at each side, `⏵⏵ bypass permissions on · ` at 30 columns as counted, the hint, the
// gap of 1 and `[ Goals ]`.
const COLUMNS_FOR_BUTTON_BESIDE_HINT = 2 + 30 + HINT.length + 1 + 9 + 2

describe('the room of the footer row for a button', () => {
  test('a row as wide as the longest mode label, the hint and the button has room', () => {
    const row = { columns: COLUMNS_FOR_BUTTON_BESIDE_HINT, hintColumns: HINT.length, modes: [] }

    expect(hasFooterRoomForButton(row, 'Goals')).toBe(true)
  })

  test('a row one column narrower has no room', () => {
    const row = { columns: COLUMNS_FOR_BUTTON_BESIDE_HINT - 1, hintColumns: HINT.length, modes: [] }

    expect(hasFooterRoomForButton(row, 'Goals')).toBe(false)
  })

  test('the mode labels before the button take their columns and a gap', () => {
    const modesColumns = 'focus & memory paused'.length + 1
    const modes = ['focus', 'memory paused']
    const hintColumns = HINT.length

    expect(
      hasFooterRoomForButton(
        { columns: COLUMNS_FOR_BUTTON_BESIDE_HINT + modesColumns, hintColumns, modes },
        'Goals',
      ),
    ).toBe(true)
    expect(
      hasFooterRoomForButton(
        { columns: COLUMNS_FOR_BUTTON_BESIDE_HINT + modesColumns - 1, hintColumns, modes },
        'Goals',
      ),
    ).toBe(false)
  })
})

test('a character outside ASCII counts as two columns, since a terminal may draw it wide', () => {
  expect(mostColumnsOf('esc to interrupt')).toBe(16)
  expect(mostColumnsOf('a · b')).toBe(6)
  expect(mostColumnsOf('模型')).toBe(4)
})
