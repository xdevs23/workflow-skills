import type { CommandRunInput, CommandRunResult, CommandSpec, Frozen } from 'claude-code'

import type { HookSubject } from './hookFailure'

/** The hook that registers a slash command of the plugin with the engine. */
export enum CommandRegistrar {
  /** registerPluginCommands of commandDispatch.ts, which shows a rejection in a toast. */
  CommandList = 'commandList',
  /** The session.start hook of the feature, whose start fails when the engine rejects it. */
  FeatureStart = 'featureStart',
}

type CommandBehavior = {
  spec: CommandSpec
  /** Runs the command `e`, and returns its reply. */
  run: (e: Frozen<CommandRunInput>) => Promise<CommandRunResult>
  /** What the reply names when running the command `e` failed. */
  subjectOf: (e: Frozen<CommandRunInput>) => HookSubject
}

type RegisteredByCommandList = CommandBehavior & {
  registeredBy: CommandRegistrar.CommandList
  /** The sentence on what the user cannot do when the engine rejects the command. */
  lostWithoutCommand: string
  /** Whether the command is registered only in a session with a person at the prompt. */
  isInteractiveOnly: boolean
}

type RegisteredByFeatureStart = CommandBehavior & {
  registeredBy: CommandRegistrar.FeatureStart
}

/** A slash command of the plugin, which commandDispatch.ts runs by its name. */
export type PluginCommand = RegisteredByCommandList | RegisteredByFeatureStart
