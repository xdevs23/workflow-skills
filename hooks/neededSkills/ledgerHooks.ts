import type { AgentStatus, EngineInterface, MatchedHook, ModelUsage } from 'claude-code'

import { REPLACES_CONVERSATION } from '../compactionTrigger'
import { isMadeByModel } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { changeLoop, forgetAgent } from './ledgerState'
import { LoadKind } from './loadKind'
import { NEW_LOOP, withLoad, withMeasure } from './loadLedger'
import type { LoopLedger } from './loadLedger'
import { loadMadeBy, neededSkillNamed } from './loadOfCall'

export const measureContext: MatchedHook<'turn.step', EveryEvent> = async function* ($, e, next) {
  const response = yield* next(e)
  // A request without usage reached no model, so the measure recorded last still applies.
  if (response.usage !== null) {
    const measure = {
      contextTokens: contextTokensOf(response.usage),
      messageCount: e.messageCount,
      model: e.model,
    }
    await changeLedgerOf($, e, loop => withMeasure(loop, measure))
  }

  return response
}

/**
 * Records the load made by a call of a model to the Skill tool or to Read that ran without an
 * error. A call raised by a plugin brings nothing into the context of a model.
 */
export const recordLoad: MatchedHook<'tool.call', EveryEvent> = async ($, e, next) => {
  const ran = await next(e)
  const hasLoaded = isMadeByModel(next.origin) && ran.deny === undefined && ran.isError !== true
  const load = hasLoaded ? loadMadeBy(e, $.plugin.root) : undefined
  if (load !== undefined) {
    await changeLedgerOf($, e, loop => withLoad(loop, load))
  }

  return ran
}

/**
 * Records the skill loaded by a slash command with the name of the skill, such as
 * `/workflow-skills:writing-code`, in the main conversation, which every prompt enters.
 */
export const recordCommandLoad: MatchedHook<'prompt.submit', EveryEvent> = async ($, e, next) => {
  const submitted = await next(e)
  const skill = e.command === undefined ? undefined : neededSkillNamed(e.command.name)
  if (submitted.drop === undefined && skill !== undefined) {
    await changeLoop($, await $.session.id(), undefined, loop =>
      withLoad(loop, { kind: LoadKind.Skill, name: skill }),
    )
  }

  return submitted
}

/**
 * Empties the ledger of the loop whose conversation a compaction replaced, since the summary keeps
 * the text of no load, also of a load still waiting for a reported size.
 */
export const forgetCompactedLoads: MatchedHook<'session.compact', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const compacted = await next(e)
  if (compacted.skip === undefined && REPLACES_CONVERSATION[e.trigger]) {
    await changeLedgerOf($, e, () => NEW_LOOP)
  }

  return compacted
}

// The engine raises no end of an agent beyond the end of a turn. A subagent and a workflow agent
// end with their run, which is one turn, so a subagent continued by a message starts a new ledger.
// A teammate runs many turns under one agent id, so the ledger of a teammate is deleted at the end
// of a turn only when the list of agents contains the teammate as ended, or no longer contains it.
export const forgetEndedAgent: MatchedHook<'turn.complete', EveryEvent> = async ($, e, next) => {
  const completed = await next(e)
  if (e.agentId !== undefined && !(await isTeammateNotEnded($, e.agentId))) {
    await forgetAgent($, await $.session.id(), e.agentId)
  }

  return completed
}

/** The statuses of an agent whose loop takes no more turns. */
const ENDED_STATUSES: ReadonlySet<AgentStatus> = new Set(['completed', 'failed', 'killed'])

/** Whether the agent `agentId` is a teammate that has not ended, so it takes more turns. */
async function isTeammateNotEnded($: EngineInterface, agentId: string): Promise<boolean> {
  const agent = (await $.agent.list()).find(listed => listed.id === agentId)

  return agent?.teammateId !== undefined && !ENDED_STATUSES.has(agent.status)
}

/** The size of the context sent with a model request, cached or not. */
function contextTokensOf(usage: ModelUsage): number {
  return usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
}

/** Changes the ledger of the loop that raised `event` as `change` makes it. */
async function changeLedgerOf(
  $: EngineInterface,
  event: { readonly agentId?: string | undefined },
  change: (loop: LoopLedger) => LoopLedger,
): Promise<void> {
  await changeLoop($, await $.session.id(), event.agentId, change)
}
