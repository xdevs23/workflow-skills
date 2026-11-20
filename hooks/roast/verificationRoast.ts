import type {
  EngineInterface,
  Frozen,
  MatchedHook,
  On,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { hasAgentEnded } from '../agentEnd'
import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { denyFailedHook } from '../hookFailure'
import { NON_BLANK } from '../inputs'
import { AGENT_TOOL, FINAL_VERIFICATION_AGENT } from '../names'
import { CHANGE_NAME_RULE, isChangeName } from './changeName'
import { forkRoastWithinHook } from './roastActions'
import type { RoastWithinHook } from './roastActions'
import { RoastNotWrittenCause } from './roastFailure'
import { ROAST_WORK, ROAST_WORK_TOOL } from './roastNames'
import { attributeRoastToRoaster, writeVerificationRoastPrompt } from './roastPromptTexts'
import { VerificationRoastVerdict, readVerificationRoastReply } from './roastReply'
import { RoastShown } from './roastState'
import {
  REPORT_AS_OPEN_FINDING,
  ROAST_WORK_SUBJECT,
  describeVerificationRoastDelayed,
  describeVerificationRoastNotWritten,
} from './roastTexts'
import { forgetVerifierRetry, readVerifierRetry, setVerifierRetry } from './verifierRetryState'

const ROAST_WORK_DESCRIPTION =
  'Fork the main conversation and have the roaster of /roast roast the work on the change you ' +
  'verify. The result is the roast. Only the ' +
  `${FINAL_VERIFICATION_AGENT} agent may call this tool.`

const ROAST_WORK_SCHEMA = {
  type: 'object',
  properties: {
    change: {
      type: 'string',
      pattern: NON_BLANK.source,
      description: `The change, as ${CHANGE_NAME_RULE}.`,
    },
  },
  required: ['change'],
  additionalProperties: false,
}

const CHANGE_NOT_NAMED = `Call ${ROAST_WORK} again with \`change\` set to ${CHANGE_NAME_RULE}.`

const NO_POINT_FOUND =
  'The roaster found no point in the work on this change. Check the change against the tree ' +
  'before you report it clean.'

/** The callers that roast_work denies. */
enum DeniedCaller {
  MainConversation = 'main conversation',
  OtherAgent = 'other agent',
  /** An agent that `$.agent.list()` does not name, as every agent started by a workflow. */
  UnlistedAgent = 'unlisted agent',
}

const ONLY_FINAL_VERIFICATION = `Only the ${FINAL_VERIFICATION_AGENT} agent may call ${ROAST_WORK}.`

const DENIALS: Record<DeniedCaller, string> = {
  [DeniedCaller.MainConversation]:
    `${ONLY_FINAL_VERIFICATION} Start it with the ${AGENT_TOOL} tool. Its prompt is ` +
    `${CHANGE_NAME_RULE}.`,
  [DeniedCaller.OtherAgent]: `${ONLY_FINAL_VERIFICATION} Return to your task.`,
  [DeniedCaller.UnlistedAgent]:
    `An agent started by a workflow cannot call ${ROAST_WORK}, so no roast was written. ` +
    REPORT_AS_OPEN_FINDING,
}

/**
 * Registers roast_work, by which the final-verification agent gets a roast, written by a fork of
 * the main conversation as /roast writes one, of the work on the change that agent verifies. Also
 * removes the retry owed by roast_work to that agent once it ended.
 */
export function registerVerificationRoast(on: On): void {
  on('session.start', EVERY_EVENT, registerRoastWorkTool)
  on('tool.call', { tool: ROAST_WORK_TOOL }, roastWork).catch(($, _e, next) =>
    denyFailedHook($, ROAST_WORK_SUBJECT, next.error),
  )
  on('turn.complete', EVERY_EVENT, forgetRetryOfEndedAgent)
}

const registerRoastWorkTool: MatchedHook<'session.start', EveryEvent> = async ($, e, next) => {
  await $.tool.register({
    name: ROAST_WORK,
    description: ROAST_WORK_DESCRIPTION,
    inputSchema: ROAST_WORK_SCHEMA,
    isDeferred: false,
  })

  return next(e)
}

/**
 * Returns to the final-verification agent the roast on the work on `change`, and denies every
 * other caller. Calls a fork again after an error from the API that may clear on its own, as
 * forkRoastWithinHook does, while the budget left for the hook allows. The next call by the same
 * agent goes on from the failed tries and the wait left by this call, until a fork ends the tries.
 */
const roastWork: MatchedHook<'tool.call', { tool: typeof ROAST_WORK_TOOL }> = async (
  $,
  e,
  next,
) => {
  const caller = await checkCaller($, e)
  if (!caller.isVerifier) {
    return { deny: DENIALS[caller.denied] }
  }
  const { change } = e
  if (typeof change !== 'string' || !isChangeName(change)) {
    return { deny: CHANGE_NOT_NAMED }
  }
  const { agentId } = caller
  const sessionId = await $.session.id()
  const forked = await forkRoastWithinHook(
    $,
    writeVerificationRoastPrompt(change),
    next,
    await readVerifierRetry($, sessionId, agentId),
    retry => setVerifierRetry($, sessionId, agentId, retry),
  )
  // Every failed try saves its retry at once, so this also removes each retry saved before this
  // roast by a call of the same agent that runs at the same time.
  if (!forked.isTryOwed) {
    await forgetVerifierRetry($, sessionId, agentId)
  }

  return answerWithRoast(forked)
}

/** Removes the retry owed by roast_work to the agent whose turn completed, once it ended. */
const forgetRetryOfEndedAgent: MatchedHook<'turn.complete', EveryEvent> = async ($, e, next) => {
  const completed = await next(e)
  if (e.agentId !== undefined && (await hasAgentEnded($, e.agentId))) {
    await forgetVerifierRetry($, await $.session.id(), e.agentId)
  }

  return completed
}

/** The final-verification agent that made the tool call, by its id, or why roast_work denies it. */
type CheckedCaller =
  | { isVerifier: true; agentId: string }
  | { isVerifier: false; denied: DeniedCaller }

/** Whether the caller that made the tool call `e` may call roast_work. */
async function checkCaller($: EngineInterface, e: Frozen<ToolCallInput>): Promise<CheckedCaller> {
  if (isMainConversation(e)) {
    return { isVerifier: false, denied: DeniedCaller.MainConversation }
  }
  const agent = (await $.agent.list()).find(listed => listed.id === e.agentId)
  if (agent === undefined) {
    return { isVerifier: false, denied: DeniedCaller.UnlistedAgent }
  }

  return agent.type === FINAL_VERIFICATION_AGENT
    ? { isVerifier: true, agentId: agent.id }
    : { isVerifier: false, denied: DeniedCaller.OtherAgent }
}

/**
 * The result that roast_work returns for the last fork in `forked`, or the denial without a roast.
 */
function answerWithRoast(forked: RoastWithinHook): ToolCallResult {
  if (forked.isTryOwed) {
    return { deny: describeVerificationRoastDelayed(forked) }
  }
  const { roast } = forked
  switch (roast.shown) {
    case RoastShown.NotWritten:
      return { deny: describeVerificationRoastNotWritten(roast.failure) }
    case RoastShown.Written:
      return answerWithReply(roast.text)
  }
}

/** The result of roast_work for the reply `text` of the fork. */
function answerWithReply(text: string): ToolCallResult {
  const read = readVerificationRoastReply(text)
  if (!read.isRead) {
    return {
      deny: describeVerificationRoastNotWritten({
        cause: RoastNotWrittenCause.UnreadableReply,
        reason: read.reason,
        reply: text,
      }),
    }
  }
  switch (read.model.verdict) {
    case VerificationRoastVerdict.Roast:
      return { result: attributeRoastToRoaster(read.model.roast) }
    case VerificationRoastVerdict.NoPoint:
      return { result: NO_POINT_FOUND }
  }
}
