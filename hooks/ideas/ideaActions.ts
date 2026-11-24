import type { EngineInterface } from 'claude-code'

import type { Goal } from '../../types'
import { showFailure, showingStoreFailure } from '../failureToast'
import { Outcome, clearedGoalsOf } from '../goals/board'
import { readBoardOfSession } from '../goals/goalActions'
import type { ImportedGoal } from '../goals/goalImport'
import { describeUnreadableRecord, returningStoreFailure } from '../pluginStore'
import {
  describeProjectFailure,
  returningProjectFailure,
  showingProjectFailure,
} from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import { ProjectFailureKind } from '../projectLookup'
import {
  describeIdeaNotDeleted,
  describeIdeasNotRead,
  describeIdeasOfClearedGoalsNotUnlinked,
  describeIdeasOfImportedGoalsNotRelinked,
} from './ideaPaneTexts'
import { IdeaLinkKind, goalLinkOf } from './ideaLink'
import type { GoalLink, IdeaLink, ProjectLink } from './ideaLink'
import { IDEAS_PANE, keepButtonKeyOf } from './ideaNames'
import { IdeasOutcome, setIdeaAwaitingDelete, setIdeasInState } from './ideaState'
import type { LoadedIdeas } from './ideaState'
import { deleteIdea, readIdeasOf, relinkIdeasOf } from './ideaStore'
import type { IdeaId } from './ideaStore'

// The Ideas pane draws the ideas from the state, since a drawing that read the store would start
// git and read every key of the store on each redraw. The state gets the ideas when the pane opens
// and after every save, unlink and delete.

/** Reads the ideas recorded in the project used by the session from the store into the state. */
export async function loadIdeasIntoState($: EngineInterface): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningProjectFailure(
    $,
    () => readLoadedIdeas($),
    ideasNotRead,
  )
  await setIdeasInState($, sessionId, loaded)
}

/** Reads the ideas recorded in the project from the store into the state. */
export async function loadIdeasOfProjectIntoState($: EngineInterface): Promise<void> {
  const sessionId = await $.session.id()
  const loaded = await returningStoreFailure(
    () => readLoadedIdeas($),
    failed => ideasNotRead({ kind: ProjectFailureKind.Store, failed }),
  )
  await setIdeasInState($, sessionId, loaded)
}

async function readLoadedIdeas($: EngineInterface): Promise<LoadedIdeas> {
  return { outcome: IdeasOutcome.Read, ...(await readIdeasOf($, () => true)) }
}

function ideasNotRead(failure: ProjectFailure): LoadedIdeas {
  return { outcome: IdeasOutcome.Failed, failure: describeIdeasNotRead(failure) }
}

/** Deletes the idea `id`, shows a failed delete in a toast, and loads the ideas again. */
export async function deleteIdeaOnScreen($: EngineInterface, id: IdeaId): Promise<void> {
  await showingStoreFailure($, () => deleteIdea($, id), describeIdeaNotDeleted)
  await loadIdeasIntoState($)
}

export async function unlinkIdeasOfJustClearedGoal($: EngineInterface): Promise<void> {
  const failure = await unlinkIdeasOfClearedGoals($)
  if (failure !== undefined) {
    $.ui.log(describeIdeasOfClearedGoalsNotUnlinked(failure), { to: 'debug' })
  }
}

export async function repairIdeasOfClearedGoals($: EngineInterface): Promise<void> {
  const failure = await unlinkIdeasOfClearedGoals($)
  if (failure !== undefined) {
    showFailure($, describeIdeasOfClearedGoalsNotUnlinked(failure))
  }
}

async function unlinkIdeasOfClearedGoals($: EngineInterface): Promise<string | undefined> {
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    return read.failure
  }
  const cleared = new Map(clearedGoalsOf(read.board).map(goal => [goal.id, goal]))
  if (cleared.size === 0) {
    return undefined
  }

  return returningProjectFailure(
    $,
    async () => {
      await relinkIdeasOnScreen($, link => relinkToProjectFromGoals(link, cleared))

      return undefined
    },
    describeProjectFailure,
  )
}

export async function relinkIdeasOfImportedGoals(
  $: EngineInterface,
  imported: readonly ImportedGoal[],
): Promise<void> {
  const importedBySource = new Map(imported.map(({ sourceId, goal }) => [sourceId, goal]))
  if (importedBySource.size === 0) {
    return
  }
  await showingProjectFailure(
    $,
    () => relinkIdeasOnScreen($, link => relinkToImportedGoal(link, importedBySource)),
    failure => describeIdeasOfImportedGoalsNotRelinked(describeProjectFailure(failure)),
  )
}

async function relinkIdeasOnScreen(
  $: EngineInterface,
  relink: (link: IdeaLink) => IdeaLink | undefined,
): Promise<void> {
  try {
    const { unreadableKeys } = await relinkIdeasOf($, relink)
    for (const key of unreadableKeys) {
      $.ui.log(describeUnreadableRecord(key), { to: 'debug' })
    }
  } finally {
    await loadIdeasOfProjectIntoState($)
  }
}

function relinkToProjectFromGoals(
  link: IdeaLink,
  cleared: ReadonlyMap<string, Goal>,
): ProjectLink | undefined {
  const goal = link.kind === IdeaLinkKind.Goal ? cleared.get(link.goal.id) : undefined

  return goal === undefined ? undefined : { kind: IdeaLinkKind.Project, wasFor: goalLinkOf(goal) }
}

function relinkToImportedGoal(
  link: IdeaLink,
  importedBySource: ReadonlyMap<string, Goal>,
): GoalLink | undefined {
  const goal = link.kind === IdeaLinkKind.Goal ? importedBySource.get(link.goal.id) : undefined

  return goal === undefined ? undefined : goalLinkOf(goal)
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
