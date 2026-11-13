import { expect } from 'claude-code/testing'

import type { Refusal } from './refusal'
import { refusalsIn } from './refusals'
import { test } from './testDeclaration'

/** The messages a test expects a refusal to send back, and those it expects to pass. */
export type RefusalCases = {
  refused: readonly string[]
  passed: readonly string[]
}

/** Declares one test per message of `cases`, each checking whether `refusal` sends it back. */
export function declareRefusalCases(refusal: Refusal, { refused, passed }: RefusalCases): void {
  for (const message of refused) {
    test(`${JSON.stringify(message)} is sent back`, () => {
      expect(refusalsIn(message)).toContain(refusal)
    })
  }
  for (const message of passed) {
    test(`${JSON.stringify(message)} passes`, () => {
      expect(refusalsIn(message)).not.toContain(refusal)
    })
  }
}
