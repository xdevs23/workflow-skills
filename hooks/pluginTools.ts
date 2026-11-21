import type { MatchedHook, ToolSpec } from 'claude-code'

import type { EveryEvent } from './everyEvent'
import { isToolOfPlugin, toolName } from './names'

// The engine keeps every tool that a load of the plugin registered in the tool pool of the session,
// also after a reload whose module no longer registers it, and no hook then answers its calls. Each
// load declares its tools while the module loads, before any event, so the pool loses the others
// from its first listing on, whatever the start hooks do.
const declaredTools = new Set<string>()

/** Declares `tools` as tools of this plugin. Called while the module loads. */
export function declarePluginTools(tools: readonly ToolSpec[]): void {
  for (const tool of tools) {
    declaredTools.add(toolName(tool.name))
  }
}

/** Leaves out of the pool every tool of this plugin that the loaded module did not declare. */
export const keepDeclaredPluginTools: MatchedHook<'tool.list', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const listed = await next(e)

  return listed.value === undefined
    ? listed
    : {
        value: listed.value.filter(
          tool => !isToolOfPlugin(tool.name) || declaredTools.has(tool.name),
        ),
      }
}
