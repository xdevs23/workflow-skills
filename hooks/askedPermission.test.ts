import { describe, expect } from 'claude-code/testing'

import { ASKED_PERMISSION } from './askedPermission'
import { refusalsIn } from './refusals'
import { test } from './testDeclaration'

describe('a message that ends on a question asking permission for work', () => {
  const asking = [
    'The fix is a rewrite of the worker imports. Should I start that rewrite?',
    'The cause is in the loader. Want me to fix it?',
    'Do you want me to go ahead?',
    'Shall I build it? ',
    'Would you like me to continue with the second module? **',
    'Should I fix the dropdown?',
    'Should I start the pushdown optimisation?',
    'Should I write the merger of the two lists?',
  ]
  for (const message of asking) {
    test(`${JSON.stringify(message)} asks permission for work`, () => {
      expect(refusalsIn(message)).toContain(ASKED_PERMISSION)
    })
  }

  const notAsking = [
    'Should I push main to origin?',
    'Should I go ahead and push main to origin?',
    'Should I proceed with deleting the old branches?',
    'Should I make a commit and force-push the branch?',
    'Want me to do that and remove the cache folder?',
    'Should the cache move to the new disk?',
    'You asked: "Should I start the rewrite?"',
    'Should I start the rewrite, I wondered, and then I started it.',
    'I started the rewrite of the worker imports.',
  ]
  for (const message of notAsking) {
    test(`${JSON.stringify(message)} does not ask permission for work`, () => {
      expect(refusalsIn(message)).not.toContain(ASKED_PERMISSION)
    })
  }
})
