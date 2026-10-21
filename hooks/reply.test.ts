import { describe, expect, test } from 'claude-code/testing'

import { readReply } from './reply.ts'

const FINDING = {
  rule: 'Never guess.',
  source: 'engineering-principles',
  place: 'a.ts:3',
  wrong: 'It guesses.',
  instead: 'Measure.',
}

describe('the reply', () => {
  test('is read as its findings', () => {
    expect(readReply(JSON.stringify({ findings: [FINDING] }))).toEqual({
      kind: 'findings',
      findings: [FINDING],
    })
    expect(readReply('{"findings": []}')).toEqual({ kind: 'findings', findings: [] })
  })

  test('that is not JSON, or not the shape, is a failed check', () => {
    for (const text of ['No breaks.', '{"findings": [{"rule": "x"}]}', '[]']) {
      expect(readReply(text)).toHaveProperty('kind', 'failed')
    }
  })
})
