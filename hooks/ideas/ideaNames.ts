import { toolName } from '../names'
import type { IdeaId } from './ideaStore'

export const RECORD_IDEA = 'record_idea'
export const GET_IDEAS = 'get_ideas'
export const DELETE_IDEAS = 'delete_ideas'

export const RECORD_IDEA_TOOL = toolName(RECORD_IDEA)
export const GET_IDEAS_TOOL = toolName(GET_IDEAS)
export const DELETE_IDEAS_TOOL = toolName(DELETE_IDEAS)

export const IDEAS_COMMAND = 'ideas'

export const IDEAS_PANE = 'ideas'

/** The name of the ideas feature among the features that set a hook on a cleared goal. */
export const IDEAS_FEATURE = 'ideas'

/** The site for the Ideas pane, which the hooks match. */
export const IDEAS_PANE_SITE = { component: 'Pane', requestId: IDEAS_PANE } as const

/** The key of the Keep button drawn by the question whether to delete the idea `id`. */
export function keepButtonKeyOf(id: IdeaId): string {
  return `keep-${id}`
}
