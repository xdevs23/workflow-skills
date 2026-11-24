import type { EngineInterface } from 'claude-code'

import { showFailure } from './failureToast'
import { describeFailedStoreCall, returningStoreFailure } from './pluginStore'
import type { FailedStoreCall } from './pluginStore'
import { ProjectFailureKind } from './projectLookup'
import { describeRecordsFolderNotFound, recordsPlaceOf } from './recordsFolder'
import type { RecordsFolderNotFound } from './recordsFolder'

export type ProjectFailure =
  | { kind: ProjectFailureKind.Store; failed: FailedStoreCall }
  | RecordsFolderNotFound

export async function returningProjectFailure<T, Failed>(
  $: EngineInterface,
  work: (project: string) => Promise<T>,
  toFailed: (failure: ProjectFailure) => Failed,
): Promise<T | Failed> {
  const place = await recordsPlaceOf($)
  if (!place.isFound) {
    return toFailed(place.failure)
  }

  return returningStoreFailure(
    () => work(place.project),
    failed => toFailed({ kind: ProjectFailureKind.Store, failed }),
  )
}

export async function showingProjectFailure(
  $: EngineInterface,
  work: (project: string) => Promise<void>,
  describe: (failure: ProjectFailure) => string,
): Promise<void> {
  await returningProjectFailure($, work, failure => {
    showFailure($, describe(failure))
  })
}

export function describeProjectFailure(failure: ProjectFailure): string {
  return failure.kind === ProjectFailureKind.Store
    ? describeFailedStoreCall(failure.failed)
    : describeRecordsFolderNotFound(failure)
}
