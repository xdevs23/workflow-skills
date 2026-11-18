import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { registerCommandShowingRejection } from '../commandRegistration'
import { replyWithFailures } from '../failureToast'
import { replyToFailedHook } from '../hookFailure'
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

export const registerIdleRoastCommand: MatchedHook<
  'session.start',
  { isInteractive: true }
> = async ($, e, next) => {
  await registerCommandShowingRejection(
    $,
    {
      name: IDLE_ROAST_COMMAND,
      description: IDLE_ROAST_DESCRIPTION,
      argumentHint: IDLE_ROAST_ARGUMENT_HINT,
      immediate: true,
    },
    IDLE_ROAST_LOST_WITHOUT_COMMAND,
  )

  return next(e)
}

/**
 * Sets the idle roast of the running session to the state given by the word after /idle-roast,
 * when the user typed the command, and replies with whether it is on. /idle-roast alone only
 * replies. A switch that could not be read is reported and left as it is.
 */
export const runIdleRoastCommand: MatchedHook<
  'command.run',
  { command: typeof IDLE_ROAST_COMMAND }
> = async ($, e) => {
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

export function replyWithIdleRoastHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, IDLE_ROAST_SUBJECT, next.error)
}
