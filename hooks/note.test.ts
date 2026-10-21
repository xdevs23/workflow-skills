import { describe, expect, test } from 'claude-code/testing'

import type { RuleCheckerFinding, RuleCheckerNote } from '../types'
import { rowsOf } from './note.ts'

const finding = (place: string): RuleCheckerFinding => ({
  rule: 'r',
  source: 's',
  place,
  wrong: 'x'.repeat(200),
  instead: 'i',
})
const shown = (note: Partial<RuleCheckerNote>): RuleCheckerNote => ({
  findings: [],
  failures: [],
  retrying: null,
  ...note,
})

describe('the note', () => {
  test('has no rows while there is nothing to show', () => {
    expect(rowsOf(shown({}), 80)).toEqual([])
  })

  test('gives each finding a row of its own within the columns, beside a failed check', () => {
    const findings = ['a.ts:1', 'b.ts:2', 'c.ts:3'].map(finding)
    const rows = rowsOf(shown({ findings, failures: ['refused'] }), 40)

    expect(rows).toHaveLength(5)
    expect(rows.every(row => row.length <= 40)).toBe(true)
    findings.forEach(({ place }, index) => expect(rows[index + 1]).toContain(place))
  })
})
