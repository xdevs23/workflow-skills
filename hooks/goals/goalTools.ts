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
import type { ChangeRefused, Changed, MarkRefused, Unchanged, UnmarkRefused } from './board'
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
  MARK_GOAL_DONE,
  UNMARK_GOAL_DONE,
} from './goalNames'
import {
  ATTACH_PROBLEMS,
  ATTACH_TODO_SCHEMA,
  DETACH_PROBLEMS,
  DETACH_TODO_SCHEMA,
  InputOutcome,
  MARK_GOAL_DONE_SCHEMA,
  UNMARK_GOAL_DONE_SCHEMA,
  readTodoInput,
} from './goalToolInputs'
import type { TodoInput, ToolInput } from './goalToolInputs'
import {
  ATTACH_TODO_DESCRIPTION,
  DETACH_TODO_DESCRIPTION,
  GOAL_TOOLS_SUBJECT,
  GoalsReader,
  LIST_GOALS_DESCRIPTION,
  MARK_GOAL_DONE_DESCRIPTION,
  SUBAGENT_DENIAL,
  UNMARK_GOAL_DONE_DESCRIPTION,
  describeAttached,
  describeDetached,
  describeGoals,
  describeRefusal,
  withGoalsNotExhaustive,
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
  {
    name: MARK_GOAL_DONE,
    description: MARK_GOAL_DONE_DESCRIPTION,
    inputSchema: MARK_GOAL_DONE_SCHEMA,
    isDeferred: false,
  },
  {
    name: UNMARK_GOAL_DONE,
    description: UNMARK_GOAL_DONE_DESCRIPTION,
    inputSchema: UNMARK_GOAL_DONE_SCHEMA,
    isDeferred: false,
  },
]

/** The tools of the goals board, as the engine lists them. */
export const GOAL_TOOLS: ReadonlySet<string> = new Set(TOOLS.map(tool => toolName(tool.name)))

/**
 * How a tool of the main conversation that changes a goal reads its input and describes its
 * change.
 */
export type GoalChangeTool<Input> = {
  /** What a subagent is told, since only the main conversation makes the change. */
  subagentDenial: string
  readInput: (args: ToolArguments) => ToolInput<Input>
  describeDone: (input: Input) => string
}

/** The outcomes of a change made by a goal tool. */
type ToolChange = Changed | Unchanged | ChangeRefused | MarkRefused | UnmarkRefused | Failed

const ATTACHING: GoalChangeTool<TodoInput<TodoEntry>> = {
  subagentDenial: SUBAGENT_DENIAL,
  readInput: args => readTodoInput(args, readEntryHeading, ATTACH_PROBLEMS),
  describeDone: ({ goal, todo }) => describeAttached(goal, todo),
}

const DETACHING: GoalChangeTool<TodoInput<string>> = {
  subagentDenial: SUBAGENT_DENIAL,
  readInput: args => readTodoInput(args, readEntryNumber, DETACH_PROBLEMS),
  describeDone: ({ goal, todo }) => describeDetached(goal, todo),
}

/**
 * Registers the tools by which the model lists the goals, attaches TODO entries to them and marks
 * them as done.
 */
export async function registerGoalTools($: EngineInterface): Promise<void> {
  await Promise.all(TOOLS.map(tool => $.tool.register(tool)))
}

// A subagent reads the goals too, so it can check its work against them. It works on a task of its
// own, so only the main conversation is told that the goals are not exhaustive, and a subagent
// reads the done marks as set by the main conversation.
export const listGoals: MatchedHook<'tool.call', { tool: typeof LIST_GOALS_TOOL }> = async (
  $,
  e,
) => {
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    return denyFailedUse($, GOAL_TOOLS_SUBJECT, read.failure)
  }
  if (!isMainConversation(e)) {
    return { result: describeGoals(read.board, GoalsReader.Subagent) }
  }
  const listed = describeGoals(read.board, GoalsReader.MainConversation)

  return { result: withGoalsNotExhaustive(read.board, listed) }
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
export async function changeGoalByTool<Input>(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
  tool: GoalChangeTool<Input>,
  change: (sessionId: string, input: Input) => Promise<ToolChange>,
): Promise<ToolCallResult> {
  if (!isMainConversation(e)) {
    return { deny: tool.subagentDenial }
  }
  const read = tool.readInput(e)
  if (read.outcome !== InputOutcome.Valid) {
    return { deny: read.problem }
  }
  const changed = await change(await $.session.id(), read.input)
  switch (changed.outcome) {
    case Outcome.Changed:
    case Outcome.Unchanged:
      return { result: withGoalsNotExhaustive(changed.board, tool.describeDone(read.input)) }
    case Outcome.Refused:
      return { deny: describeRefusal(changed) }
    case Outcome.Failed:
      return denyFailedUse($, GOAL_TOOLS_SUBJECT, describeStoreFailure(changed))
  }
}
