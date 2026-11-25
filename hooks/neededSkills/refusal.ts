import type { EngineInterface, MatchedHook, Origin } from 'claude-code'

import { isMadeByModel } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { PLUGIN_TOOLS } from '../names'
import type { QualifiedSkill } from '../names'
import { isRecord } from '../pluginStore'
import { readLoop } from './ledgerState'
import { skillsMissingFrom } from './loadLedger'
import type { ToolCall } from './matcher'
import { describeRefusal } from './refusalText'
import { skillsNeededBy } from './skillsNeededBy'

/**
 * Denies a call made by the model that runs any loop to a tool of this plugin while the loop has
 * not loaded every skill the call needs. A hook of this plugin answers such a call, so it
 * never reaches the permission check.
 */
export const denyPluginToolUntilLoaded: MatchedHook<'tool.call', typeof PLUGIN_TOOLS> = async (
  $,
  e,
  next,
) => {
  const call = { tool: e.tool, input: undefined, agentId: e.agentId, isReadOnly: false }
  const missing = await readMissingSkills($, next.origin, call)

  return missing.length === 0 ? next(e) : { deny: describeRefusal(missing) }
}

/**
 * Denies a call made by the model that runs any loop while the loop has not loaded every skill the
 * call needs, at the permission check, where the engine reports whether the tool sets the call to
 * read-only.
 */
export const denyCheckedCallUntilLoaded: MatchedHook<'tool.check', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const call = {
    tool: e.tool,
    input: isRecord(e.input) ? e.input : undefined,
    agentId: e.agentId,
    isReadOnly: e.isReadOnly === true,
  }
  const missing = await readMissingSkills($, next.origin, call)

  return missing.length === 0
    ? next(e)
    : { decision: 'deny', reason: describeRefusal(missing) }
}

/**
 * The skills that `call` needs and the loop that runs the call did not load, for a call that the
 * model made from `origin`. The rule table does not match a call to the Skill tool, so the loads
 * required by a denial always run.
 */
async function readMissingSkills(
  $: EngineInterface,
  origin: Origin,
  call: ToolCall,
): Promise<readonly QualifiedSkill[]> {
  const needed = isMadeByModel(origin)
    ? skillsNeededBy({ call, projectRoot: await $.session.root() })
    : []
  if (needed.length === 0) {
    return []
  }

  return skillsMissingFrom(await readLoop($, await $.session.id(), call.agentId), needed)
}
