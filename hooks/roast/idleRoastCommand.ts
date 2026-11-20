import type { CommandRunInput, CommandRunResult, EngineInterface, Frozen } from 'claude-code'

import { replyWithFailures } from '../failureToast'
import { CommandRegistrar, type PluginCommand } from '../pluginCommand'
import { returningStoreFailure } from '../pluginStore'
import { isTypedByUser } from '../promptOrigin'
import { setIdleRoastSwitch } from './idleRoast'
import { SwitchOutcome, readIdleRoastSwitch, saveIdleRoastSwitch } from './idleRoastSwitch'
import { IDLE_ROAST_COMMAND, IS_ON_AFTER, isIdleRoastWord } from './roastNames'
import {
  IDLE_ROAST_ARGUMENT_HINT,
  IDLE_ROAST_DESCRIPTION,
  IDLE_ROAST_LOST_WITHOUT_COMMAND,
  IDLE_ROAST_NOT_TYPED_BY_USER,
  IDLE_ROAST_SUBJECT,
  describeIdleRoastNotSwitched,
  describeIdleRoastSwitch,
  describeIdleRoastSwitchNotRead,
  describeUnknownIdleRoastWords,
} from './roastTexts'

/** /idle-roast, which turns the idle roast of the session on or off. */
export function idleRoastCommand($: EngineInterface): PluginCommand {
  return {
    spec: {
      name: IDLE_ROAST_COMMAND,
      description: IDLE_ROAST_DESCRIPTION,
      argumentHint: IDLE_ROAST_ARGUMENT_HINT,
      immediate: true,
    },
    registeredBy: CommandRegistrar.CommandList,
    lostWithoutCommand: IDLE_ROAST_LOST_WITHOUT_COMMAND,
    isInteractiveOnly: true,
    run: e => runIdleRoastCommand($, e),
    subjectOf: () => IDLE_ROAST_SUBJECT,
  }
}

/**
 * Sets the idle roast of the running session to the state given by the word after /idle-roast,
 * when the user typed the command, and replies with whether it is on. /idle-roast alone only
 * replies. A switch that could not be read is reported and left as it is.
 */
async function runIdleRoastCommand(
  $: EngineInterface,
  e: Frozen<CommandRunInput>,
): Promise<CommandRunResult> {
  const sessionId = await $.session.id()
  const read = await readIdleRoastSwitch($, sessionId)
  if (read.outcome !== SwitchOutcome.Read) {
    return replyWithFailures($, [describeIdleRoastSwitchNotRead(read)])
  }
  const words = e.args.trim()
  if (words === '') {
    return { text: describeIdleRoastSwitch(read.isOn) }
  }
  if (!isIdleRoastWord(words)) {
    return { text: describeUnknownIdleRoastWords(words) }
  }
  if (!isTypedByUser(e.origin)) {
    return { text: IDLE_ROAST_NOT_TYPED_BY_USER }
  }

  return switchIdleRoast($, sessionId, IS_ON_AFTER[words])
}

/** Saves the idle roast of the session `sessionId` as on when `isOn`, and off otherwise. */
async function switchIdleRoast(
  $: EngineInterface,
  sessionId: string,
  isOn: boolean,
): Promise<CommandRunResult> {
  const notSwitched = await returningStoreFailure(
    () => saveIdleRoastSwitch($, sessionId, isOn),
    describeIdleRoastNotSwitched,
  )
  if (typeof notSwitched === 'string') {
    return replyWithFailures($, [notSwitched])
  }
  await setIdleRoastSwitch($, isOn)

  return { text: describeIdleRoastSwitch(isOn) }
}
