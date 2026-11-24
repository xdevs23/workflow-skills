import { RECORDS_FOLDER_TEXT } from './recordsFolder'

export function describeUnreadableRecord(key: string): string {
  return (
    `The stored record under the key ${key} is not in the shape that this version of the plugin ` +
    'writes. A newer version may have written it: then update the plugin. Otherwise restore or ' +
    `delete that record in its file in ${RECORDS_FOLDER_TEXT}. Then try again.`
  )
}

/** The calls on the store that can fail, and the lookup of the records folder that each makes. */
export enum StoreCall {
  FindRecordsFolder = 'find records folder',
  List = 'list',
  Read = 'read',
  Write = 'write',
}

/**
 * A call on the store that failed: the call, the key it was made for, or the start of the keys
 * listed, and the error of the store.
 */
export type FailedStoreCall = { call: StoreCall; key: string; cause: Error }

/** A failed call on the store, passed up to the read or the change that made it. */
export class StoreCallError extends Error {
  readonly failed: FailedStoreCall

  constructor(failed: FailedStoreCall) {
    super(failed.cause.message, { cause: failed.cause })
    this.failed = failed
  }
}

/** Runs the call `call` on the store, made as `storeCall` for `key`, and fails with its failure. */
export async function callStore<T>(
  storeCall: StoreCall,
  key: string,
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    throw new StoreCallError({ call: storeCall, key, cause: error })
  }
}

/**
 * Runs `work`, and returns the failure of the call on the store that stopped it, as `toFailed`
 * makes it from that failure.
 */
export async function returningStoreFailure<T, Failed>(
  work: () => Promise<T>,
  toFailed: (failed: FailedStoreCall) => Failed,
): Promise<T | Failed> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof StoreCallError) {
      return toFailed(error.failed)
    }
    throw error
  }
}

/** The reason and the next step for the failed call on the store `failed`. */
export function describeFailedStoreCall(failed: {
  call: StoreCall
  key: string
  cause: Pick<Error, 'message'>
}): string {
  const { key, cause } = failed
  switch (failed.call) {
    case StoreCall.FindRecordsFolder:
      return cause.message
    case StoreCall.List:
      return `The records could not list their keys: ${cause.message}. ${CHECK_READABLE}`
    case StoreCall.Read:
      return `The records could not read the key ${key}: ${cause.message}. ${CHECK_READABLE}`
    case StoreCall.Write:
      return (
        `The records did not save the change to the key ${key}: ${cause.message}. Check that ` +
        `the record files of this project in ${RECORDS_FOLDER_TEXT} can be written. If the ` +
        'file used by a session is over 4 MiB, delete the records no longer needed from that ' +
        'file. Then try again.'
      )
  }
}

const CHECK_READABLE =
  `Check that the record files of this project in ${RECORDS_FOLDER_TEXT} can be read, then try ` +
  'again.'
