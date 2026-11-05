import type { EngineInterface, MatchedHook } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import { loadBoardShowingFailure } from './goalActions'
import { GOALS_COMMAND } from './goalNames'
import { readBoardInState } from './goalState'
import { GOALS_ARGUMENTS, GOALS_DESCRIPTION, describeNotRegistered } from './goalTexts'

/**
 * Registers /goals for the session. Registering fails for the name of a built-in command. The
 * failure is shown in a toast, and the start of the session and the read of the board go on.
 */
export async function registerGoalsCommand($: EngineInterface): Promise<void> {
  await $.command
    .register({
      name: GOALS_COMMAND,
      description: GOALS_DESCRIPTION,
      argumentHint: GOALS_ARGUMENTS,
      immediate: true,
    })
    .catch((error: unknown) => showFailure($, describeNotRegistered(messageOf(error))))
}

/**
 * The sources of the classic SessionStart hook after which another session may run: /resume, /clear
 * and a fork do not raise a start, but run that hook for the session they switched to.
 */
export const SWITCHING_SOURCES = ['resume', 'clear', 'fork'] as const

// The session reads its board here unless the state already has it, including a board that could
// not be read, since a process started with --resume runs this hook after the start read the board.
export const readGoalsOfSwitchedSession: MatchedHook<
  'classic.SessionStart',
  { source: typeof SWITCHING_SOURCES }
> = async ($, e, next) => {
  if ((await readBoardInState($)) === null) {
    await loadBoardShowingFailure($, await $.session.id())
  }

  return next(e)
}
