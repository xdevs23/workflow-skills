import type { QualifiedSkill } from '../names'

/**
 * A load counts until more than this many tokens came into the context of the loop after it, so
 * the rules from the load are recent context for the model that runs the loop: a product choice.
 */
export const MAX_TOKENS_AFTER_LOAD = 100_000

/** What the last model request of a loop reported. */
export type LoopMeasure = {
  /** The context size sent with the request, in tokens of `model`. */
  contextTokens: number
  /** The number of messages the request carried, which drops on a compaction or a rewind alone. */
  messageCount: number
  model: string
}

export type SkillLoad = {
  skill: QualifiedSkill
  /**
   * The context size reported by the first model request of the loop after the load, null until
   * that request reports one.
   */
  contextTokens: number | null
}

/**
 * The ledger of one loop: the main conversation, a subagent or a workflow agent. The engine runs a
 * tool call while the request that made it still streams, before that request reports a size, so
 * the size reported last before a load can come from before a compaction.
 */
export type LoopLedger = { measure: LoopMeasure | null; loads: readonly SkillLoad[] }

export const NEW_LOOP: LoopLedger = { measure: null, loads: [] }

export function withMeasure(loop: LoopLedger, measure: LoopMeasure): LoopLedger {
  const carriedOver =
    loop.measure === null ? loop.loads : loadsCarriedOver(loop.measure, loop.loads, measure)

  return {
    measure,
    loads: carriedOver.map(load => ({
      ...load,
      contextTokens: load.contextTokens ?? measure.contextTokens,
    })),
  }
}

/**
 * The loads recorded at `before` as they stand at `after`. Fewer messages mean a compaction or a
 * rewind, which may have dropped the text of every measured load. Another model counts tokens by
 * another tokenizer, so the tokens counted after each load so far carry over, and counting goes on
 * from `after`.
 */
function loadsCarriedOver(
  before: LoopMeasure,
  loads: readonly SkillLoad[],
  after: LoopMeasure,
): readonly SkillLoad[] {
  if (after.messageCount < before.messageCount) {
    return loads.filter(load => load.contextTokens === null)
  }
  if (after.model === before.model) {
    return loads
  }
  const shift = after.contextTokens - before.contextTokens

  return loads.map(load => ({
    ...load,
    contextTokens: load.contextTokens === null ? null : load.contextTokens + shift,
  }))
}

export function withLoad(loop: LoopLedger, skill: QualifiedSkill): LoopLedger {
  return {
    measure: loop.measure,
    loads: [...loop.loads.filter(load => load.skill !== skill), { skill, contextTokens: null }],
  }
}

export function skillsMissingFrom(
  loop: LoopLedger,
  needed: readonly QualifiedSkill[],
): readonly QualifiedSkill[] {
  return needed.filter(
    skill => !loop.loads.some(load => load.skill === skill && isRecent(load, loop.measure)),
  )
}

function isRecent(load: SkillLoad, measure: LoopMeasure | null): boolean {
  return (
    load.contextTokens === null ||
    measure === null ||
    measure.contextTokens - load.contextTokens <= MAX_TOKENS_AFTER_LOAD
  )
}
