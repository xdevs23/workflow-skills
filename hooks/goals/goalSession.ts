import type { EngineInterface, MatchedHook } from 'claude-code'

import { isErrorWithText } from '../errorMessage'
import { showFailure } from '../failureToast'
import { loadBoardAtStart } from './goalActions'
import { GOALS_COMMAND } from './goalNames'
import { readBoardInState } from './goalState'
import { GOALS_ARGUMENTS, GOALS_DESCRIPTION, describeNotRegistered } from './goalTexts'

/**
 * The name of the call, contained in every error with which the engine rejects it: a refusal by the
 * engine or by a hook, and an argument the engine does not accept.
 */
const COMMAND_REGISTER_CALL = '$.command.register'

/** The parts of the engine used to register /goals and to show why the engine rejected it. */
export type CommandRegistrar = {
  command: Pick<EngineInterface['command'], 'register'>
  ui: Pick<EngineInterface['ui'], 'log' | 'toast'>
}

/**
 * Registers /goals for the session. A rejection by the engine, such as the refusal of a name used
 * by a built-in command, is shown in a toast, and the session start and the read of the board go
 * on. Rejects with every other error.
 */
export async function registerGoalsCommand($: CommandRegistrar): Promise<void> {
  await $.command
    .register({
      name: GOALS_COMMAND,
      description: GOALS_DESCRIPTION,
      argumentHint: GOALS_ARGUMENTS,
      immediate: true,
    })
    .catch((error: unknown) => {
      if (!isErrorWithText(error, COMMAND_REGISTER_CALL)) {
        throw error
      }
      showFailure($, describeNotRegistered(error.message))
    })
}

/**
 * The sources of the classic SessionStart hook after which another session may run: /resume, /clear
 * and a fork do not raise a start, but run that hook for the session they switched to.
 */
export const SWITCHING_SOURCES = ['resume', 'clear', 'fork'] as const

/** The source of the classic SessionStart hook after a compaction. */
export const COMPACTION_SOURCE = 'compact'

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
