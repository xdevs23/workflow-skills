import { describe, expect } from 'claude-code/testing'

import { textContainingInOrder } from './orderedTextTestSupport'
import { test } from './testDeclaration'

describe('a text that contains parts in order', () => {
  test('matches the parts in the order given, with any words around and between them', () => {
    expect('Note: A. then B. done').toEqual(textContainingInOrder(['A.', 'B.']))
  })

  test('does not match the parts in another order', () => {
    expect('B. then A.').not.toEqual(textContainingInOrder(['A.', 'B.']))
  })

  test('does not match a text that contains an absent part', () => {
    expect('A. B. deploy').not.toEqual(textContainingInOrder(['A.', 'B.'], ['deploy']))
  })

  test('reads the characters of a regular expression in a part as text', () => {
    expect('Ticket #4.2 is open').toEqual(textContainingInOrder(['#4.2']))
    expect('Ticket #402 is open').not.toEqual(textContainingInOrder(['#4.2']))
  })
})
