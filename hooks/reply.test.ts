import { describe, expect, test } from 'claude-code/testing'

import { Report, readReply } from './reply.ts'

const FINDING = {
  report: Report.Forbidden,
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

  test('keeps the first finding of each report', () => {
    const todo = { ...FINDING, report: Report.Todo, place: '#12' }
    const findings = [FINDING, todo, { ...FINDING, place: 'b.ts:1' }, { ...todo, place: '#13' }]

    expect(readReply(JSON.stringify({ findings }))).toEqual({
      kind: 'findings',
      findings: [FINDING, todo],
    })
  })

  test('that is not JSON, or not the shape, is a failed check', () => {
    const unknownReport = JSON.stringify({ findings: [{ ...FINDING, report: 'style' }] })
    for (const text of ['No breaks.', '{"findings": [{"rule": "x"}]}', '[]', unknownReport]) {
      expect(readReply(text)).toHaveProperty('kind', 'failed')
    }
  })
})
