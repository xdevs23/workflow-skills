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
