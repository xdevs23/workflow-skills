import type { MatchedHook } from 'claude-code'

import { registerCommandShowingRejection } from '../commandRegistration'
import type { CommandRegistrar } from '../commandRegistration'
import type { SWITCHING_SOURCES } from '../sessionSources'
import { loadBoardAtStart } from './goalActions'
import { GOALS_COMMAND } from './goalNames'
import { readBoardInState } from './goalState'
import { GOALS_DESCRIPTION, describeNotRegistered } from './goalTexts'

/**
 * Registers /goals for the session. A rejection by the engine is shown in a toast, and the session
 * start and the read of the board go on. Rejects with every other error.
 */
export async function registerGoalsCommand($: CommandRegistrar): Promise<void> {
  await registerCommandShowingRejection(
    $,
    { name: GOALS_COMMAND, description: GOALS_DESCRIPTION, immediate: true },
    describeNotRegistered,
  )
}

// The session reads its board here unless the state already has it, including a board that could
// not be read, since a process started with --resume runs this hook after the start read the board.
export const readGoalsOfSwitchedSession: MatchedHook<
  'classic.SessionStart',
  { source: typeof SWITCHING_SOURCES }
> = async ($, e, next) => {
  if ((await readBoardInState($)) === null) {
    await loadBoardAtStart($, await $.session.id())
  }

  return next(e)
}
