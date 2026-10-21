import type { BackgroundTaskSummary, ModelTextBlock } from 'claude-code'

import type { RuleCheckerEntry } from '../types'

// What a check at the end of a turn also sends: the text of TODO.md, or null without one, and the
// background tasks of the session.
export type TurnEnd = { todo: string | null; tasks: readonly BackgroundTaskSummary[] }

const runningWorkflows = (tasks: readonly BackgroundTaskSummary[]) =>
  tasks
    .filter(task => task.type === 'workflow' && task.status === 'running')
    .map(task => ({ workflow: task.name, description: task.description }))

// The message of one check, as JSON: the work, and at the end of a turn the text of TODO.md in a
// separate block ahead of it, so an unchanged file is read from the prompt cache.
export const pieceOf = (
  entries: readonly RuleCheckerEntry[],
  end: TurnEnd | undefined,
): ModelTextBlock[] => {
  if (end === undefined) return [{ text: JSON.stringify({ turnEnded: false, work: entries }) }]
  const piece = { turnEnded: true, work: entries, running: runningWorkflows(end.tasks) }

  return [
    { text: JSON.stringify({ todo: end.todo }), cache: true },
    { text: JSON.stringify(piece) },
  ]
}
