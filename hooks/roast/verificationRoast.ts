import type {
  EngineInterface,
  Frozen,
  MatchedHook,
  On,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { denyFailedHook } from '../hookFailure'
import { NON_BLANK } from '../inputs'
import { AGENT_TOOL, FINAL_VERIFICATION_AGENT } from '../names'
import { CHANGE_NAME_RULE, isChangeName } from './changeName'
import { forkRoastWithinHook } from './roastActions'
import type { ForkedRoast } from './roastActions'
import { RoastNotWrittenCause } from './roastFailure'
import { ROAST_WORK, ROAST_WORK_TOOL } from './roastNames'
import { writeVerificationRoastPrompt } from './roastPromptTexts'
import { VerificationRoastVerdict, readVerificationRoastReply } from './roastReply'
import { RoastShown } from './roastState'
import {
  REPORT_AS_OPEN_FINDING,
  ROAST_WORK_SUBJECT,
  describeVerificationRoastDelayed,
  describeVerificationRoastNotWritten,
} from './roastTexts'

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
 * the main conversation as /roast writes one, of the work on the change that agent verifies.
 */
export function registerVerificationRoast(on: On): void {
  on('session.start', EVERY_EVENT, registerRoastWorkTool)
  on('tool.call', { tool: ROAST_WORK_TOOL }, roastWork).catch(($, _e, next) =>
    denyFailedHook($, ROAST_WORK_SUBJECT, next.error),
  )
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
 * Returns to the final-verification agent the roast of the work on `change`, and denies every
 * other caller. Calls a fork again after an error from the API that may clear on its own, as
 * forkRoastWithinHook does, while the budget of the hook allows.
 */
const roastWork: MatchedHook<'tool.call', { tool: typeof ROAST_WORK_TOOL }> = async (
  $,
  e,
  next,
) => {
  const denied = await findDeniedCaller($, e)
  if (denied !== undefined) {
    return { deny: DENIALS[denied] }
  }
  const { change } = e
  if (typeof change !== 'string' || !isChangeName(change)) {
    return { deny: CHANGE_NOT_NAMED }
  }

  return answerWithRoast(await forkRoastWithinHook($, writeVerificationRoastPrompt(change), next))
}

/** Why roast_work denies the caller of the tool call `e`, or undefined where it may call. */
async function findDeniedCaller(
  $: EngineInterface,
  e: Frozen<ToolCallInput>,
): Promise<DeniedCaller | undefined> {
  if (isMainConversation(e)) {
    return DeniedCaller.MainConversation
  }
  const agent = (await $.agent.list()).find(listed => listed.id === e.agentId)
  if (agent === undefined) {
    return DeniedCaller.UnlistedAgent
  }

  return agent.type === FINAL_VERIFICATION_AGENT ? undefined : DeniedCaller.OtherAgent
}

/** The result of roast_work for the reply of the fork in `roast`, or the denial without one. */
function answerWithRoast(roast: ForkedRoast): ToolCallResult {
  switch (roast.shown) {
    case RoastShown.WritingAgain:
      return { deny: describeVerificationRoastDelayed(roast) }
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
      return { result: read.model.roast }
    case VerificationRoastVerdict.NoPoint:
      return { result: NO_POINT_FOUND }
  }
}
