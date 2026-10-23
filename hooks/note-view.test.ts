import { describe, expect, test } from 'claude-code/testing'

import type { RuleCheckerFinding, RuleCheckerNote } from '../types'
import { PartKind, RowKind, rowsOf } from './note-view.ts'

const finding = (wrong: string): RuleCheckerFinding => ({
  rule: 'r',
  source: 's',
  place: 'p',
  wrong,
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
    expect(rowsOf(shown({}))).toEqual([])
  })

  test('reports the findings, each in a row of its own, then the retry and the failure', () => {
    const findings = ['It guesses.', 'It sleeps.'].map(finding)
    const rows = rowsOf(shown({ findings, failures: ['refused'], retrying: 'overloaded' }))
    const report = [PartKind.Label, PartKind.Separator, PartKind.Report]
    const findingParts = [PartKind.Report, PartKind.Finding, PartKind.Place]

    expect(rows.map(row => [row.kind, row.parts.map(part => part.kind)])).toEqual([
      [RowKind.Findings, report],
      [RowKind.Findings, findingParts],
      [RowKind.Findings, findingParts],
      [RowKind.Retry, report],
      [RowKind.Failure, report],
    ])
    expect(rows.slice(1, 3).map(row => row.parts[1]?.text)).toEqual(['It guesses.', 'It sleeps.'])
  })

  test('draws a finding written over several lines on one row', () => {
    const rows = rowsOf(shown({ findings: [finding('It\n  sleeps.')] }))

    expect(rows[1]?.parts[1]?.text).toBe('It sleeps.')
  })
})
