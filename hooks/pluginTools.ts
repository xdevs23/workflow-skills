import type { EngineInterface, MatchedHook, ToolSpec } from 'claude-code'

import type { EveryEvent } from './everyEvent'
import { isToolOfPlugin } from './names'

// The engine keeps every tool a load of the plugin registered in the tool pool of the session, also
// after a reload whose module no longer registers it, and no hook then answers its calls. A reload
// loads this module afresh, so these are the tools of the loaded module alone.
const registeredTools = new Set<string>()

// The engine may list the pool while a start hook still registers tools, so the pool keeps the
// tools of this plugin until the start is over.
let isRegistrationOver = false

/** Registers the tool `tool` of this plugin. Every tool of this plugin is registered through it. */
export async function registerPluginTool($: EngineInterface, tool: ToolSpec): Promise<void> {
  const registered = await $.tool.register(tool)
  registeredTools.add(registered.tool)
}

/**
 * Lists the pool anew once the start is over. Registered before every start hook that registers a
 * tool, and each of those registers its tools before it passes the start on.
 */
export const endToolRegistration: MatchedHook<'session.start', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const started = await next(e)
  isRegistrationOver = true
  $.ui.invalidate('tool.list')

  return started
}

/** Leaves out of the pool every tool of this plugin that the loaded module did not register. */
export const keepRegisteredPluginTools: MatchedHook<'tool.list', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const listed = await next(e)
  if (!isRegistrationOver || listed.value === undefined) {
    return listed
  }

  return {
    value: listed.value.filter(
      tool => !isToolOfPlugin(tool.name) || registeredTools.has(tool.name),
    ),
  }
}
