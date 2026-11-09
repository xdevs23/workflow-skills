import type { Load } from './loadKind'

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

/** A load with the context size of the loop at the model request that made it, in tokens. */
export type RecordedLoad = Load & { contextTokens: number }

/**
 * The ledger of one loop: the main conversation, a subagent or a workflow agent. Until a model
 * request of the loop reported a size, the loads made are recorded as pending, and get the size
 * reported next.
 */
export type LoopLedger =
  | { measure: null; pendingLoads: readonly Load[] }
  | { measure: LoopMeasure; loads: readonly RecordedLoad[] }

export const NEW_LOOP: LoopLedger = { measure: null, pendingLoads: [] }

function isSameLoad(one: Load, other: Load): boolean {
  return one.kind === other.kind && one.name === other.name
}

/** `loads` without an earlier load of the same as `load`. */
function withoutLoad<Made extends Load>(loads: readonly Made[], load: Load): Made[] {
  return loads.filter(made => !isSameLoad(made, load))
}

/** `loop` after a model request of it reported `measure`. */
export function withMeasure(loop: LoopLedger, measure: LoopMeasure): LoopLedger {
  return {
    measure,
    loads:
      loop.measure === null
        ? loop.pendingLoads.map(load => ({ ...load, contextTokens: measure.contextTokens }))
        : loadsCarriedOver(loop.measure, loop.loads, measure),
  }
}

/**
 * The loads recorded at `before` as they stand at `after`. Fewer messages mean a compaction or a
 * rewind, which may have dropped the text of every load. Another model counts tokens by another
 * tokenizer, so the tokens counted after each load so far carry over, and counting goes on from
 * `after`.
 */
function loadsCarriedOver(
  before: LoopMeasure,
  loads: readonly RecordedLoad[],
  after: LoopMeasure,
): readonly RecordedLoad[] {
  if (after.messageCount < before.messageCount) {
    return []
  }
  if (after.model === before.model) {
    return loads
  }
  const shift = after.contextTokens - before.contextTokens

  return loads.map(load => ({ ...load, contextTokens: load.contextTokens + shift }))
}

/** `loop` with `load` made at its current context size, in place of an earlier load of the same. */
export function withLoad(loop: LoopLedger, load: Load): LoopLedger {
  const { measure } = loop
  if (measure === null) {
    return { measure, pendingLoads: [...withoutLoad(loop.pendingLoads, load), load] }
  }

  return {
    measure,
    loads: [...withoutLoad(loop.loads, load), { ...load, contextTokens: measure.contextTokens }],
  }
}

/** The loads of `needed` that `loop` does not count. */
export function loadsMissingFrom(loop: LoopLedger, needed: readonly Load[]): readonly Load[] {
  const counted = countedLoadsOf(loop)

  return needed.filter(load => !counted.some(made => isSameLoad(made, load)))
}

/**
 * The loads of `loop` after which at most MAX_TOKENS_AFTER_LOAD tokens came into the context of the
 * loop, and every pending load.
 */
export function countedLoadsOf(loop: LoopLedger): readonly Load[] {
  const { measure } = loop

  return measure === null
    ? loop.pendingLoads
    : loop.loads.filter(load => measure.contextTokens - load.contextTokens <= MAX_TOKENS_AFTER_LOAD)
}
