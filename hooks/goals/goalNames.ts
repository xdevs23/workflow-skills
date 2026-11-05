import { toolName } from '../names'

export const GOALS_COMMAND = 'goals'
/** The word after /goals that adds a goal. */
export const ADD_WORD = 'add'
/** The word after /goals that clears a goal. */
export const CLEAR_WORD = 'clear'

export const GOALS_PANE = 'goals'

export const LIST_GOALS = 'list_goals'
export const ATTACH_TODO = 'attach_todo'
export const DETACH_TODO = 'detach_todo'

export const LIST_GOALS_TOOL = toolName(LIST_GOALS)
export const ATTACH_TODO_TOOL = toolName(ATTACH_TODO)
export const DETACH_TODO_TOOL = toolName(DETACH_TODO)
