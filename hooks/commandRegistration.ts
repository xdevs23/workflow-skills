import type { CommandSpec, EngineInterface } from 'claude-code'

import { describeNotRegistered } from './commandTexts'
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
 * Registers `command` for the session. When the engine rejects it, for example because a built-in
 * command uses its name, a toast shows the message of the engine and `lostWithoutCommand`, the
 * sentence on what the user cannot do without the command. The session start goes on. Rejects with
 * every other error.
 */
export async function registerCommandShowingRejection(
  $: CommandRegistrar,
  command: CommandSpec,
  lostWithoutCommand: string,
): Promise<void> {
  await $.command.register(command).catch((error: unknown) => {
    if (!isErrorWithText(error, COMMAND_REGISTER_CALL)) {
      throw error
    }
    showFailure(
      $,
      describeNotRegistered({ command: command.name, lostWithoutCommand, reason: error.message }),
    )
  })
}
