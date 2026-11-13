import { describe } from 'claude-code/testing'

import { ASKED_PERMISSION } from './askedPermission'
import { declareRefusalCases } from './refusalTestSupport'

describe('a message that ends on a question asking permission for work', () => {
  declareRefusalCases(ASKED_PERMISSION, {
    refused: [
      'The fix is a rewrite of the worker imports. Should I start that rewrite?',
      'The cause is in the loader. Want me to fix it?',
      'Do you want me to go ahead?',
      'Shall I build it? ',
      'Would you like me to continue with the second module? **',
      'Should I fix the dropdown?',
      'Should I start the pushdown optimisation?',
      'Should I write the merger of the two lists?',
    ],
    passed: [
      'Should I push main to origin?',
      'Should I go ahead and push main to origin?',
      'Should I proceed with deleting the old branches?',
      'Should I make a commit and force-push the branch?',
      'Want me to do that and remove the cache folder?',
      'Should the cache move to the new disk?',
      'You asked: "Should I start the rewrite?"',
      'Should I start the rewrite, I wondered, and then I started it.',
      'I started the rewrite of the worker imports.',
    ],
  })
})
