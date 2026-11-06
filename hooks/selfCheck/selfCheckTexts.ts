/** The text that tells the model of the main conversation to check the work delivered by it. */
export const SELF_CHECK_TEXT =
  "If you're idle, check whether what you have done and presented is done, and whether the " +
  'premise behind it is right. You might have delivered incomplete or incorrect work. If the ' +
  'user finds the problem first, that is worse than double-checking now.'

/** The transcript line that shows the self-check was sent. The model does not read the line. */
export const SENT_LINE = 'Self-check: the reminder to check the delivered work was sent to Claude'

/** The toast for a self-check that failed to send, with the message of the failure. */
export function describeSelfCheckFailed(message: string): string {
  return (
    `The reminder to check the delivered work could not be sent to Claude: ${message}. ` +
    'It is sent again at the end of the next turn, or within four hours.'
  )
}
