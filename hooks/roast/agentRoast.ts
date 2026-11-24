import type {
  EngineInterface,
  Frozen,
  Next,
  On,
  SessionCompactInput,
  SessionCompactResult,
  SessionMessage,
} from 'claude-code'

import { isStoppedStatus } from '../agentStatus'
import { REPLACES_CONVERSATION } from '../compactionTrigger'
import { messageOf } from '../errorMessage'
import { EVERY_EVENT } from '../everyEvent'
import { showFailure } from '../failureToast'
import { readWordsRecordedInSession } from '../ideas/wordsOfSession'
import { findListedAgent } from '../listedAgent'
import { SWITCHING_SOURCES } from '../sessionSources'
import {
  cancelAgentIdleWait,
  cancelEveryAgentIdleWait,
  startAgentIdleWait,
} from './agentIdleWait'
import { useAfterCompaction } from './compactionRoast'
import { isIdleRoastSwitchedOn } from './idleRoast'
import { readAsModelRead } from './messagesUnseenByFork'
import type { MessageAsRead } from './messagesUnseenByFork'
import { askAgainAfterPassingErrors, listKnownWords, readModelReply } from './roastActions'
import type { RoastTry } from './roastActions'
import { deliverRoast } from './roastDelivery'
import { AgentRoastTrigger } from './roastedAgent'
import type { RoastedAgent } from './roastedAgent'
import { thrownFailure } from './roastFailure'
import { useRoastOrNoPoint } from './roastOrNoPoint'
import type { RoastOrNoPointTexts } from './roastOrNoPoint'
import {
  describeAgentRoastMessage,
  writeAgentRoastPrompt,
  writePromptAfterRecordedWords,
} from './roastPromptTexts'
import { RoastSource } from './roastState'
import { endStretchOnMessage, isStretchStillRunning, recordStretchRoastOnce } from './roastStretch'
import {
  AGENT_ROAST_FOUND_NO_POINT,
  describeAgentRoastDropped,
  describeAgentRoastNotWritten,
  describeAgentRoastNotWrittenToast,
  describeAgentTranscriptNotRead,
} from './roastTexts'
import { writePromptInBudget } from './transcriptTail'

// The type of `maxTokens` of `$.model.complete` in Claude Code 2.1.325, read on 2026-11-24, sets
// the cap on the tokens of one reply: the output limit of the model or 64000, whichever is lower.
// The default of 1024 leaves no room for a roast after the thinking before it. The engine reports
// no output limit of a model, so a model whose limit is lower refuses the roast.
const REPLY_TOKEN_CAP = 64_000

/**
 * A roast about the work of `agent`, asked in the session `sessionId` once `trigger` happened,
 * from `transcript`, the messages of the subagent, while `isWanted` holds.
 */
type AgentRoastRequest = {
  sessionId: string
  agent: RoastedAgent
  trigger: AgentRoastTrigger
  transcript: readonly MessageAsRead[]
  isWanted: () => Promise<boolean>
}

/**
 * Registers the hooks that roast the work of each subagent of an agent type that
 * `roastedAgentTypes` lists. Once such a subagent was idle for IDLE_WAIT_SECONDS after a turn, in a
 * session with the idle roast switched on, it gets a roast of what blocks the work, once per
 * stretch of its work. It gets another roast before each compaction of its conversation. A turn
 * ended by an interrupt stopped the subagent, so no wait follows it. Each roast goes to the
 * subagent and to the main conversation.
 */
export function registerAgentRoast(on: On, roastedAgentTypes: readonly string[]): void {
  on('turn.complete', EVERY_EVENT, async ($, e, next) => {
    const completed = await next(e)
    if (e.agentId !== undefined && !e.isAborted) {
      await startIdleWaitOfAgentToRoast($, e.agentId, roastedAgentTypes)
    }

    return completed
  })
  on('turn.start', EVERY_EVENT, (_$, e, next) => {
    if (e.agentId !== undefined) {
      cancelAgentIdleWait(e.agentId)
    }

    return next(e)
  })
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, (_$, e, next) => {
    cancelEveryAgentIdleWait()

    return next(e)
  })
  on('session.compact', EVERY_EVENT, ($, e, next) =>
    roastAgentBeforeCompaction($, e, next, roastedAgentTypes),
  )
  on('session.send', EVERY_EVENT, endStretchOnMessage)
}

/**
 * Starts the wait of the subagent `agentId` at the end of one of its turns, where
 * `roastedAgentTypes` lists its type. The engine lists a subagent for a short time after its turn,
 * so the wait keeps the subagent as listed here.
 */
async function startIdleWaitOfAgentToRoast(
  $: EngineInterface,
  agentId: string,
  roastedAgentTypes: readonly string[],
): Promise<void> {
  const agent = await findAgentToRoast($, agentId, roastedAgentTypes)
  if (agent !== undefined) {
    startAgentIdleWait(
      $,
      agentId,
      isStillIdle => roastIdleAgent($, agent, isStillIdle),
      describeAgentRoastThrown,
    )
  }
}

/**
 * Has a model roast the work of `agent` once its wait ended, where the idle roast is on, the
 * subagent was not stopped and its stretch of work has no roast yet. Drops the roast once the
 * subagent started a turn, the stretch ended or the idle roast was switched off.
 */
