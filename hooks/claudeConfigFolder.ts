import type { EngineInterface } from 'claude-code'

/** The configuration folder of Claude Code: CLAUDE_CONFIG_DIR, or .claude in the home folder. */
export async function claudeConfigFolderOf($: EngineInterface): Promise<string | undefined> {
  const home = await $.env.get('HOME')

  return (
    (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (home === undefined ? undefined : `${home}/.claude`)
  )
}
