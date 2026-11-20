import { DEBUG_LOG_NOTE } from './failureToast'

/** What the toast for a rejected slash command is written from. */
type RejectedCommand = {
  /** The name of the command, without the slash. */
  command: string
  /** The sentence on what the user cannot do without the command. */
  lostWithoutCommand: string
  /** The message of the engine on why it rejected the command. */
  reason: string
}

/** The text of the toast for a slash command that the engine rejected. */
export function describeNotRegistered({
  command,
  lostWithoutCommand,
  reason,
}: RejectedCommand): string {
  return (
    `/${command} could not be registered: ${reason}. ${lostWithoutCommand} If another plugin ` +
    `uses the name /${command}, turn that plugin off and start a new session. ${DEBUG_LOG_NOTE}`
  )
}

/**
 * The text of the toast for a turn stopped by the user that could not be marked as over for
 * `reason` when the user typed a slash command.
 */
export function describeStopNotEnded(reason: string): string {
  return (
    `The stopped turn could not be marked as over: ${reason}. Texts from this plugin that wait ` +
    `for the stopped turn go to Claude once you send a message. ${DEBUG_LOG_NOTE}`
  )
}