async function roastIdleAgent(
  $: EngineInterface,
  agent: RoastedAgent,
  isStillIdle: () => boolean,
): Promise<void> {
  if (!isIdleRoastSwitchedOn() || (await isAgentStopped($, agent.id))) {
    return
  }
  const stretchRoast = recordStretchRoastOnce(agent.id)
  if (stretchRoast === undefined) {
    return
  }
  const read = await $.session.messages({ agentId: agent.id })
  if ('deny' in read) {
    showFailure($, describeAgentTranscriptNotRead(read.deny))

    return
  }
  const request: AgentRoastRequest = {
    sessionId: await $.session.id(),
    agent,
    trigger: AgentRoastTrigger.Idle,
    transcript: readForRoaster(read),
    isWanted: async () =>
      isStillIdle() &&
      isStretchStillRunning(stretchRoast) &&
      isIdleRoastSwitchedOn() &&
      !(await isAgentStopped($, agent.id)),
  }
  await useAgentRoast($, request, await askAgentRoast($, request))
}

/**
 * Has a model roast the chat of a subagent before a compaction that replaces its conversation,
 * where `roastedAgentTypes` lists its type, and runs the compaction without waiting for the model.
 * The roast goes out once the compaction ended without a skip, so the subagent reads it after the
 * summary.
 */
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
  const request: AgentRoastRequest = {
    sessionId: await $.session.id(),
    agent,
    trigger: AgentRoastTrigger.Compaction,
    transcript: readForRoaster(e.messages),
    isWanted: () => isAgentToRoast($, agent.id, roastedAgentTypes),
  }
  const roast = askAgentRoast($, request)
  const compaction = next(e)
  useAfterCompaction(compaction, roast, written => useAgentRoast($, request, written)).catch(
    (error: unknown) => {
      showFailure($, describeAgentRoastThrown(messageOf(error)))
    },
  )

  return compaction
}

/**
 * `messages` as the roaster reads them. A message that holds only the thinking of the model reads
 * as an empty one, which is no work of the subagent, so it is left out.
 */
function readForRoaster(messages: readonly SessionMessage[]): MessageAsRead[] {
  return messages
    .map(readAsModelRead)
    .filter(
      ({ text, toolUses, toolResults }) =>
        text !== '' || toolUses.length > 0 || toolResults.length > 0,
    )
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

async function isAgentToRoast(
  $: EngineInterface,
  agentId: string,
  roastedAgentTypes: readonly string[],
): Promise<boolean> {
  return (await findAgentToRoast($, agentId, roastedAgentTypes)) !== undefined
}

/** Whether the engine lists the subagent `agentId` as stopped. A roast sent to it would wake it. */
async function isAgentStopped($: EngineInterface, agentId: string): Promise<boolean> {
  const agent = await findListedAgent($, agentId)

  return agent !== undefined && isStoppedStatus(agent.status)
}

/**
 * Asks the model of the main conversation for a roast of `request`, with the words of the user
 * recorded in the session, as askAgainAfterPassingErrors asks while the roast is wanted. The
 * prompt and the reply fit the context window of the model, so the prompt holds the newest
 * messages of the transcript that fit.
 */
async function askAgentRoast($: EngineInterface, request: AgentRoastRequest): Promise<RoastTry> {
  const [{ context }, model, recorded] = await Promise.all([
    $.session.usage(),
    $.session.model(),
    readWordsRecordedInSession($),
  ])
  const words = listKnownWords($, recorded)
  const { agent, trigger, transcript } = request
  const prompt = writePromptInBudget(transcript, context.window - REPLY_TOKEN_CAP, tail =>
    writePromptAfterRecordedWords(writeAgentRoastPrompt({ agent, trigger, tail }), words),
  )

  return askAgainAfterPassingErrors(
    $,
    tries => completeRoast($, model, prompt, tries),
    request.isWanted,
  )
}

async function completeRoast(
  $: EngineInterface,
  model: string,
  prompt: string,
  tries: number,
): Promise<RoastTry> {
  return readModelReply(
    await $.model.complete({ model, prompt, maxTokens: REPLY_TOKEN_CAP }),
    tries,
  )
}

/** Sends the roast in `roast` for `request`, or shows why none was written. */
async function useAgentRoast(
  $: EngineInterface,
  request: AgentRoastRequest,
  roast: RoastTry,
): Promise<void> {
  await useRoastOrNoPoint($, roast, agentRoastTexts(request.agent), text =>
    sendAgentRoast($, request, text),
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
 * Sends `text`, a roast for `request`, to the subagent of `request`, and then to the main
 * conversation as deliverRoast describes, with what became of the roast sent to the subagent.
 * Drops the roast once it is no longer wanted.
 */
async function sendAgentRoast(
  $: EngineInterface,
  { sessionId, agent, trigger, isWanted }: AgentRoastRequest,
  text: string,
): Promise<void> {
  if (!(await isWanted())) {
    $.ui.log(describeAgentRoastDropped(agent), { to: 'debug' })

    return
  }
  const sentToAgent = await $.session.send({
    to: { agentId: agent.id },
    text: describeAgentRoastMessage(trigger, text),
  })
  await deliverRoast($, { source: RoastSource.Agent, sessionId, text, agent, trigger, sentToAgent })
}

function describeAgentRoastThrown(message: string): string {
  return describeAgentRoastNotWrittenToast(thrownFailure(message))
}
