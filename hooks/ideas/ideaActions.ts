import type { EngineInterface } from 'claude-code'

import type { Goal } from '../../types'
import { showingStoreFailure } from '../failureToast'
import { returningStoreFailure } from '../pluginStore'
import {
  ProjectFailureKind,
  describeProjectFailure,
  returningProjectFailure,
  showingProjectFailure,
} from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import {
  describeIdeaNotDeleted,
  describeIdeasNotRead,
  describeIdeasOfClearedGoalNotDeleted,
} from './ideaPaneTexts'
import { IDEAS_PANE, keepButtonKeyOf } from './ideaNames'
import { IdeasOutcome, setIdeaAwaitingDelete, setIdeasInState } from './ideaState'
import type { LoadedIdeas } from './ideaState'
import { deleteIdea, deleteIdeasUnder, readIdeasOf, readIdeasRecordedBy } from './ideaStore'
import type { Idea, IdeaId } from './ideaStore'

// The Ideas pane draws the ideas from the state, since a drawing that read the store would start
// git and read every key of the store on each redraw. The state gets the ideas when the pane opens
// and after every save and delete.

/** Reads the ideas recorded in the project used by the session from the store into the state. */
export async function loadIdeasIntoState($: EngineInterface): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningProjectFailure(
    $,
    project => readLoadedIdeas($, project),
    ideasNotRead,
  )
  await setIdeasInState($, sessionId, loaded)
}

/** Reads the ideas recorded in `project` from the store into the state. */
export async function loadIdeasOfProjectIntoState(
  $: EngineInterface,
  project: string,
): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningStoreFailure(
    () => readLoadedIdeas($, project),
    failed => ideasNotRead({ kind: ProjectFailureKind.Store, failed }),
  )
  await setIdeasInState($, sessionId, loaded)
}

async function readLoadedIdeas($: EngineInterface, project: string): Promise<LoadedIdeas> {
  return {
    outcome: IdeasOutcome.Read,
    ...(await readIdeasOf($, { project, includesEntry: () => true })),
  }
}

function ideasNotRead(failure: ProjectFailure): LoadedIdeas {
  return { outcome: IdeasOutcome.Failed, failure: describeIdeasNotRead(failure) }
}

export type IdeasOfSession =
  | {
      readonly isKnown: true
      readonly ideas: readonly Idea[]
      readonly unreadableKeys: readonly string[]
    }
  | { readonly isKnown: false; readonly cause: string }

export async function readIdeasRecordedBySession($: EngineInterface): Promise<IdeasOfSession> {
  const sessionId = await $.session.id()

  return returningProjectFailure(
    $,
    async (project): Promise<IdeasOfSession> => {
      return { isKnown: true, ...(await readIdeasRecordedBy($, { project, sessionId })) }
    },
    (failure): IdeasOfSession => ({ isKnown: false, cause: describeProjectFailure(failure) }),
  )
}

/** Deletes the idea `id`, shows a failed delete in a toast, and loads the ideas again. */
export async function deleteIdeaOnScreen($: EngineInterface, id: IdeaId): Promise<void> {
  await showingStoreFailure($, () => deleteIdea($, id), describeIdeaNotDeleted)
  await loadIdeasIntoState($)
}

/**
 * Deletes the ideas recorded for each TODO entry attached to `goal`, which the user cleared, and
 * for every entry under it. Shows a failed delete in a toast, and loads the ideas again after the
 * delete, also after a failed one.
 */
export async function deleteIdeasOfClearedGoal($: EngineInterface, goal: Goal): Promise<void> {
  const entries = goal.todos.map(todo => todo.number)
  await showingProjectFailure(
    $,
    async project => {
      try {
        await deleteIdeasUnder($, { project, entries })
      } finally {
        await loadIdeasOfProjectIntoState($, project)
      }
    },
    failure => describeIdeasOfClearedGoalNotDeleted(goal.number, describeProjectFailure(failure)),
  )
}

/**
 * Asks whether to delete the idea `id`, with the focus on Keep. The focus stays where the person
 * moved it, on the button that the question draws in place of Delete idea, so a second Enter would
 * delete the idea at once.
 */
export async function askToDeleteIdea($: EngineInterface, id: IdeaId): Promise<void> {
  await setIdeaAwaitingDelete($, id)
  await $.ui.focus({ requestId: IDEAS_PANE, key: keepButtonKeyOf(id) })
}
