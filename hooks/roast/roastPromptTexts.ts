import { PendingTextPlace } from '../pendingTexts'
import type { MessageAsRead } from './messagesUnseenByFork'
import { IdleRoastVerdict, RoastVerdict, VerificationRoastVerdict } from './roastReply'
import type { IdleRoastReply, RoastReply, VerificationRoastReply } from './roastReply'

/** The opening of every prompt for a roast. */
const ROASTER_ROLE =
  'From this message on, you are the roaster. The assistant in this conversation wrote the ' +
  'earlier replies.'

/** The opening of the prompts for the roast and the idle roast. */
const ROAST_OPENING =
  `${ROASTER_ROLE} Review the work of the assistant so far and roast that work. The user may ` +
  'send your roast to this conversation as their own message, so write the roast to the ' +
  'assistant as "you". In the roast, talk only to the assistant and never to the user.'

/** What the assistant disregarded, as each point of a roast names it. */
const ROAST_POINT_SOURCES =
  'an instruction or a decision of the user, a rule of an instruction file or a loaded skill, or ' +
  'a fact that a tool result or the user stated'

const ROAST_POINT_EVIDENCE =
  'For each point, quote the rule or the fact, and say what the assistant did instead and what ' +
  'that cost. Name only points the transcript proves.'

const ROAST_POINT_PROOF =
  `${ROAST_POINT_EVIDENCE} Leave out each point that an earlier roast in this conversation ` +
  'already made, unless the assistant repeated what that point names after that roast.'

const ROAST_BLUNTNESS = 'Be blunt: no praise, no softening.'

const JSON_REPLY =
  'You have no tools for this reply, so answer straight away with one JSON object and nothing ' +
  'before or after it, without a code fence.'

/** The request for the points of the roast, without the reply where the transcript proves none. */
const ROAST_POINTS =
  `${ROAST_OPENING} Find one or more points where the assistant disregarded the rules or the ` +
  `facts in its context: ${ROAST_POINT_SOURCES}. ${ROAST_POINT_PROOF}`

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

/**
 * `prompt` for a fork that does not see `unseen`, the newest messages of the main conversation,
 * with those messages before it. `prompt` alone where `unseen` is empty.
 */
export function writePromptAfterUnseenMessages(
  prompt: string,
  unseen: readonly MessageAsRead[],
): string {
  if (unseen.length === 0) {
    return prompt
  }

  return (
    'The transcript you see ends before the newest messages of this conversation. These ' +
    'messages came after it, as a JSON array of messages with their text, their tool calls and ' +
    'the text of each tool result. Read them as the end of the transcript, and judge the work of ' +
    `the assistant up to the last of them:\n\n${JSON.stringify(unseen)}\n\n${prompt}`
  )
}

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

const VERIFICATION_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: VerificationRoastVerdict.Roast,
  roast: '<the roast>',
} satisfies VerificationRoastReply)

const NO_POINT_REPLY_EXAMPLE = JSON.stringify({
  verdict: VerificationRoastVerdict.NoPoint,
} satisfies VerificationRoastReply)

/**
 * The message that asks a fork made from the main conversation for the roast of the work on
 * `change`, the name by which the final-verification agent calls the change it verifies.
 * The fork replies with a JSON object, which readVerificationRoastReply reads.
 */
export function writeVerificationRoastPrompt(change: string): string {
  return (
    `${ROASTER_ROLE} The work of the assistant may still be running, and you do not continue ` +
    'it: do not answer the user, and do not carry out any request made in this conversation. ' +
    `The assistant says that the change ${JSON.stringify(change)} is done. Find ` +
    'every point where the work on that change disregards the rules or the facts in its ' +
    `context, ${ROAST_POINT_SOURCES}, or claims more than the transcript proves. Repeat each ` +
    'point that an earlier final verification left open, unless the transcript resolves it. ' +
    `Count an edit that removes or rewords evidence as a point. ${ROAST_POINT_EVIDENCE} Write ` +
    `the roast to the assistant as "you". ${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ` +
    `${VERIFICATION_ROAST_REPLY_EXAMPLE}, or with ${NO_POINT_REPLY_EXAMPLE} if the transcript ` +
    'proves no point.'
  )
}
