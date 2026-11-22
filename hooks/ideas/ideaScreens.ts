import type { EngineInterface } from 'claude-code'

import { openPane } from '../paneOpening'
import type { PaneOpener } from '../paneOpening'
import { loadIdeasIntoState } from './ideaActions'
import { IDEAS_PANE } from './ideaNames'
import { IDEAS_PANE_TITLE } from './ideaPaneTexts'

/**
 * Reads the ideas recorded in the project into the state, opens the Ideas pane on them, and returns
 * the reasons it did not open. The list is empty once it opened.
 */
export async function openIdeasPane($: EngineInterface, opener: PaneOpener): Promise<string[]> {
  await loadIdeasIntoState($)
  const notOpened = await openPane($, { id: IDEAS_PANE, title: IDEAS_PANE_TITLE }, opener)

  return notOpened === undefined ? [] : [notOpened]
}
