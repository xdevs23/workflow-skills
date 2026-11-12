import { expect } from 'claude-code/testing'

import { regExpLiteralOf } from './regExpLiteral'

/**
 * Matches a text that contains each of `parts` in the order given and none of `absent`. The words
 * between the parts are not matched, so a test that sends a text built from `parts` does not
 * restate the words put around them by the code.
 */
export function textContainingInOrder(
  parts: readonly [string, ...string[]],
  absent: readonly string[] = [],
) {
  const lacking = absent.map(text => `(?!.*${regExpLiteralOf(text)})`).join('')
  const inOrder = parts.map(regExpLiteralOf).join('.*')

  return expect.stringMatching(new RegExp(`^${lacking}.*${inOrder}`, 'su'))
}
