import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'

// The texts shown to the user for ideas.

export const IDEAS_PANE_TITLE = 'Ideas'

export const IDEAS_BUTTON_LABEL = IDEAS_PANE_TITLE

export const IDEAS_DESCRIPTION =
  `Open the ideas recorded for the entries in TODO.md of this project in the ${IDEAS_PANE_TITLE} ` +
  'pane'

/** The ideas as written in the texts about a failed hook for /ideas. */
export const IDEAS_COMMAND_SUBJECT: HookSubject = { name: 'ideas' }

export const IDEAS_LOST_WITHOUT_COMMAND =
  `Open the ideas recorded in this project with the ${IDEAS_BUTTON_LABEL} button.`

export const IDEAS_LOADING = 'Reading the ideas recorded in this project…'

export const NO_IDEAS = 'This project does not have any recorded ideas.'

export const DELETE_IDEA_LABEL = 'Delete idea'

export const DELETE_IDEA_QUESTION = 'Delete this idea? Its words cannot be restored.'

export const YES_DELETE_LABEL = 'Yes, delete'

export const KEEP_LABEL = 'Keep'

export function describeIdeasNotRead(failed: FailedStoreCall): string {
  return `The ideas recorded in this project could not be read. ${describeFailedStoreCall(failed)}`
}

export function describeIdeaNotDeleted(failed: FailedStoreCall): string {
  return `The store did not delete the idea. ${describeFailedStoreCall(failed)}`
}
