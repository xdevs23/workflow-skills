import type { EngineInterface } from 'claude-code'

import type { Goal } from '../../types'
import { showingStoreFailure } from '../failureToast'
import { returningStoreFailure } from '../pluginStore'
import {
  describeIdeaNotDeleted,
  describeIdeasFailure,
  describeIdeasNotRead,
  describeIdeasOfClearedGoalNotDeleted,
} from './ideaPaneTexts'
import { IdeasFailureKind, returningIdeasFailure, showingIdeasFailure } from './ideaProject'
import type { IdeasFailure } from './ideaProject'
import { IDEAS_PANE, keepButtonKeyOf } from './ideaNames'
import { IdeasOutcome, setIdeaAwaitingDelete, setIdeasInState } from './ideaState'
import type { LoadedIdeas } from './ideaState'
import { deleteIdea, deleteIdeasUnder, readIdeasOf } from './ideaStore'
import type { IdeaId } from './ideaStore'

// The Ideas pane draws the ideas from the state, since a drawing that read the store would start
// git and read every key of the store on each redraw. The state gets the ideas when the pane opens
// and after every save and delete.

/** Reads the ideas recorded in the project used by the session from the store into the state. */
export async function loadIdeasIntoState($: EngineInterface): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningIdeasFailure(
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
    failed => ideasNotRead({ kind: IdeasFailureKind.Store, failed }),
  )
  await setIdeasInState($, sessionId, loaded)
}

async function readLoadedIdeas($: EngineInterface, project: string): Promise<LoadedIdeas> {
  return {
    outcome: IdeasOutcome.Read,
    ...(await readIdeasOf($, { project, includesEntry: () => true })),
  }
}

function ideasNotRead(failure: IdeasFailure): LoadedIdeas {
  return { outcome: IdeasOutcome.Failed, failure: describeIdeasNotRead(failure) }
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
  await showingIdeasFailure(
    $,
    async project => {
      try {
        await deleteIdeasUnder($, { project, entries })
      } finally {
        await loadIdeasOfProjectIntoState($, project)
      }
    },
    failure => describeIdeasOfClearedGoalNotDeleted(goal.number, describeIdeasFailure(failure)),
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
