import type { EngineInterface } from 'claude-code'

import { noteFindings } from './note.ts'
import type { Finding } from './reply.ts'

const FINDINGS_HEADING = 'Rule checker findings:'
const FINDINGS_CLOSE = 'Fix each finding, or say why the finding is wrong.'

// The reason a stop is delayed once when findings were sent to the agent for the current prompt.
export const SENT_FINDINGS = `Rule checker findings were sent to you in this turn, in the messages above. ${FINDINGS_CLOSE}`

const formatFindings = (findings: readonly Finding[]): string =>
  [
    FINDINGS_HEADING,
    ...findings.map(
      (finding, index) =>
        `${index + 1}. "${finding.rule}" (${finding.source}) at ${finding.place}. ${finding.wrong} ${finding.instead}`,
    ),
    FINDINGS_CLOSE,
  ].join('\n')

// Sends the findings to the agent, as a message it reads before its next step, and shows them in
// the note and as a notice in the transcript where they were sent. The model reads the message
// alone, since the transcript draws no message a plugin appended and the model reads no notice.
export async function deliver($: EngineInterface, findings: readonly Finding[]): Promise<void> {
  if (findings.length === 0) return
  const content = [{ type: 'text' as const, text: formatFindings(findings) }]
  await $.session.append({ message: { type: 'user', content } })
  await $.session.append({ message: { type: 'system', content } })
  await noteFindings($, findings)
}
