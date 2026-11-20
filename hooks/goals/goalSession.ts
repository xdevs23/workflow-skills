import type { MatchedHook } from 'claude-code'

import type { SWITCHING_SOURCES } from '../sessionSources'
import { loadBoardAtStart } from './goalActions'
import { readBoardInState } from './goalState'

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
