import type { EngineInterface, ProcessRunResult } from 'claude-code'

import { showFailure } from './failureToast'
import { describeFailedStoreCall, returningStoreFailure } from './pluginStore'
import type { FailedStoreCall } from './pluginStore'

export enum ProjectFailureKind {
  Store = 'store',
  GitNotRun = 'git-not-run',
  GitRefused = 'git-refused',
}

/** A lookup of the project that failed, with the project root that git ran in. */
type FailedProjectLookup =
  | { kind: ProjectFailureKind.GitNotRun; root: string; cause: Error }
  | { kind: ProjectFailureKind.GitRefused; root: string; exitCode: number; stderr: string }

export type ProjectFailure =
  | { kind: ProjectFailureKind.Store; failed: FailedStoreCall }
  | FailedProjectLookup

/**
 * The folder of the repository for the project root of the session: the parent of the common git
 * folder, which every worktree of the repository shares, or the project root itself outside git.
 * The entries in TODO.md belong to the repository, so every worktree and subfolder of it reads the
 * same records. Returns the failed lookup when git did not run, or when it refused inside a
 * repository.
 */
async function lookUpProject($: EngineInterface): Promise<string | FailedProjectLookup> {
  const root = await $.session.root()
  let commonFolder: ProcessRunResult
  try {
    commonFolder = await $.process.run([
      'git',
      '-C',
      root,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ])
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return { kind: ProjectFailureKind.GitNotRun, root, cause: error }
  }
  if (commonFolder.exitCode === 0) {
    const path = commonFolder.stdout.trim()

    return path.slice(0, path.lastIndexOf('/'))
  }
  const { exitCode, stderr } = commonFolder

  return (await hasGitEntryAtOrAbove($, root))
    ? { kind: ProjectFailureKind.GitRefused, root, exitCode, stderr }
    : root
}

/**
 * Whether `folder` or a folder above it holds `.git`, the folder or file by which git finds a
 * repository. git exits with the same code outside a repository as on a refusal inside one.
 */
async function hasGitEntryAtOrAbove($: EngineInterface, folder: string): Promise<boolean> {
  if (await $.fs.exists(`${folder}/.git`)) {
    return true
  }
  const parent = folder.slice(0, Math.max(folder.lastIndexOf('/'), 1))

  return parent !== folder && hasGitEntryAtOrAbove($, parent)
}

export async function returningProjectFailure<T, Failed>(
  $: EngineInterface,
  work: (project: string) => Promise<T>,
  toFailed: (failure: ProjectFailure) => Failed,
): Promise<T | Failed> {
  const project = await lookUpProject($)
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
  switch (failure.kind) {
    case ProjectFailureKind.Store:
      return describeFailedStoreCall(failure.failed)
    case ProjectFailureKind.GitNotRun:
      return (
        `git did not run in the project root ${failure.root}: ` +
        `${failure.cause.message}. Check that git is installed and runs in that folder, then ` +
        'try again.'
      )
    case ProjectFailureKind.GitRefused:
      return (
        `git exited with code ${failure.exitCode} in the project root ${failure.root}, which is ` +
        `inside a repository. Fix what git reports, then try again. git reported:\n` +
        failure.stderr.trim()
      )
  }
}
