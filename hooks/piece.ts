import type { ModelTextBlock } from 'claude-code'

import type { RunningWorkflow, WaitingTask } from '../types'

// The message of one check, as JSON: the final message of the agent, or null without one, the
// prompts of the user since the last successful check, the running workflows, and the other tasks
// and wakeups started by the turn. The text of TODO.md, where the check sends it, goes in a
// separate block ahead of the rest.
export const pieceOf = ({
  final,
  user,
  running,
  waiting,
  todo,
}: {
  final: string | null
  user: readonly string[]
  running: readonly RunningWorkflow[]
  waiting: readonly WaitingTask[]
  todo: string | null
}): ModelTextBlock[] => {
  const workflows = running.map(workflow => ({
    workflow: workflow.name,
    description: workflow.description,
  }))
  const turn = { text: JSON.stringify({ final, user, running: workflows, waiting }) }

  return todo === null ? [turn] : [{ text: JSON.stringify({ todo }) }, turn]
}
