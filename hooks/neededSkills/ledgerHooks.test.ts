import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import { PLUGIN } from '../names'
import { test } from '../testDeclaration'
import { SUBAGENT, TURN, callSkillTool, compact } from '../testSupport'
import { requestModel, startLedgerSession } from './ledgerTestSupport'
import type { LedgerSession } from './ledgerTestSupport'
import { countedLoadsOf } from './loadLedger'

const WRITING_CODE = `${PLUGIN}:writing-code`
const COMMIT_MESSAGES = `${PLUGIN}:commit-messages`

/** Ends a turn of the agent SUBAGENT. */
function endAgentTurn($: Engine) {
  return $.turn.complete({
    answer: '',
    durationMs: 5,
    isAborted: false,
    turnId: TURN,
    reason: 'answer',
    agentId: SUBAGENT,
  })
}

/** The skills and files that count for the loop of `agentId`, or the main conversation. */
function countedOf({ written: { ledgers } }: LedgerSession, agentId?: string): string[] {
  const loop = agentId === undefined ? ledgers?.main : ledgers?.agents[agentId]

  return loop === undefined ? [] : countedLoadsOf(loop).map(load => load.name)
}

describe('the ledger of each loop', () => {
  test('the main conversation and an agent count their loads apart', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    await requestModel($, ledger, 40_000)
    await callSkillTool($, WRITING_CODE)
    await requestModel($, ledger, 30_000, { agentId: SUBAGENT })
    await callSkillTool($, COMMIT_MESSAGES, SUBAGENT)

    expect(countedOf(ledger)).toEqual([WRITING_CODE])
    expect(countedOf(ledger, SUBAGENT)).toEqual([COMMIT_MESSAGES])
  })

  test(
    'a slash command with the name of a skill loads the skill in the main conversation',
    async ($, on) => {
      const ledger = await startLedgerSession($, on)
      await $.prompt.submit({
        text: `/${WRITING_CODE}`,
        origin: { kind: 'composer' },
        wait: false,
        command: { name: WRITING_CODE, args: '' },
      })

      expect(countedOf(ledger)).toEqual([WRITING_CODE])
    },
  )

  test('a failed Skill call loads nothing', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    const { session } = ledger
    await requestModel($, ledger, 40_000)
    session.isSkillFailing = true
    await callSkillTool($, WRITING_CODE)
    session.isSkillFailing = false
    session.isSkillDenied = true
    await callSkillTool($, COMMIT_MESSAGES)

    expect(countedOf(ledger)).toEqual([])
  })

  test('a load made while its request streams counts from the size that request reports', async (
    $,
    on,
  ) => {
    const ledger = await startLedgerSession($, on)
    await requestModel($, ledger, 40_000, { messageCount: 10 })
    await requestModel($, ledger, 50_000, {
      messageCount: 12,
      whileStreaming: () => callSkillTool($, WRITING_CODE),
    })
    await requestModel($, ledger, 150_000, { messageCount: 14 })

    expect(countedOf(ledger)).toEqual([WRITING_CODE])
  })

  test('a load made while the first request after a rewind streams counts', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    await requestModel($, ledger, 455_000, { messageCount: 900 })
    await requestModel($, ledger, 97_000, {
      messageCount: 12,
      whileStreaming: () => callSkillTool($, WRITING_CODE),
    })
    await requestModel($, ledger, 114_000, { messageCount: 14 })

    expect(countedOf(ledger)).toEqual([WRITING_CODE])
  })

  test('a compaction drops every load, also one waiting for a reported size', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    await requestModel($, ledger, 40_000)
    await callSkillTool($, WRITING_CODE)
    await requestModel($, ledger, 45_000)
    await callSkillTool($, COMMIT_MESSAGES)
    await compact($)
    await requestModel($, ledger, 20_000)

    expect(countedOf(ledger)).toEqual([])
  })

  test('the end of an agent run removes its ledger', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    await requestModel($, ledger, 30_000, { agentId: SUBAGENT })
    await callSkillTool($, WRITING_CODE, SUBAGENT)
    await endAgentTurn($)

    expect(ledger.written.ledgers?.agents).toEqual({})
  })

  test('the ledger of a teammate lasts across turns until the teammate ends', async ($, on) => {
    const ledger = await startLedgerSession($, on)
    const teammate: AgentInfo = {
      id: SUBAGENT,
      teammateId: 'scout@team',
      description: 'scout',
      type: 'teammate',
      status: 'idle',
    }
    ledger.session.agents.push(teammate)
    await requestModel($, ledger, 30_000, { agentId: SUBAGENT })
    await callSkillTool($, WRITING_CODE, SUBAGENT)
    await endAgentTurn($)
    expect(countedOf(ledger, SUBAGENT)).toEqual([WRITING_CODE])
    ledger.session.agents = [{ ...teammate, status: 'completed' }]
    await endAgentTurn($)

    expect(ledger.written.ledgers?.agents).toEqual({})
  })
})
