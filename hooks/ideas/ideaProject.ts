import type { EngineInterface, ProcessRunResult } from 'claude-code'

import { showFailure } from '../failureToast'
import { returningStoreFailure } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'

/** The kinds of failure that stop work on the ideas recorded in the project. */
export enum IdeasFailureKind {
  /** A call on the store failed. */
  Store = 'store',
  /** git did not start or did not finish while it looked up the project. */
  GitNotRun = 'git-not-run',
  /** git exited with an error in a project root inside a repository. */
  GitRefused = 'git-refused',
}

/** A lookup of the project that failed, with the project root that git ran in. */
type FailedProjectLookup =
  | { kind: IdeasFailureKind.GitNotRun; root: string; cause: Error }
  | { kind: IdeasFailureKind.GitRefused; root: string; exitCode: number; stderr: string }

export type IdeasFailure =
  | { kind: IdeasFailureKind.Store; failed: FailedStoreCall }
  | FailedProjectLookup

/**
 * The folder of the repository for the project root of the session: the parent of the common git
 * folder, which every worktree of the repository shares, or the project root itself outside git.
 * The entries in TODO.md belong to the repository, so every worktree and subfolder of it reads the
 * same words. Returns the failed lookup when git did not run, or when it refused inside a
 * repository.
 */
async function lookUpProjectOfIdeas($: EngineInterface): Promise<string | FailedProjectLookup> {
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

    return { kind: IdeasFailureKind.GitNotRun, root, cause: error }
  }
  if (commonFolder.exitCode === 0) {
    const path = commonFolder.stdout.trim()

    return path.slice(0, path.lastIndexOf('/'))
  }
  const { exitCode, stderr } = commonFolder

  return (await hasGitEntryAtOrAbove($, root))
    ? { kind: IdeasFailureKind.GitRefused, root, exitCode, stderr }
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

/**
 * Looks up the project the ideas are recorded in, runs `work` on it, and returns the value that
 * `toFailed` builds from the failure when the lookup or the store stops `work`.
 */
export async function returningIdeasFailure<T, Failed>(
  $: EngineInterface,
  work: (project: string) => Promise<T>,
  toFailed: (failure: IdeasFailure) => Failed,
): Promise<T | Failed> {
  const project = await lookUpProjectOfIdeas($)
  if (typeof project !== 'string') {
    return toFailed(project)
  }

  return returningStoreFailure(
    () => work(project),
    failed => toFailed({ kind: IdeasFailureKind.Store, failed }),
  )
}

/**
 * Runs `work` as returningIdeasFailure does, and shows the failure that stopped it as `describe`
 * writes it.
 */
export async function showingIdeasFailure(
  $: EngineInterface,
  work: (project: string) => Promise<void>,
  describe: (failure: IdeasFailure) => string,
): Promise<void> {
  await returningIdeasFailure($, work, failure => {
    showFailure($, describe(failure))
  })
}
