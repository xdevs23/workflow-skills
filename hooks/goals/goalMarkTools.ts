import type { MatchedHook } from 'claude-code'

import { markGoalDoneInSession, removeDoneMarkInSession } from './goalActions'
import { MARK_GOAL_DONE_TOOL, UNMARK_GOAL_DONE_TOOL } from './goalNames'
import { readGoalInput, readMarkInput } from './goalToolInputs'
import type { GoalInput, MarkInput } from './goalToolInputs'
import { changeGoalByTool } from './goalTools'
import type { GoalChangeTool } from './goalTools'
import {
  MARK_SUBAGENT_DENIAL,
  describeMarkRemovedForModel,
  describeMarkedDone,
} from './goalToolTexts'
import { MarkRemover } from './doneMark'

const MARKING: GoalChangeTool<MarkInput> = {
  subagentDenial: MARK_SUBAGENT_DENIAL,
  readInput: readMarkInput,
  describeDone: ({ goal }) => describeMarkedDone(goal),
}

const UNMARKING: GoalChangeTool<GoalInput> = {
  subagentDenial: MARK_SUBAGENT_DENIAL,
  readInput: readGoalInput,
  describeDone: ({ goal }) => describeMarkRemovedForModel(goal),
}

export const handleMarkGoalDoneCall: MatchedHook<
  'tool.call',
  { tool: typeof MARK_GOAL_DONE_TOOL }
> = ($, e) =>
  changeGoalByTool($, e, MARKING, (sessionId, { goal, evidence }) =>
    markGoalDoneInSession($, sessionId, goal, evidence),
  )

export const handleUnmarkGoalDoneCall: MatchedHook<
  'tool.call',
  { tool: typeof UNMARK_GOAL_DONE_TOOL }
> = ($, e) =>
  changeGoalByTool($, e, UNMARKING, (sessionId, { goal }) =>
    removeDoneMarkInSession($, sessionId, goal, { removedBy: MarkRemover.Model }),
  )
