import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../storeFailures'
import type { FailedStoreCall } from '../storeFailures'
import { describeProjectFailure } from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'

// The texts shown to the user for ideas.

export const IDEAS_PANE_TITLE = 'Ideas'

export const IDEAS_BUTTON_LABEL = IDEAS_PANE_TITLE

export const IDEAS_DESCRIPTION =
  `Open the ideas recorded in this project in the ${IDEAS_PANE_TITLE} pane`

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

/** Builds the text the Ideas pane shows when `failure` stopped the read of the ideas. */
export function describeIdeasNotRead(failure: ProjectFailure): string {
  return `The ideas recorded in this project could not be read. ${describeProjectFailure(failure)}`
}

export function describeIdeaNotDeleted(failed: FailedStoreCall): string {
  return `The store did not delete the idea. ${describeFailedStoreCall(failed)}`
}

export function describeIdeasOfClearedGoalsNotUnlinked(failure: string): string {
  return (
    'Not every idea recorded for a cleared goal was turned into a project idea. The next start ' +
    `of this session tries again. ${failure}`
  )
}

export function describeIdeasOfImportedGoalsNotRelinked(failure: string): string {
  return (
    'The goals are imported, but not every idea recorded for them in the earlier session was ' +
    `linked to the imported goal. ${failure}`
  )
}
