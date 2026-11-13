import { describe, expect } from 'claude-code/testing'

import { skillName } from '../names'
import { test } from '../testDeclaration'
import { LoadKind } from './loadKind'
import type { Load } from './loadKind'
import { NEW_LOOP, countedLoadsOf, withLoad, withMeasure } from './loadLedger'
import type { LoopLedger, LoopMeasure } from './loadLedger'
import { pluginFilePath } from './pluginFilePath'

const WRITING_CODE: Load = { kind: LoadKind.Skill, name: skillName('writing-code') }
const KOTLIN: Load = {
  kind: LoadKind.File,
  name: pluginFilePath('skills/writing-code/languages/kotlin.md'),
}

const MODEL = 'claude-opus-5-5'
const SONNET = 'claude-sonnet-5-5'

/** What a model request of `MODEL` reports at `contextTokens`, carrying `messageCount` messages. */
function measured(contextTokens: number, messageCount = 10, model = MODEL): LoopMeasure {
  return { contextTokens, messageCount, model }
}

/** A loop that loaded `loads`, then had its model request report `contextTokens`. */
function loopLoadedAt(contextTokens: number, ...loads: Load[]): LoopLedger {
  return withMeasure(loads.reduce(withLoad, NEW_LOOP), measured(contextTokens))
}

function countedNamesOf(loop: LoopLedger): string[] {
  return countedLoadsOf(loop).map(load => load.name)
}

describe('the ledger of a loop', () => {
  test('a load counts until more than 100,000 tokens came after it', () => {
    const loaded = loopLoadedAt(30_000, WRITING_CODE, KOTLIN)

    expect(countedNamesOf(withMeasure(loaded, measured(130_000)))).toEqual([
      WRITING_CODE.name,
      KOTLIN.name,
    ])
    expect(countedNamesOf(withMeasure(loaded, measured(130_001)))).toEqual([])
  })

  test('a load made again counts from its new size', () => {
    const grown = withMeasure(loopLoadedAt(30_000, WRITING_CODE), measured(120_000))
    const reloaded = withLoad(grown, WRITING_CODE)

    expect(countedNamesOf(withMeasure(reloaded, measured(140_000)))).toEqual([WRITING_CODE.name])
  })

  test('fewer messages drop every load, also once the context grows back', () => {
    const grown = withMeasure(loopLoadedAt(30_000, WRITING_CODE), measured(80_000, 40))
    const compacted = withMeasure(grown, measured(20_000, 2))

    expect(countedNamesOf(compacted)).toEqual([])
    expect(countedNamesOf(withMeasure(compacted, measured(40_000, 6)))).toEqual([])
  })

  test('fewer tokens with no fewer messages keep the loads', () => {
    const shrunk = withMeasure(loopLoadedAt(30_000, WRITING_CODE), measured(20_000, 12))

    expect(countedNamesOf(shrunk)).toEqual([WRITING_CODE.name])
  })

  test('a model switch carries over the tokens after a load, then counts from the new size', () => {
    const grown = withMeasure(loopLoadedAt(30_000, WRITING_CODE), measured(90_000))
    const switched = withMeasure(grown, measured(50_000, 11, SONNET))

    expect(countedNamesOf(withMeasure(switched, measured(90_000, 12, SONNET)))).toEqual([
      WRITING_CODE.name,
    ])
    expect(countedNamesOf(withMeasure(switched, measured(90_001, 12, SONNET)))).toEqual([])
  })

  test('a load counts from the time it is made, before a request reports a size', () => {
    const grown = withMeasure(loopLoadedAt(30_000, WRITING_CODE), measured(200_000))
    expect(countedNamesOf(grown)).toEqual([])

    expect(countedNamesOf(withLoad(grown, WRITING_CODE))).toEqual([WRITING_CODE.name])
  })

  // The engine runs a tool call while the request that made it streams, so the size reported last
  // before the load comes from the request before it, here the last one before a rewind.
  test('a load made by the first request after a rewind counts, an earlier one does not', () => {
    const beforeRewind = withMeasure(loopLoadedAt(400_000, KOTLIN), measured(455_000, 900))
    expect(countedNamesOf(beforeRewind)).toEqual([KOTLIN.name])
    const loadedWhileStreaming = withLoad(beforeRewind, WRITING_CODE)
    const rewound = withMeasure(loadedWhileStreaming, measured(97_000, 12))

    expect(countedNamesOf(rewound)).toEqual([WRITING_CODE.name])
    expect(countedNamesOf(withMeasure(rewound, measured(114_000, 14)))).toEqual([
      WRITING_CODE.name,
    ])
  })

  test('a load made before any reported size counts, from the size reported next', () => {
    const pending = withLoad(NEW_LOOP, WRITING_CODE)
    expect(countedNamesOf(pending)).toEqual([WRITING_CODE.name])
    const measuredLater = withMeasure(pending, measured(40_000))

    expect(countedNamesOf(withMeasure(measuredLater, measured(140_000)))).toEqual([
      WRITING_CODE.name,
    ])
    expect(countedNamesOf(withMeasure(measuredLater, measured(140_001)))).toEqual([])
  })
})
