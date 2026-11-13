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

/** A load with the context size reported by the first model request of the loop after it. */
export type RecordedLoad = Load & { contextTokens: number }

/**
 * The ledger of one loop: the main conversation, a subagent or a workflow agent. A load is recorded
 * as pending until the next model request of the loop reports a size, and gets that size. The
 * engine runs a tool call while the request that made it still streams, before that request
 * reports a size, so the size reported last before a load can come from before a compaction.
 */
export type LoopLedger =
  | { measure: null; pendingLoads: readonly Load[] }
  | { measure: LoopMeasure; loads: readonly RecordedLoad[]; pendingLoads: readonly Load[] }

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
  const carriedOver =
    loop.measure === null ? [] : loadsCarriedOver(loop.measure, loop.loads, measure)
  const stamped = loop.pendingLoads.map(load => ({ ...load, contextTokens: measure.contextTokens }))

  return {
    measure,
    loads: [...carriedOver, ...stamped],
    pendingLoads: [],
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

/**
 * `loop` with `load` pending, in place of an earlier load of the same, so a load is either recorded
 * or pending, never both.
 */
export function withLoad(loop: LoopLedger, load: Load): LoopLedger {
  const pendingLoads = [...withoutLoad(loop.pendingLoads, load), load]

  return loop.measure === null
    ? { measure: null, pendingLoads }
    : { measure: loop.measure, loads: withoutLoad(loop.loads, load), pendingLoads }
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
    : [
        ...loop.loads.filter(
          load => measure.contextTokens - load.contextTokens <= MAX_TOKENS_AFTER_LOAD,
        ),
        ...loop.pendingLoads,
      ]
}
