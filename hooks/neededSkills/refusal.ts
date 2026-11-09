import type { EngineInterface, MatchedHook, Origin } from 'claude-code'

import { isMadeByModel } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { AND_LIST } from '../listFormat'
import { toolName } from '../names'
import { isRecord } from '../pluginStore'
import { readLoop } from './ledgerState'
import { LOAD_STEPS } from './loadKind'
import type { Load } from './loadKind'
import { loadsMissingFrom } from './loadLedger'
import type { ToolCall } from './matcher'
import { loadsNeededBy } from './neededLoads'
import { regExpLiteralOf } from './regExpLiteral'

/** The matcher of the calls to the tools of this plugin, whose names share the prefix. */
export const PLUGIN_TOOLS = { tool: new RegExp(`^${regExpLiteralOf(toolName(''))}`, 'u') }

/**
 * Denies a call made by the model that runs any loop to a tool of this plugin while the loop has
 * not loaded every skill and file the call needs. A hook of this plugin answers such a call, so it
 * never reaches the permission check.
 */
export const denyPluginToolUntilLoaded: MatchedHook<'tool.call', typeof PLUGIN_TOOLS> = async (
  $,
  e,
  next,
) => {
  const call = { tool: e.tool, input: e, agentId: e.agentId, isReadOnly: false }
  const missing = await readMissingLoads($, next.origin, call)

  return missing.length === 0 ? next(e) : { deny: describeMissingLoads(missing, $.plugin.root) }
}

/**
 * Denies a call made by the model that runs any loop while the loop has not loaded every skill and
 * file the call needs, at the permission check, where the engine reports whether the tool holds the
 * call read-only.
 */
export const denyCheckedCallUntilLoaded: MatchedHook<'tool.check', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const call = {
    tool: e.tool,
    input: isRecord(e.input) ? e.input : {},
    agentId: e.agentId,
    isReadOnly: e.isReadOnly === true,
  }
  const missing = await readMissingLoads($, next.origin, call)

  return missing.length === 0
    ? next(e)
    : { decision: 'deny', reason: describeMissingLoads(missing, $.plugin.root) }
}

/**
 * The skills and files that `call` needs and the loop of the call did not load, for a call that
 * the model made from `origin`. No row matches a call to the Skill tool or to Read, so the loads
 * required by a denial always run.
 */
async function readMissingLoads(
  $: EngineInterface,
  origin: Origin,
  call: ToolCall,
): Promise<readonly Load[]> {
  const needed = isMadeByModel(origin)
    ? loadsNeededBy({ call, projectRoot: await $.session.root() })
    : []
  if (needed.length === 0) {
    return []
  }

  return loadsMissingFrom(await readLoop($, await $.session.id(), call.agentId), needed)
}

function describeMissingLoads(missing: readonly Load[], pluginRoot: string): string {
  const kinds = new Set(missing.map(load => load.kind))
  const steps = [...kinds].map(kind =>
    LOAD_STEPS[kind](
      missing.filter(load => load.kind === kind).map(load => load.name),
      pluginRoot,
    ),
  )

  return (
    'This call did not run, since it needs rules that this conversation has not loaded: ' +
    `${AND_LIST.format(steps)}, then retry this call.`
  )
}
