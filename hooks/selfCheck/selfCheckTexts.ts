/** The toast for a self-check that failed, with the message of the failure. */
export function describeSelfCheckFailed(message: string): string {
  return (
    `The check of the delivered work failed: ${message}. The next message you type starts it ` +
    'again at the latest.'
  )
}
