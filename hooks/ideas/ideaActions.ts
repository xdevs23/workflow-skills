import type { EngineInterface } from 'claude-code'

import { showingStoreFailure } from '../failureToast'
import { returningStoreFailure } from '../pluginStore'
import { describeIdeaNotDeleted, describeIdeasNotRead } from './ideaPaneTexts'
import { readProjectOfIdeas } from './ideaProject'
import { IDEAS_PANE, keepButtonKeyOf } from './ideaNames'
import { IdeasOutcome, setIdeaAwaitingDelete, setIdeasInState } from './ideaState'
import type { LoadedIdeas } from './ideaState'
import { deleteIdea, readIdeasOf } from './ideaStore'
import type { IdeaId } from './ideaStore'

// The Ideas pane draws the ideas from the state, since a drawing that read the store would start
// git and read every key of the store on each redraw. The state gets the ideas when the pane opens
// and after every save and delete.

/** Reads the ideas recorded in `project` from the store into the state. */
export async function loadIdeasIntoState($: EngineInterface, project: string): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningStoreFailure(
    async (): Promise<LoadedIdeas> => ({
      outcome: IdeasOutcome.Read,
      ...(await readIdeasOf($, { project, includesEntry: () => true })),
    }),
    (failed): LoadedIdeas => ({
      outcome: IdeasOutcome.Failed,
      failure: describeIdeasNotRead(failed),
    }),
  )
  await setIdeasInState($, sessionId, loaded)
}

/** Deletes the idea `id`, shows a failed delete in a toast, and loads the ideas again. */
export async function deleteIdeaOnScreen($: EngineInterface, id: IdeaId): Promise<void> {
  await showingStoreFailure($, () => deleteIdea($, id), describeIdeaNotDeleted)
  await loadIdeasIntoState($, await readProjectOfIdeas($))
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
