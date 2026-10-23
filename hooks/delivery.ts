import type { EngineInterface } from 'claude-code'

import { noteFindings } from './note.ts'
import type { Finding } from './reply.ts'
import { oneLine } from './single-line.ts'

const FINDINGS_HEADING = 'Rule checker findings:'
const FINDINGS_CLOSE = 'Fix each finding, or say why the finding is wrong.'

// The reason a stop is delayed once when findings were sent to the agent for the current prompt.
export const SENT_FINDINGS = `Rule checker findings were sent to you in this turn, in the messages above. ${FINDINGS_CLOSE}`

const findingText = (finding: Finding): string =>
  `"${finding.rule}" (${finding.source}) at ${finding.place}. ${finding.wrong} ${finding.instead}`

const formatFindings = (findings: readonly Finding[]): string =>
  [
    FINDINGS_HEADING,
    ...findings.map((finding, index) => `${index + 1}. ${findingText(finding)}`),
    FINDINGS_CLOSE,
  ].join('\n')

const findingLine = (finding: Finding): string =>
  `Rule checker sent to the agent: ${oneLine(findingText(finding))}`

// Sends the findings to the agent, as a message it reads before its next step, and shows each of
// them as a line in the transcript, where they were sent, and in the note. The transcript does not
// draw a message appended by a plugin, and the model reads only the message, never the lines.
export async function deliver($: EngineInterface, findings: readonly Finding[]): Promise<void> {
  if (findings.length === 0) return
  const content = [{ type: 'text' as const, text: formatFindings(findings) }]
  await $.session.append({ message: { type: 'user', content } })
  findings.forEach(finding => $.ui.log(findingLine(finding)))
  await noteFindings($, findings)
}
