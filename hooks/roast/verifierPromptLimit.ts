import type { AgentSpawnInput, EngineInterface, Frozen, MatchedHook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { logAndDescribe } from '../hookFailure'
import type { HookSubject } from '../hookFailure'
import { FINAL_VERIFICATION_AGENT } from '../names'
import { CHANGE_NAME_RULE, isChangeName } from './changeName'

const MESSAGE_REFUSAL =
  `The message was refused. Every message to ${FINAL_VERIFICATION_AGENT}, the prompt that starts ` +
  `or resumes it included, is ${CHANGE_NAME_RULE}. The agent judges the change itself, so the ` +
  'message only says which change to check. Send it again as that name.'

const MESSAGE_LIMIT_SUBJECT: HookSubject = {
  name: `limit on messages to ${FINAL_VERIFICATION_AGENT}`,
  nextStep: 'The message was not sent. Send it again.',
}

/**
 * Registers the hooks that deny every message to the final-verification agent other than a short
 * name of the change: the prompt that starts or resumes the agent, and each message sent to it. A
 * resume without a message passes. A hook of the limit that fails denies the message as well.
 */
export function registerVerifierPromptLimit(on: On): void {
  on('agent.spawn', { subagentType: FINAL_VERIFICATION_AGENT }, limitVerifierPrompt).catch(
    ($, e, next) =>
      next.called ? next(e) : { deny: logAndDescribe($, MESSAGE_LIMIT_SUBJECT, next.error) },
  )
  on('session.send', EVERY_EVENT, limitMessageToVerifier).catch(($, e, next) =>
    next.called
      ? next(e)
      : { isDelivered: false, reason: logAndDescribe($, MESSAGE_LIMIT_SUBJECT, next.error) },
  )
}

const limitVerifierPrompt: MatchedHook<
  'agent.spawn',
  { subagentType: typeof FINAL_VERIFICATION_AGENT }
> = (_$, e, next) =>
  isChangeName(e.prompt) || isResumeWithoutMessage(e) ? next(e) : { deny: MESSAGE_REFUSAL }

/** Whether `e` resumes an agent without a message, which the engine sends as an empty prompt. */
function isResumeWithoutMessage(e: Frozen<AgentSpawnInput>): boolean {
  return e.resume !== undefined && e.prompt === ''
}

const limitMessageToVerifier: MatchedHook<'session.send', EveryEvent> = async ($, e, next) =>
  isChangeName(e.text) || !(await isVerifierAddress($, e.to))
    ? next(e)
    : { isDelivered: false, reason: MESSAGE_REFUSAL }

/** Whether `to`, a recipient as the SendMessage tool spells one, is a final-verification agent. */
async function isVerifierAddress($: EngineInterface, to: string): Promise<boolean> {
  return (await $.agent.list()).some(
    agent =>
      agent.type === FINAL_VERIFICATION_AGENT &&
      [agent.id, agent.name, agent.teammateId].includes(to),
  )
}
