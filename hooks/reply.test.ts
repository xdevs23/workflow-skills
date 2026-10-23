import { describe, expect, test } from 'claude-code/testing'

import { Report, readReply } from './reply.ts'

const FINDING = {
  rule: 'Never guess.',
  source: 'engineering-principles',
  place: 'a.ts:3',
  wrong: 'It guesses.',
  instead: 'Measure.',
}
const TODO = { ...FINDING, place: '#12' }
const NOTHING = { [Report.NextWork]: null, [Report.Forbidden]: null, [Report.Todo]: null }

describe('the reply', () => {
  test('is read as its findings, in the order of the reports', () => {
    const findings = { ...NOTHING, [Report.Todo]: TODO, [Report.Forbidden]: FINDING }

    expect(readReply(JSON.stringify({ findings }))).toEqual({
      kind: 'findings',
      findings: [FINDING, TODO],
    })
    expect(readReply(JSON.stringify({ findings: NOTHING }))).toEqual({
      kind: 'findings',
      findings: [],
    })
  })

  test('that is not JSON, or not the shape, is a failed check', () => {
    const texts = [
      'No breaks.',
      '[]',
      JSON.stringify({ findings: [FINDING] }),
      JSON.stringify({ findings: { [Report.Forbidden]: FINDING } }),
      JSON.stringify({ findings: { ...NOTHING, [Report.Todo]: [TODO, TODO] } }),
    ]
    for (const text of texts) {
      expect(readReply(text)).toHaveProperty('kind', 'failed')
    }
  })
})
