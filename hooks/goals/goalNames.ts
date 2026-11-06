import { toolName } from '../names'

export const GOALS_COMMAND = 'goals'
/** The word after /goals that adds a goal. */
export const ADD_WORD = 'add'
/** The word after /goals that gives a goal a new text. */
export const EDIT_WORD = 'edit'
/** The word after /goals that removes the done mark of a goal. */
export const UNMARK_WORD = 'unmark'
/** The word after /goals that clears a goal. */
export const CLEAR_WORD = 'clear'

export const GOALS_PANE = 'goals'

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
