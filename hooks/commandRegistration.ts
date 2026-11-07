import type { CommandSpec, EngineInterface } from 'claude-code'

import { isErrorWithText } from './errorMessage'
import { showFailure } from './failureToast'

/**
 * The name of the call, contained in every error with which the engine rejects it: a refusal by the
 * engine or by a hook, and an argument the engine does not accept.
 */
const COMMAND_REGISTER_CALL = '$.command.register'

/** The parts of the engine used to register a command and to show why the engine rejected it. */
export type CommandRegistrar = {
  command: Pick<EngineInterface['command'], 'register'>
  ui: Pick<EngineInterface['ui'], 'log' | 'toast'>
}

/**
 * Registers `command` for the session. A rejection by the engine, such as the refusal of a name
 * used by a built-in command, is shown in a toast with the text written by `describeNotRegistered`
 * from its message, and the session start goes on. Rejects with every other error.
 */
export async function registerCommandShowingRejection(
  $: CommandRegistrar,
  command: CommandSpec,
  describeNotRegistered: (reason: string) => string,
): Promise<void> {
  await $.command.register(command).catch((error: unknown) => {
    if (!isErrorWithText(error, COMMAND_REGISTER_CALL)) {
      throw error
    }
    showFailure($, describeNotRegistered(error.message))
  })
}
