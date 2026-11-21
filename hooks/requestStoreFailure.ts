import type { EngineInterface } from 'claude-code'

import { describeRefusedWrite, describeUnreadableRecord } from './pluginStore'

/** A failure of the store of the plugin that a person can act on, its next step in the message. */
export class RequestStoreError extends Error {}

/**
 * Runs `work`, and on a failure of the store returns what `answer` makes of its message, after
 * writing the message to the debug log. Every other error is passed on.
 */
export async function handleStoreFailure<T>(
  $: EngineInterface,
  work: () => Promise<T>,
  answer: (message: string) => T | Promise<T>,
): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof RequestStoreError)) {
      throw error
    }
    $.ui.log(error.message, { to: 'debug' })

    return answer(error.message)
  }
}

/**
 * Runs `work`, and shows a failure of the store in a toast, after writing it to the debug log.
 * Every other error is passed on.
 */
export function toastStoreFailure($: EngineInterface, work: () => Promise<void>): Promise<void> {
  return handleStoreFailure($, work, message => $.ui.toast(message))
}

export class UnreadableRequestError extends RequestStoreError {
  readonly key: string

  constructor(key: string) {
    super(describeUnreadableRecord(key))
    this.key = key
  }
}

export class RequestNotReadError extends RequestStoreError {
  constructor(description: string, cause: Error) {
    super(description, { cause })
  }
}

export class RequestNotSavedError extends RequestStoreError {
  readonly key: string

  constructor(key: string, cause: Error) {
    super(describeRefusedWrite(key, cause), { cause })
    this.key = key
  }
}
