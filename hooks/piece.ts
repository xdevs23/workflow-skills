import type { ModelTextBlock } from 'claude-code'

import type { RunningWorkflow, WaitingTask } from '../types'
import type { Finding } from './reply.ts'

// The message sent to one check, as JSON: the final message of the agent, or null without one,
// the prompts of the user since the last successful check, the running workflows, the other tasks
// and wakeups started by the turn, and the findings the last successful check sent, while there
// are any. The text of TODO.md, where the check sends it, goes in a separate block ahead of
// the rest.
export const pieceOf = ({
  final,
  user,
  running,
  waiting,
  sent,
  todo,
}: {
  final: string | null
  user: readonly string[]
  running: readonly RunningWorkflow[]
  waiting: readonly WaitingTask[]
  sent: readonly Finding[]
  todo: string | null
}): ModelTextBlock[] => {
  const workflows = running.map(workflow => ({
    workflow: workflow.name,
    description: workflow.description,
  }))
  const sentPart = sent.length === 0 ? {} : { sent }
  const turn = { text: JSON.stringify({ final, user, running: workflows, waiting, ...sentPart }) }

  return todo === null ? [turn] : [{ text: JSON.stringify({ todo }) }, turn]
}
