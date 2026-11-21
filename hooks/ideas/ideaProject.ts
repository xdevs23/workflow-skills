import type { EngineInterface } from 'claude-code'

/**
 * The folder of the repository that holds the project root of the session: the parent of the
 * common git folder, which every worktree of the repository shares, or the project root itself
 * outside git. The entries in TODO.md belong to the repository, so every worktree and subfolder of
 * it reads the same words.
 */
export async function readProjectOfIdeas($: EngineInterface): Promise<string> {
  const root = await $.session.root()
  const commonFolder = await $.process.run([
    'git',
    '-C',
    root,
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
  ])
  if (commonFolder.exitCode !== 0) {
    return root
  }
  const path = commonFolder.stdout.trim()

  return path.slice(0, path.lastIndexOf('/'))
}
