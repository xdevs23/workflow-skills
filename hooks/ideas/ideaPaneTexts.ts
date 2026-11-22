import type { HookSubject } from '../hookFailure'
import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'
import { IdeasFailureKind } from './ideaProject'
import type { IdeasFailure } from './ideaProject'

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

/** The reason and the next step for `failure`. */
export function describeIdeasFailure(failure: IdeasFailure): string {
  switch (failure.kind) {
    case IdeasFailureKind.Store:
      return describeFailedStoreCall(failure.failed)
    case IdeasFailureKind.GitNotRun:
      return (
        `git did not run in the project root ${failure.root}: ` +
        `${failure.cause.message}. Check that git is installed and runs in that folder, then ` +
        'try again.'
      )
    case IdeasFailureKind.GitRefused:
      return (
        `git exited with code ${failure.exitCode} in the project root ${failure.root}, which is ` +
        `inside a repository. Fix what git reports, then try again. git reported:\n` +
        failure.stderr.trim()
      )
  }
}

/** Builds the text the Ideas pane shows when `failure` stopped the read of the ideas. */
export function describeIdeasNotRead(failure: IdeasFailure): string {
  return `The ideas recorded in this project could not be read. ${describeIdeasFailure(failure)}`
}

export function describeIdeaNotDeleted(failed: FailedStoreCall): string {
  return `The store did not delete the idea. ${describeFailedStoreCall(failed)}`
}

/**
 * The toast shown when the ideas recorded for the TODO entries attached to goal `goalNumber` were
 * not deleted after the user cleared it, with `failure` saying why.
 */
export function describeIdeasOfClearedGoalNotDeleted(goalNumber: number, failure: string): string {
  return (
    `Goal ${goalNumber} is cleared, but not every idea recorded for the TODO entries attached to ` +
    `it was deleted. ${failure}`
  )
}
