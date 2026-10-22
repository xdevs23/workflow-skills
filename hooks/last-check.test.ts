import { describe, expect, test } from 'claude-code/testing'

import { stateOf } from './last-check.ts'

const first = { id: 'w1', name: 'review', description: 'review the parser' }
const second = { id: 'w2', name: 'build', description: 'build the lexer' }

describe('the state', () => {
  test('is the same for the same running workflows in another order', () => {
    expect(stateOf('# Todo', [second, first])).toBe(stateOf('# Todo', [first, second]))
  })
})
