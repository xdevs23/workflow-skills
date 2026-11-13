import { describe, expect } from 'claude-code/testing'

import { HANDED_CALL } from './handedCall'
import { refusalsIn } from './refusals'
import { test } from './testDeclaration'

describe('a message that ends on a sentence handing the user the call', () => {
  const handing = [
    'The first remedy is excluded, so this is your call.',
    "That's up to you.",
    'It is your decision which disk the tests use.',
    'Both options work. **This is your call.**',
  ]
  for (const message of handing) {
    test(`${JSON.stringify(message)} hands the user the call`, () => {
      expect(refusalsIn(message)).toContain(HANDED_CALL)
    })
  }

  const notHanding = [
    'The commit is ready. It is up to you to push it.',
    'This is your call only for pushes.',
    "That's your decision whether the old branches get deleted.",
    'You said it is up to you, so I chose the second option.',
    'This is your call, I thought, so I picked the faster one and built it.',
    'I picked the faster option and built it.',
    'You wrote: "this is your call."',
  ]
  for (const message of notHanding) {
    test(`${JSON.stringify(message)} does not hand the user the call`, () => {
      expect(refusalsIn(message)).not.toContain(HANDED_CALL)
    })
  }
})
