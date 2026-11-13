import { describe } from 'claude-code/testing'

import { HANDED_CALL } from './handedCall'
import { declareRefusalCases } from './refusalTestSupport'

describe('a message that ends on a sentence handing the user the call', () => {
  declareRefusalCases(HANDED_CALL, {
    refused: [
      'The first remedy is excluded, so this is your call.',
      "That's up to you.",
      'It is your decision which disk the tests use.',
      'Both options work. **This is your call.**',
    ],
    passed: [
      'The commit is ready. It is up to you to push it.',
      'This is your call only for pushes.',
      "That's your decision whether the old branches get deleted.",
      'You said it is up to you, so I chose the second option.',
      'This is your call, I thought, so I picked the faster one and built it.',
      'I picked the faster option and built it.',
      'You wrote: "this is your call."',
    ],
  })
})
