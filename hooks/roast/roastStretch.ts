import type { MatchedHook, SessionSendOrigin } from 'claude-code'

import type { EveryEvent } from '../everyEvent'
import { PLUGIN } from '../names'

export const MAIN_CONVERSATION = Symbol('main conversation')

/** A conversation of the session: the main one, or the one of a subagent by its agent id. */
type Conversation = typeof MAIN_CONVERSATION | string

/** The roast recorded for one stretch of work of `conversation`. */
export type StretchRoast = { readonly conversation: Conversation }

const roastOfStretchByConversation = new Map<Conversation, StretchRoast>()

export function isStretchRoasted(conversation: Conversation): boolean {
  return roastOfStretchByConversation.has(conversation)
}

export function recordStretchRoast(conversation: Conversation): void {
  roastOfStretchByConversation.set(conversation, { conversation })
}

/**
 * Records a roast for the stretch of work of `conversation` and returns it, or returns undefined
 * where that stretch already has one.
 */
export function recordStretchRoastOnce(conversation: Conversation): StretchRoast | undefined {
  if (isStretchRoasted(conversation)) {
    return undefined
  }
  const roast: StretchRoast = { conversation }
  roastOfStretchByConversation.set(conversation, roast)

  return roast
}

/** Whether the stretch of work for which `roast` was recorded still runs. */
export function isStretchStillRunning(roast: StretchRoast): boolean {
  return roastOfStretchByConversation.get(roast.conversation) === roast
}

export function endStretch(conversation: Conversation): void {
  roastOfStretchByConversation.delete(conversation)
}

/**
 * Ends the stretch of work of each subagent that a delivered message is addressed to, unless this
 * plugin sent that message. The address is an agent id or a name, as SendMessage spells it.
 */
export const endStretchOnMessage: MatchedHook<'session.send', EveryEvent> = async ($, e, next) => {
  const sent = await next(e)
  if (sent.isDelivered && !isSentByPlugin(e.origin)) {
    for (const agent of await $.agent.list()) {
      if (agent.id === e.to || agent.name === e.to) {
        endStretch(agent.id)
      }
    }
  }

  return sent
}

function isSentByPlugin(origin: SessionSendOrigin): boolean {
  return origin.kind === 'plugin' && origin.name === PLUGIN
}
