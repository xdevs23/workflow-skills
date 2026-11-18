import { PendingTextPlace } from '../pendingTexts'
import { IdleRoastVerdict, RoastVerdict } from './roastReply'
import type { IdleRoastReply, RoastReply } from './roastReply'

/** The opening of the prompts for the roast and the idle roast. */
const ROAST_OPENING =
  'From this message on, you are the roaster. The assistant in this conversation wrote the ' +
  'earlier replies. Review the work of the assistant so far and roast that work. The user may ' +
  'send your roast to this conversation as their own message, so write the roast to the ' +
  'assistant as "you". In the roast, talk only to the assistant and never to the user.'

const ROAST_POINT_PROOF =
  'For each point, quote the rule or the fact, and say what the assistant did instead and what ' +
  'that cost. Name only points the transcript proves. Leave out each point that an earlier roast ' +
  'in this conversation already made, unless the assistant repeated what that point names after ' +
  'that roast.'

const ROAST_BLUNTNESS = 'Be blunt: no praise, no softening.'

const JSON_REPLY =
  'You have no tools for this reply, so answer straight away with one JSON object and nothing ' +
  'before or after it, without a code fence.'

/** The request for the points of the roast, without the reply where the transcript proves none. */
const ROAST_POINTS =
  `${ROAST_OPENING} Find one or more points where the assistant disregarded the rules or the ` +
  'facts in its context: an instruction or a decision of the user, a rule of an instruction file ' +
  `or a loaded skill, or a fact that a tool result or the user stated. ${ROAST_POINT_PROOF}`

const IDLE_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: IdleRoastVerdict.Roast,
  roast: '<the roast>',
} satisfies IdleRoastReply)

const NO_BLOCKING_POINT_REPLY_EXAMPLE = JSON.stringify({
  verdict: IdleRoastVerdict.NoBlockingPoint,
} satisfies IdleRoastReply)

/**
 * The message that asks a fork made from the idle main conversation for the idle roast. The fork
 * replies with a JSON object, which readIdleRoastReply reads.
 */
export const IDLE_ROAST_PROMPT =
  `This conversation has been idle since the last reply of the assistant. ${ROAST_OPENING} ` +
  'Name only points that hold up the work, such as waiting for something the assistant could do ' +
  'itself, asking permission for work the user already ordered, reporting something false as ' +
  'done, or leaving a task half finished. Leave out minor points, such as a skill that was not ' +
  `loaded again. ${ROAST_POINT_PROOF} ${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ` +
  `${IDLE_ROAST_REPLY_EXAMPLE}, or with ${NO_BLOCKING_POINT_REPLY_EXAMPLE} if no point blocks ` +
  'the work.'

const ROAST_SENT_AT: Record<PendingTextPlace, string> = {
  [PendingTextPlace.ToolResult]: 'They sent the roast while you worked.',
  [PendingTextPlace.BesidePrompt]: 'They sent the roast before this message.',
}

/**
 * The note at `place` that sends the model `message`: a roast that the user sent, with the comment
 * that the user typed before it.
 */
export function describeRoastNote(place: PendingTextPlace, message: string): string {
  return (
    'The user sent you the following roast about your work as their own message. ' +
    `${ROAST_SENT_AT[place]} Read the roast before you go on:\n\n${message}`
  )
}

/** The message that sends the model `roast`, written by the idle roast, as one of the user. */
export function describeIdleRoastMessage(roast: string): string {
  return (
    'The user switched on the idle roast, which wrote the following roast about your work while ' +
    'this conversation was idle. The user sends the roast to you as their own message. Read the ' +
    `roast before you go on:\n\n${roast}`
  )
}

const ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: RoastVerdict.Roast,
  roast: '<the roast>',
} satisfies RoastReply)

const REFUSED_REPLY_EXAMPLE = JSON.stringify({
  verdict: RoastVerdict.Refused,
  reason: '<the reason>',
} satisfies RoastReply)

const ROAST_PROMPT =
  `${ROAST_POINTS} If the transcript proves no point, write one sentence saying so as the roast. ` +
  `${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ${ROAST_REPLY_EXAMPLE}`

/**
 * The message that asks a fork made from the main conversation for the roast, with `finding`, the
 * complaint typed by the user after the command, unless it is empty. The fork replies with
 * a JSON object, which readRoastReply reads.
 */
export function writeRoastPrompt(finding: string): string {
  if (finding === '') {
    return ROAST_PROMPT
  }

  return (
    `${ROAST_POINTS}\n\nThe user typed a complaint after the command that asked you for this ` +
    'roast. The user wrote the complaint. The assistant did not. The complaint is about the work ' +
    'of the assistant, and the user addresses the complaint to you, the roaster. Do not answer ' +
    'the complaint in the roast. Use the complaint only to write the roast to the assistant: ' +
    'take the complaint into the roast as a point, written to the assistant as "you", with the ' +
    `rule or the fact from the transcript that the complaint concerns.\n\n${JSON_REPLY} Where ` +
    `the transcript proves the complaint, reply with ${ROAST_REPLY_EXAMPLE}. ` +
    `${ROAST_BLUNTNESS} Where the transcript shows the complaint to be unjustified or invalid, ` +
    'or does not show what the complaint claims, write no roast. Reply instead with ' +
    `${REFUSED_REPLY_EXAMPLE}, with the reason written to the user: say that the claim is ` +
    'unfounded and why, and ask the user to clarify the complaint. In the reason, call the ' +
    'assistant "the assistant" and never "you", since the user did none of its work. Only the ' +
    'user reads the reason, and the reason never reaches the assistant.\n\nThe complaint, as the ' +
    `user typed it:\n\n${finding}`
  )
}
