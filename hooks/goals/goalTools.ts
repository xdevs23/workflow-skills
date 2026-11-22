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
import type { ToolArguments } from '../inputs'
import { toolName } from '../names'
import { Outcome } from './board'
import type { AttachRefused, Changed, DetachRefused, Unchanged } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { attachTodoInSession, detachTodoInSession, readBoardOfSession } from './goalActions'
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
  InputOutcome,
  readTodoInput,
} from './goalToolInputs'
import type { TodoInput, ToolInput } from './goalToolInputs'
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
  withNotesOnOpenGoals,
} from './goalToolTexts'
import { readEntryNumber } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'
import { readEntryHeading } from './todoEntry'
import type { TodoEntry } from './todoEntry'

/** The tools by which the model lists the goals. */
export const GOAL_TOOL_SPECS: readonly ToolSpec[] = [
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

/** The tools of the goals board, as the engine lists them. */
export const GOAL_TOOLS: ReadonlySet<string> = new Set(
  GOAL_TOOL_SPECS.map(tool => toolName(tool.name)),
)

/**
 * How a tool of the main conversation that changes a goal reads its input and describes its
 * change.
 */
type GoalChangeTool<Input> = {
  readInput: (args: ToolArguments) => ToolInput<Input>
  describeDone: (input: Input) => string
}

/** The outcomes of a change made by a goal tool. */
type ToolChange = Changed | Unchanged | AttachRefused | DetachRefused | Failed

const ATTACHING: GoalChangeTool<TodoInput<TodoEntry>> = {
  readInput: args => readTodoInput(args, readEntryHeading, ATTACH_PROBLEMS),
  describeDone: ({ goal, todo }) => describeAttached(goal, todo),
}

const DETACHING: GoalChangeTool<TodoInput<EntryNumber>> = {
  readInput: args => readTodoInput(args, readEntryNumber, DETACH_PROBLEMS),
  describeDone: ({ goal, todo }) => describeDetached(goal, todo),
}

// A subagent reads the goals too, so it can check its work against them. It works on a task of its
// own, so only the main conversation gets the notes on open goals.
export const listGoals: MatchedHook<'tool.call', { tool: typeof LIST_GOALS_TOOL }> = async (
  $,
  e,
) => {
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    return denyFailedUse($, GOAL_TOOLS_SUBJECT, read.failure)
  }
  const listed = describeGoals(read.board, await $.clock.now())

  return { result: isMainConversation(e) ? withNotesOnOpenGoals(read.board, listed) : listed }
}

export const attachTodo: MatchedHook<'tool.call', { tool: typeof ATTACH_TODO_TOOL }> = ($, e) =>
  changeGoalByTool($, e, ATTACHING, (sessionId, { goal, todo }) =>
    attachTodoInSession($, sessionId, goal, todo),
  )

export const detachTodo: MatchedHook<'tool.call', { tool: typeof DETACH_TODO_TOOL }> = ($, e) =>
  changeGoalByTool($, e, DETACHING, (sessionId, { goal, todo }) =>
    detachTodoInSession($, sessionId, goal, todo),
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
 * Changes a goal with `change` for a call of the main conversation whose input `tool` reads, and
 * returns what the model is told of the outcome.
 */
async function changeGoalByTool<Input>(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
  tool: GoalChangeTool<Input>,
  change: (sessionId: string, input: Input) => Promise<ToolChange>,
): Promise<ToolCallResult> {
  if (!isMainConversation(e)) {
    return { deny: SUBAGENT_DENIAL }
  }
  const read = tool.readInput(e)
  if (read.outcome !== InputOutcome.Valid) {
    return { deny: read.problem }
  }
  const changed = await change(await $.session.id(), read.input)
  switch (changed.outcome) {
    case Outcome.Changed:
    case Outcome.Unchanged:
      return { result: withNotesOnOpenGoals(changed.board, tool.describeDone(read.input)) }
    case Outcome.Refused:
      return { deny: describeRefusal(changed) }
    case Outcome.Failed:
      return denyFailedUse($, GOAL_TOOLS_SUBJECT, describeStoreFailure(changed))
  }
}
