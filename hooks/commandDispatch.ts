import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  Hook,
  Next,
} from 'claude-code'

import { registerCommandShowingRejection } from './commandRegistration'
import { goalsCommand } from './goals/goalCommands'
import { replyToFailedHook } from './hookFailure'
import { importCommands } from './imports'
import { CommandRegistrar, type PluginCommand } from './pluginCommand'
import { replyCommand } from './requestHooks'
import { remindersCommand } from './reminders/remindersCommand'
import { idleRoastCommand } from './roast/idleRoastCommand'
import { roastCommand } from './roast/roastCommand'

// In a probe on Claude Code 2.1.325, /roast typed once gave no entry in history.jsonl with the 8
// `command.run` hooks this plugin had then, and 1 entry with the /roast hook alone or with this
// one hook. So every slash command of this plugin runs from one hook, until a probe on a later
// release finds /roast in the prompt history while each feature has a `command.run` hook of its
// own.

/**
 * Every slash command of the plugin, which runPluginCommandOrNext runs. registerPluginCommands
 * registers each one not registered by the start of its feature. Of two commands with one name,
 * the first in this list runs. The engine passes `$` only to a function named at the call, so this
 * file calls one function for each feature with slash commands.
 */
function pluginCommands($: EngineInterface): PluginCommand[] {
  return [
    replyCommand($),
    goalsCommand($),
    remindersCommand($),
    ...importCommands($),
    roastCommand($),
    idleRoastCommand($),
  ]
}

function pluginCommandNamed($: EngineInterface, name: string): PluginCommand | undefined {
  return pluginCommands($).find(command => command.spec.name === name)
}

/**
 * Registers every slash command of the plugin that its feature does not register for the session,
 * the commands marked interactive only just where a person is at the prompt. A command the engine
 * rejects is shown in a toast, and the session start goes on.
 */
export const registerPluginCommands: Hook<'session.start'> = async ($, e, next) => {
  await Promise.all(
    pluginCommands($).flatMap(command =>
      command.registeredBy === CommandRegistrar.CommandList &&
      (e.isInteractive || !command.isInteractiveOnly)
        ? [registerCommandShowingRejection($, command.spec, command.lostWithoutCommand)]
        : [],
    ),
  )

  return next(e)
}

/**
 * Runs the command `e`: the command of the plugin registered under that name, or else the next
 * hook.
 */
export async function runPluginCommandOrNext(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
  next: Next<'command.run'>,
): Promise<CommandRunResult> {
  const command = pluginCommandNamed($, e.command)

  return command === undefined ? next(e) : command.run(e)
}

/**
 * The reply to the command `e` when the `command.run` hook of the plugin failed. Returns
 * `undefined` for a command not of the plugin, which the engine then runs as if the hook were
 * absent.
 */
export function replyToFailedPluginCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult | undefined {
  const command = pluginCommandNamed($, e.command)

  return command === undefined ? undefined : replyToFailedHook($, command.subjectOf(e), next.error)
}
