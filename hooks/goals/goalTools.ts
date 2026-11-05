import type {
  Caught,
  EngineInterface,
  Frozen,
  MatchedHook,
  ToolCallInput,
  ToolCallResult,
  ToolSpec,
} from 'claude-code'

import { isMainConversation } from '../conversation'
import { denyFailedHook, denyFailedUse } from '../hookFailure'
import { Outcome } from './board'
import type { BoardChange } from './board'
import { sessionScope } from './boardScope'
import { describeStoreFailure, loadBoard } from './boardStore'
import type { Failed } from './boardStore'
import { attachTodoInSession, detachTodoInSession } from './goalActions'
import {
  ATTACH_TODO,
  ATTACH_TODO_TOOL,
  DETACH_TODO,
  DETACH_TODO_TOOL,
  LIST_GOALS,
  LIST_GOALS_TOOL,
} from './goalNames'
import {
  ATTACH_PROBLEMS,
  ATTACH_TODO_SCHEMA,
  DETACH_PROBLEMS,
  DETACH_TODO_SCHEMA,
  TodoInputOutcome,
  readTodoInput,
} from './goalToolInputs'
import type { TodoInputProblem } from './goalToolInputs'
import {
  ATTACH_TODO_DESCRIPTION,
  DETACH_TODO_DESCRIPTION,
  GOAL_TOOLS_SUBJECT,
  LIST_GOALS_DESCRIPTION,
  SUBAGENT_DENIAL,
  describeAttached,
  describeDetached,
  describeGoals,
  describeRefusal,
} from './goalToolTexts'
import { readEntryHeading, readEntryNumber } from './todoEntry'
import type { TodoEntry } from './todoEntry'

const TOOLS: readonly ToolSpec[] = [
  { name: LIST_GOALS, description: LIST_GOALS_DESCRIPTION, isDeferred: false },
  {
    name: ATTACH_TODO,
    description: ATTACH_TODO_DESCRIPTION,
    inputSchema: ATTACH_TODO_SCHEMA,
    isDeferred: false,
  },
  {
    name: DETACH_TODO,
    description: DETACH_TODO_DESCRIPTION,
    inputSchema: DETACH_TODO_SCHEMA,
    isDeferred: false,
  },
]

/** How a tool that changes the TODO entries of a goal reads its entry and describes its change. */
type TodoChangeTool<Todo> = {
  readTodo: (text: string) => Todo | undefined
  problems: Record<TodoInputProblem, string>
  describeDone: (goal: number, todo: Todo) => string
}

const ATTACHING: TodoChangeTool<TodoEntry> = {
  readTodo: readEntryHeading,
  problems: ATTACH_PROBLEMS,
  describeDone: describeAttached,
}

const DETACHING: TodoChangeTool<string> = {
  readTodo: readEntryNumber,
  problems: DETACH_PROBLEMS,
  describeDone: describeDetached,
}

/** Registers the tools by which the model lists the goals and attaches TODO entries to them. */
export async function registerGoalTools($: EngineInterface): Promise<void> {
  await Promise.all(TOOLS.map(tool => $.tool.register(tool)))
}

// A subagent reads the goals too, so it can check its work against them.
export const listGoals: MatchedHook<'tool.call', { tool: typeof LIST_GOALS_TOOL }> = async $ => {
  const read = await loadBoard($, sessionScope(await $.session.id()))

  return read.outcome === Outcome.Read
    ? { result: describeGoals(read.board) }
    : denyFailedUse($, GOAL_TOOLS_SUBJECT, describeStoreFailure(read))
}

export const attachTodo: MatchedHook<'tool.call', { tool: typeof ATTACH_TODO_TOOL }> = ($, e) =>
  changeTodosOfGoal($, e, ATTACHING, (sessionId, goal, todo) =>
    attachTodoInSession($, sessionId, goal, todo),
  )

export const detachTodo: MatchedHook<'tool.call', { tool: typeof DETACH_TODO_TOOL }> = ($, e) =>
  changeTodosOfGoal($, e, DETACHING, (sessionId, goal, todoNumber) =>
    detachTodoInSession($, sessionId, goal, todoNumber),
  )

/** Denies the call of a goal tool whose hook failed, such as by running out of time. */
export function denyGoalToolFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return denyFailedHook($, GOAL_TOOLS_SUBJECT, next.error)
}

/**
 * Changes the TODO entries of a goal with `change` for a call of the main conversation whose input
 * `tool` reads, and returns what the model is told of the outcome.
 */
async function changeTodosOfGoal<Todo>(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
  tool: TodoChangeTool<Todo>,
  change: (sessionId: string, goal: number, todo: Todo) => Promise<BoardChange | Failed>,
): Promise<ToolCallResult> {
  if (!isMainConversation(e)) {
    return { deny: SUBAGENT_DENIAL }
  }
  const input = readTodoInput(e, tool.readTodo)
  if (input.outcome !== TodoInputOutcome.Valid) {
    return { deny: tool.problems[input.outcome] }
  }
  const changed = await change(await $.session.id(), input.goal, input.todo)
  switch (changed.outcome) {
    case Outcome.Changed:
    case Outcome.Unchanged:
      return { result: tool.describeDone(input.goal, input.todo) }
    case Outcome.Refused:
      return { deny: describeRefusal(changed) }
    case Outcome.Failed:
      return denyFailedUse($, GOAL_TOOLS_SUBJECT, describeStoreFailure(changed))
  }
}
