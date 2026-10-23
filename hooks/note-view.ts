import type { BoxProps, ElementConstructor, RenderElement, TextProps, ThemeKey } from 'claude-code'

import type { RuleCheckerNote } from '../types'
import type { Finding } from './reply.ts'
import { oneLine } from './single-line.ts'

// What a row of the note reports, which sets the color of the row.
export const RowKind = { Findings: 'findings', Retry: 'retry', Failure: 'failure' } as const
type RowKind = (typeof RowKind)[keyof typeof RowKind]

// The kind of text in a part of a row, which sets the style of the part within the color of the
// row. A report is drawn in the color of its row alone.
export const PartKind = {
  Label: 'label',
  Separator: 'separator',
  Report: 'report',
  Finding: 'finding',
  Place: 'place',
} as const
type PartKind = (typeof PartKind)[keyof typeof PartKind]

const ROW_COLORS: Record<RowKind, ThemeKey> = {
  [RowKind.Findings]: 'warning',
  [RowKind.Retry]: 'suggestion',
  [RowKind.Failure]: 'error',
}

const PART_STYLES: Record<PartKind, TextProps> = {
  [PartKind.Label]: { weight: 'bold' },
  [PartKind.Separator]: { dimColor: true },
  [PartKind.Report]: {},
  [PartKind.Finding]: { color: 'text' },
  [PartKind.Place]: { dimColor: true, italic: true },
}

type RowPart = { kind: PartKind; text: string }
export type NoteRow = { kind: RowKind; parts: readonly RowPart[] }

// The elements the note is drawn with, which every surface has.
type NoteElements = { Box: ElementConstructor<BoxProps>; Text: ElementConstructor<TextProps> }

const counted = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

const part = (kind: PartKind, text: string): RowPart => ({ kind, text })

// The row of a report: the label "Rule checker", then the report.
const reportRow = (kind: RowKind, report: string): NoteRow => ({
  kind,
  parts: [
    part(PartKind.Label, 'Rule checker'),
    part(PartKind.Separator, ' · '),
    part(PartKind.Report, report),
  ],
})

const findingRow = (finding: Finding): NoteRow => ({
  kind: RowKind.Findings,
  parts: [
    part(PartKind.Report, '  ▸ '),
    part(PartKind.Finding, oneLine(finding.wrong)),
    part(PartKind.Place, ` (${oneLine(finding.place)})`),
  ],
})

// The rows of the note, and none while there is nothing to show: a row that counts the findings
// and a row for each of them, then the retry and the failed checks.
export function rowsOf({ findings, failures, retrying }: RuleCheckerNote): NoteRow[] {
  const reported =
    findings.length === 0
      ? []
      : [
          reportRow(RowKind.Findings, `${counted(findings.length, 'break')} reported to the agent`),
          ...findings.map(findingRow),
        ]
  const retried =
    retrying === null ? [] : [reportRow(RowKind.Retry, `trying again after ${oneLine(retrying)}`)]
  const lastFailure = failures.at(-1)
  const failed =
    lastFailure === undefined
      ? []
      : [
          reportRow(
            RowKind.Failure,
            `${counted(failures.length, 'check')} failed: ${oneLine(lastFailure)}`,
          ),
        ]

  return [...reported, ...retried, ...failed]
}

// Draws the rows of the note, each cut at the end of the band. The band scrolls rows that do not
// fit.
export const noteTree = ({ Box, Text }: NoteElements, rows: readonly NoteRow[]): RenderElement =>
  Box({
    flexDirection: 'column',
    children: rows.map(row =>
      Text({
        color: ROW_COLORS[row.kind],
        wrap: 'truncate-end',
        children: row.parts.map(({ kind, text }) => Text({ ...PART_STYLES[kind], children: text })),
      }),
    ),
  })
