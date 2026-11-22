import { toolName } from '../names'

export const GOALS_COMMAND = 'goals'

export const GOALS_PANE = 'goals'

/** The site of the Goals pane, which its hooks match. */
export const GOALS_PANE_SITE = { component: 'Pane', requestId: GOALS_PANE } as const

/** The key of the region the surface module of the Goals pane draws. */
export const GOALS_PANE_MODULE = 'goals-pane'

export const LIST_GOALS = 'list_goals'
export const ATTACH_TODO = 'attach_todo'
export const DETACH_TODO = 'detach_todo'
export const MARK_GOAL_DONE = 'mark_goal_done'
export const UNMARK_GOAL_DONE = 'unmark_goal_done'

export const LIST_GOALS_TOOL = toolName(LIST_GOALS)
export const ATTACH_TODO_TOOL = toolName(ATTACH_TODO)
export const DETACH_TODO_TOOL = toolName(DETACH_TODO)
export const MARK_GOAL_DONE_TOOL = toolName(MARK_GOAL_DONE)
export const UNMARK_GOAL_DONE_TOOL = toolName(UNMARK_GOAL_DONE)
