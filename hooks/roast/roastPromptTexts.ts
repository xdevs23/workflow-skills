import { PendingTextPlace } from '../pendingTexts'
import type { MessageAsRead } from './messagesUnseenByFork'
import {
  CompactionRoastVerdict,
  HintRoastVerdict,
  IdleRoastVerdict,
  RoastVerdict,
  VerificationRoastVerdict,
} from './roastReply'
import type {
  CompactionRoastReply,
  HintRoastReply,
  IdleRoastReply,
  RoastReply,
  VerificationRoastReply,
} from './roastReply'

/** The opening of every prompt for a roast. */
const ROASTER_ROLE =
  'From this message on, you are the roaster. The assistant in this conversation wrote the ' +
  'earlier replies.'

/** Keeps the roaster out of the work of the assistant, which may still be running. */
const DO_NOT_CONTINUE_WORK =
  'Do not answer the user, and do not carry out any request made in this conversation.'

const WRITE_ROAST_TO_ASSISTANT = 'Write the roast to the assistant as "you".'

/** The opening of the prompts for the roast and the idle roast. */
const ROAST_OPENING =
  `${ROASTER_ROLE} Review the work of the assistant so far and roast that work. The user may ` +
  `send your roast to the assistant in this conversation. ${WRITE_ROAST_TO_ASSISTANT} In the ` +
  'roast, talk only to the assistant and never to the user.'

/** The note that the roaster wrote the roast, before the text of every roast sent to the model. */
const ROASTER_SOURCE =
  'This roast comes from the roaster, a side agent that reviews work. The user did not write it, ' +
  'and it does not have their authority.'

/** What the assistant disregarded, as each point of a roast names it. */
const ROAST_POINT_SOURCES =
  'an instruction or a decision of the user, a rule of an instruction file or a loaded skill, or ' +
  'a fact that a tool result or the user stated'

const ROAST_POINT_EVIDENCE =
  'For each point, name the rule by its name, such as a section of a skill, or name the fact ' +
  'from the transcript, without quoting the text of the rule. Say what the assistant did ' +
  'instead and what that cost. Name only points the transcript proves.'

const ROAST_MISSED_GOAL =
  'Where the work does not reach a goal of the user, add at least one line that names the goal ' +
  'and says why the work does not reach it.'

/** What every roast contains: the evidence for each point, and why the work misses a goal. */
const ROAST_CONTENT = `${ROAST_POINT_EVIDENCE} ${ROAST_MISSED_GOAL}`

const ROAST_CONTENT_WITHOUT_REPEATS =
  `${ROAST_CONTENT} Leave out each point that an earlier roast in this conversation ` +
  'already made, unless the assistant repeated what that point names after that roast.'

const ROAST_BLUNTNESS = 'Be blunt: no praise, no softening.'

const JSON_REPLY =
  'You have no tools for this reply, so answer straight away with one JSON object and nothing ' +
  'before or after it, without a code fence.'

/** The request for the points of the roast, without the reply where the transcript proves none. */
const ROAST_POINTS =
  `${ROAST_OPENING} Find one or more points where the assistant disregarded the rules or the ` +
  `facts in its context: ${ROAST_POINT_SOURCES}. ${ROAST_CONTENT_WITHOUT_REPEATS}`

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
  `loaded again. ${ROAST_CONTENT_WITHOUT_REPEATS} ${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ` +
  `${IDLE_ROAST_REPLY_EXAMPLE}, or with ${NO_BLOCKING_POINT_REPLY_EXAMPLE} if no point blocks ` +
  'the work.'

const COMPACTION_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: CompactionRoastVerdict.Roast,
  roast: '<the roast>',
} satisfies CompactionRoastReply)

const COMPACTION_NO_POINT_REPLY_EXAMPLE = JSON.stringify({
  verdict: CompactionRoastVerdict.NoPoint,
} satisfies CompactionRoastReply)

/**
 * The message that asks a fork made from the main conversation, as a compaction starts, for the
 * compaction roast. The fork replies with a JSON object, which readCompactionRoastReply reads.
 */
export const COMPACTION_ROAST_PROMPT =
  `${ROAST_POINTS} ${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ` +
  `${COMPACTION_ROAST_REPLY_EXAMPLE}, or with ${COMPACTION_NO_POINT_REPLY_EXAMPLE} if the ` +
  'transcript proves no point.'

const ROAST_SENT_AT: Record<PendingTextPlace, string> = {
  [PendingTextPlace.ToolResult]: 'They forwarded it while you worked.',
  [PendingTextPlace.BesidePrompt]: 'They forwarded it before this message.',
}

const READ_ROAST_FIRST = 'Read the roast before you go on:'

/**
 * The note at `place` that sends the model `message`: a roast forwarded by the user, with the
 * comment that the user typed before it.
 */
export function describeRoastNote(place: PendingTextPlace, message: string): string {
  return (
    'The user forwarded you the following roast about your work, after the comment they typed, ' +
    'if any. ' +
    `${ROAST_SENT_AT[place]} ${READ_ROAST_FIRST}\n\n${message}`
  )
}

