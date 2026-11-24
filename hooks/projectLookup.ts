import type { EngineInterface, ProcessRunResult } from 'claude-code'

export enum ProjectFailureKind {
  Store = 'store',
  GitNotRun = 'git-not-run',
  GitRefused = 'git-refused',
}

export type ProjectLookupEngine = Pick<EngineInterface, 'fs' | 'process'>

/** A lookup of the project that failed, with the project root that git ran in. */
export type FailedProjectLookup =
  | { kind: ProjectFailureKind.GitNotRun; root: string; cause: Error }
  | { kind: ProjectFailureKind.GitRefused; root: string; exitCode: number; stderr: string }

/**
 * The folder of the repository for the project root `root`: the parent of the common git folder,
 * which every worktree of the repository shares, or the project root itself outside git. The
 * entries in TODO.md belong to the repository, so every worktree and subfolder of it reads the same
 * records. Returns the failed lookup when git did not run, or when it failed inside a repository.
 */
export async function lookUpProjectOf(
  $: ProjectLookupEngine,
  root: string,
): Promise<string | FailedProjectLookup> {
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
 * Whether `folder` or a folder above it contains `.git`, the folder or file by which git finds a
 * repository. git exits with the same code outside a repository as on a refusal inside one.
 */
async function hasGitEntryAtOrAbove($: ProjectLookupEngine, folder: string): Promise<boolean> {
  if (await $.fs.exists(`${folder}/.git`)) {
    return true
  }
  const parent = folder.slice(0, Math.max(folder.lastIndexOf('/'), 1))

  return parent !== folder && hasGitEntryAtOrAbove($, parent)
}

export function describeFailedProjectLookup(failure: FailedProjectLookup): string {
  switch (failure.kind) {
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
