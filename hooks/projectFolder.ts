import type { EngineInterface } from 'claude-code'

import { showFailure } from './failureToast'
import { describeFailedStoreCall, returningStoreFailure } from './pluginStore'
import type { FailedStoreCall } from './pluginStore'
import { ProjectFailureKind, describeFailedProjectLookup, lookUpProjectOf } from './projectLookup'
import type { FailedProjectLookup } from './projectLookup'

export type ProjectFailure =
  | { kind: ProjectFailureKind.Store; failed: FailedStoreCall }
  | FailedProjectLookup

export async function returningProjectFailure<T, Failed>(
  $: EngineInterface,
  work: (project: string) => Promise<T>,
  toFailed: (failure: ProjectFailure) => Failed,
): Promise<T | Failed> {
  const project = await lookUpProjectOf($, await $.session.root())
  if (typeof project !== 'string') {
    return toFailed(project)
  }

  return returningStoreFailure(
    () => work(project),
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
    : describeFailedProjectLookup(failure)
}