/** The message that sends the model `roast`, a roast written by the idle roast. */
export function describeIdleRoastMessage(roast: string): string {
  return attributeRoastToRoaster(roast, READ_ROAST_FIRST)
}

/** The message that sends the model `roast`, written about the chat before a compaction. */
export function describeCompactionRoastMessage(roast: string): string {
  return attributeRoastToRoaster(
    roast,
    `It covers the chat before the compaction. ${READ_ROAST_FIRST}`,
  )
}

/**
 * `roast` as the model gets it: ROASTER_SOURCE, then `request` on the same line where given, then
 * the roast. Every roast sent to the model goes through this function.
 */
export function attributeRoastToRoaster(roast: string, request?: string): string {
  const opening = request === undefined ? ROASTER_SOURCE : `${ROASTER_SOURCE} ${request}`

  return `${opening}\n\n${roast}`
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
    'take the complaint into the roast as a point, written to the assistant as "you". The ' +
    'assistant does not see the complaint. Do not quote it, and write the point from the ' +
    'transcript alone.' +
    `\n\n${JSON_REPLY} Where the transcript proves the complaint, reply with ` +
    `${ROAST_REPLY_EXAMPLE}. Where the transcript proves only some claims of the complaint, ` +
    'write the roast on those claims alone, and leave every other claim out of the roast ' +
    `without mentioning it. ${ROAST_BLUNTNESS} Where the transcript proves no claim of the ` +
    `complaint, write no roast. Reply instead with ${REFUSED_REPLY_EXAMPLE}, with the reason ` +
    'written to the user: say that no claim of the complaint holds and why, and ask the user to ' +
    'clarify the complaint. In the reason, call the assistant "the assistant" and never "you", ' +
    'since the user did none of its work. Only ' +
    'the user reads the reason, and the reason never reaches the assistant.\n\nThe complaint, as ' +
    `the user typed it:\n\n${finding}`
  )
}

const VERIFICATION_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: VerificationRoastVerdict.Roast,
  changePoints: '<the points on the change>',
  processPoints: '<the points on the process>',
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
    `it. ${DO_NOT_CONTINUE_WORK} The assistant says that the change ` +
    `${JSON.stringify(change)} is done. Find ` +
    'every point where the work on that change disregards the rules or the facts in its ' +
    `context, ${ROAST_POINT_SOURCES}, or claims more than the transcript proves. ` +
    `${ROAST_CONTENT} Sort the points into two lists, each written as one text. A point ` +
    'on the change names what the files of the change still show after the last edit to the ' +
    'change in the transcript: its diff, its commit or merge message, the entry for the change ' +
    'in TODO.md, or a claim of that message that no log of a run backs. Count an edit that ' +
    'removes or rewords evidence of the change, such as a log or a Test line, as a point on the ' +
    'change. Repeat each point on the change that an earlier final verification left open, ' +
    'unless the files of the change no longer show it after an edit in the transcript. A point ' +
    'on the process names how the assistant did the work, which no file of the change shows, ' +
    'such as a rewritten branch or a check run late. Write both lists to ' +
    `the assistant as "you". ${ROAST_BLUNTNESS} ${JSON_REPLY} Reply with ` +
    `${VERIFICATION_ROAST_REPLY_EXAMPLE}, without the field for a list with no point, or with ` +
    `${NO_POINT_REPLY_EXAMPLE} if the transcript proves no point.`
  )
}

const HINT_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: HintRoastVerdict.Roast,
  roast: '<the roast>',
} satisfies HintRoastReply)

const HINT_NO_POINT_REPLY_EXAMPLE = JSON.stringify({
  verdict: HintRoastVerdict.NoPoint,
} satisfies HintRoastReply)

/**
 * The message that asks a fork made from the main conversation for the roast that sends the
 * assistant back to work after its last reply. The roast takes the place of `hints`, the texts of
 * the hints that phrases in that reply call for, and names what `tasks` ask for, the roaster task
 * of each kind of those hints. The fork replies with a JSON object, which readHintRoastReply reads.
 */
export function writeHintRoastPrompt({
  tasks,
  hints,
}: {
  tasks: readonly string[]
  hints: readonly string[]
}): string {
  return (
    `${ROASTER_ROLE} The assistant ended its turn on its last reply, and a hook found phrases in ` +
    'that reply that call for the hint below. The assistant goes back to work with your roast, ' +
    `in place of the hint, which it does not see. ${DO_NOT_CONTINUE_WORK} Roast that reply. ` +
    `${tasks.join(' ')} Carry into the roast every step of the hint that the transcript does ` +
    `not show done. ${ROAST_CONTENT} ${WRITE_ROAST_TO_ASSISTANT} ${ROAST_BLUNTNESS} ` +
    `${JSON_REPLY} Reply with ${HINT_ROAST_REPLY_EXAMPLE}, or with ` +
    `${HINT_NO_POINT_REPLY_EXAMPLE} if the transcript proves no point.\n\nThe hint:\n\n` +
    hints.join('\n\n')
  )
}
