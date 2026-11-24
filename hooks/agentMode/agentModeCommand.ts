import type { CommandRunInput, CommandRunResult, EngineInterface, Frozen } from 'claude-code'

import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { isTypedByUser } from '../promptOrigin'
import { returningStoreFailure } from '../storeFailures'
import { AGENT_MODE_COMMAND, isAgentMode } from './agentModeNames'
import { readAgentModeInState, setAgentModeInState } from './agentModeState'
import { saveAgentMode } from './agentModeStore'
import {
  AGENT_MODE_ARGUMENT_HINT,
  AGENT_MODE_DESCRIPTION,
  AGENT_MODE_LOST_WITHOUT_COMMAND,
  AGENT_MODE_NOT_TYPED_BY_USER,
  AGENT_MODE_SUBJECT,
  describeAgentModeForPerson,
  describeAgentModeNotChanged,
  describeUnknownAgentModeWords,
} from './agentModeTexts'

/** /agent-mode, which shows or sets the agent mode for the session. */
export function agentModeCommand($: EngineInterface): PluginCommand {
  return {
    spec: {
      name: AGENT_MODE_COMMAND,
      description: AGENT_MODE_DESCRIPTION,
      argumentHint: AGENT_MODE_ARGUMENT_HINT,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: AGENT_MODE_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: true,
    run: e => runAgentModeCommand($, e),
    subjectOf: () => AGENT_MODE_SUBJECT,
  }
}

/**
 * Sets the agent mode for the running session to the mode named after /agent-mode, when the user
 * typed the command, and replies with the mode. /agent-mode alone only replies.
 */
async function runAgentModeCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const words = e.args.trim()
  if (words === '') {
    return { text: describeAgentModeForPerson(await readAgentModeInState($)) }
  }
  if (!isAgentMode(words)) {
    return { text: describeUnknownAgentModeWords(words) }
  }
  if (!isTypedByUser(e.origin)) {
    return { text: AGENT_MODE_NOT_TYPED_BY_USER }
  }
  const sessionId = await $.session.id()
  const notChanged = await returningStoreFailure(
    () => saveAgentMode($, sessionId, words),
    describeAgentModeNotChanged,
  )
  if (typeof notChanged === 'string') {
    return replyWithFailures($, [notChanged])
  }
  await setAgentModeInState($, sessionId, words)

  return { text: describeAgentModeForPerson(words) }
}
