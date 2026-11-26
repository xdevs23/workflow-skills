import type {
  EngineInterface,
  Frozen,
  Next,
  On,
  SessionCompactInput,
  SessionCompactResult,
} from 'claude-code'

import { isStoppedStatus } from '../agentStatus'
import { REPLACES_CONVERSATION } from '../compactionTrigger'
import { EVERY_EVENT } from '../everyEvent'
import { readWordsRecordedInSession } from '../ideas/wordsOfSession'
import { findListedAgent } from '../listedAgent'
import { readRoastOfCompaction } from './compactionReply'
import type { RoastOfCompaction } from './compactionReply'
import { listKnownWords } from './roastActions'
import { deliverRoast } from './roastDelivery'
import type { RoastedAgent } from './roastedAgent'
import { thrownFailure } from './roastFailure'
import { showRoastFailure } from './roastFailureNotice'
import { sendRoastOrNoPointReply } from './roastOrNoPoint'
import type { RoastOrNoPointTexts } from './roastOrNoPoint'
import {
  describeCompactionRoastMessage,
  writeAgentCompactionRoastInstructions,
  writePromptAfterRecordedWords,
} from './roastPromptTexts'
import { RoastSource } from './roastState'
import {
  AGENT_ROAST_FOUND_NO_POINT,
  describeAgentRoastDropped,
  describeAgentRoastNotWritten,
  describeAgentRoastNotWrittenToast,
} from './roastTexts'

/**
 * Registers the roast of each subagent of an agent type that `roastedAgentTypes` lists, before each
 * compaction that replaces its conversation. The engine forks only the main conversation, so a
 * second compaction of the subagent writes the roast: it reads the conversation of the subagent
 * from its cache. The roast goes to the subagent and to the main conversation.
 */
export function registerAgentRoast(on: On, roastedAgentTypes: readonly string[]): void {
  on('session.compact', EVERY_EVENT, ($, e, next) =>
    roastAgentBeforeCompaction($, e, next, roastedAgentTypes),
  )
}

async function roastAgentBeforeCompaction(
  $: EngineInterface,
  e: Frozen<SessionCompactInput>,
  next: Next<'session.compact'>,
  roastedAgentTypes: readonly string[],
): Promise<SessionCompactResult> {
  const agent =
    e.agentId === undefined || !REPLACES_CONVERSATION[e.trigger]
      ? undefined
      : await findAgentToRoast($, e.agentId, roastedAgentTypes)
  if (agent === undefined) {
    return next(e)
  }
  const roast = await writeRoastByCompaction($, e, next, agent)
  const compaction = await next(e)
  if (compaction.skip === undefined) {
    await useRoastOfCompaction($, roast, agent, roastedAgentTypes)
  }

  return compaction
}

/**
 * The roast of the chat of `agent`, written by a compaction of it whose summary is not kept. An
 * error of that compaction leaves the roast unwritten and the real compaction to run.
 */
async function writeRoastByCompaction(
  $: EngineInterface,
  e: Frozen<SessionCompactInput>,
  next: Next<'session.compact'>,
  agent: RoastedAgent,
): Promise<RoastOfCompaction> {
  const words = listKnownWords($, await readWordsRecordedInSession($))
  const instructions = writePromptAfterRecordedWords(
    writeAgentCompactionRoastInstructions(agent),
    words,
  )
  try {
    return readRoastOfCompaction(await next({ ...e, instructions }))
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    return { isWritten: false, failure: thrownFailure(error.message) }
  }
}

/**
 * The subagent `agentId` as the engine lists it, where `roastedAgentTypes` lists its type and it
 * was not stopped. A roast sent to a stopped subagent would wake it.
 */
async function findAgentToRoast(
  $: EngineInterface,
  agentId: string,
  roastedAgentTypes: readonly string[],
): Promise<RoastedAgent | undefined> {
  const agent = await findListedAgent($, agentId)

  return agent === undefined ||
    isStoppedStatus(agent.status) ||
    !roastedAgentTypes.includes(agent.type)
    ? undefined
    : { id: agent.id, type: agent.type, description: agent.description }
}

/** Sends the roast in `roast` about `agent`, unless it found no point, or shows why none came. */
async function useRoastOfCompaction(
  $: EngineInterface,
  roast: RoastOfCompaction,
  agent: RoastedAgent,
  roastedAgentTypes: readonly string[],
): Promise<void> {
  const texts = agentRoastTexts(agent)
  if (!roast.isWritten) {
    showRoastFailure($, roast.failure, texts)

    return
  }
  await sendRoastOrNoPointReply($, roast.reply, texts, text =>
    sendAgentRoast($, agent, roastedAgentTypes, text),
  )
}

function agentRoastTexts(agent: RoastedAgent): RoastOrNoPointTexts {
  return {
    foundNoPoint: AGENT_ROAST_FOUND_NO_POINT,
    describeNotAskedAgain: () => describeAgentRoastDropped(agent),
    describeNotWritten: describeAgentRoastNotWritten,
    describeNotWrittenToast: describeAgentRoastNotWrittenToast,
  }
}

/**
 * Sends `text`, a roast about `agent`, to the subagent, and then to the main conversation as
 * deliverRoast describes, with what became of the roast sent to the subagent. Drops the roast where
 * the subagent was stopped meanwhile.
 */
async function sendAgentRoast(
  $: EngineInterface,
  agent: RoastedAgent,
  roastedAgentTypes: readonly string[],
  text: string,
): Promise<void> {
  if ((await findAgentToRoast($, agent.id, roastedAgentTypes)) === undefined) {
    $.ui.log(describeAgentRoastDropped(agent), { to: 'debug' })

    return
  }
  const sentToAgent = await $.session.send({
    to: { agentId: agent.id },
    text: describeCompactionRoastMessage(text),
  })
  const sessionId = await $.session.id()
  await deliverRoast($, { source: RoastSource.Agent, sessionId, text, agent, sentToAgent })
}
