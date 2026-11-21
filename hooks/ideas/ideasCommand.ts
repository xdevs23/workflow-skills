import type { EngineInterface } from 'claude-code'

import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { IDEAS_COMMAND } from './ideaNames'
import {
  IDEAS_COMMAND_SUBJECT,
  IDEAS_DESCRIPTION,
  IDEAS_LOST_WITHOUT_COMMAND,
} from './ideaPaneTexts'
import { openIdeasPane } from './ideaScreens'

/** /ideas, which opens the Ideas pane. */
export function ideasCommand($: EngineInterface): PluginCommand {
  return {
    spec: { name: IDEAS_COMMAND, description: IDEAS_DESCRIPTION, immediate: true },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: IDEAS_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: false,
    run: async () => replyWithFailures($, await openIdeasPane($, { command: IDEAS_COMMAND })),
    subjectOf: () => IDEAS_COMMAND_SUBJECT,
  }
}
