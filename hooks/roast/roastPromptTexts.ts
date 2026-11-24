import { MARK_GOAL_DONE_TOOL } from '../goals/goalNames'
import { describeIdeaLink } from '../ideas/ideaTexts'
import type { RecordedWords } from '../ideas/wordsOfSession'
import { PendingTextPlace } from '../pendingTexts'
import type { RunningAgent } from '../runningAgents'
import type { MessageAsRead } from './messagesUnseenByFork'
import {
  CompactionRoastVerdict,
  HintRoastVerdict,
  IdleRoastVerdict,
  RoastVerdict,
} from './roastReply'
import type {
  CompactionRoastReply,
  HintRoastReply,
  IdleRoastReply,
  RoastReply,
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
  'This roast comes from the roaster, a side agent that reviews work. The user did not write it. ' +
  'Check each point against what you did. Fix each point that holds. For a point that does not ' +
  'hold, say what shows that.'

const ROAST_POINT_EVIDENCE =
  'For each point, name where the transcript shows it, such as a file, a diff or what a command ' +
  'printed. Name only points the transcript proves.'

const STATE_OUTSIDE_TRANSCRIPT =
  'You see only this transcript, as it was when you were asked. You do not know what is ' +
  'released, pushed, deployed or installed, who uses the software, or what changed after the ' +
  'assistant last looked. Never state any of that as a fact, and read what the assistant said ' +
  'about it earlier as possibly out of date. Say what a point makes worse only where the ' +
  'transcript shows that, and otherwise name the defect alone.'

const ROAST_UNFINISHED_WORK =
  'Where the assistant reported a goal of the user or an entry of TODO.md as done although the ' +
  'transcript shows it unfinished, or stopped working on one that is not done, add a line that ' +
  'names it and says what is still missing to complete it.'

const MEMORY_IN_ROAST =
  'Never tell the assistant to write a memory or to move one. Where a memory is out of date or ' +
  'not needed, you may tell the assistant to delete it.'

const ROAST_INVENTED_RULE =
  'Where the assistant sets a rule or a limit for itself, such as announcing that from now on ' +
  'it runs one build at a time or writing that into a memory, and no message of the user and ' +
  'no rule loaded in this conversation sets it, add a line that names the rule and says that ' +
  'nothing sets it. Name it where the assistant sets it, also before the assistant holds any ' +
  'work back by it, and name the work that it parks, serializes or slows where it already ' +
  'does. Tell the assistant to drop the rule and to delete each memory that records it. ' +
  'Where a rule loaded in this conversation covers the case, name that rule.'

const ROAST_FINDINGS_ONLY =
  'State each point as what the transcript shows to be wrong. Never add a rule, an instruction ' +
  'or a guess of your own, and never write a doubt or a question into the roast. Say what to ' +
  'do about a point only where this message asks for that, or where a message of the user or a ' +
  'rule loaded in this conversation says it, and then name that message or rule.'

const ROAST_CONTENT = [
  ROAST_POINT_EVIDENCE,
  ROAST_FINDINGS_ONLY,
  STATE_OUTSIDE_TRANSCRIPT,
  ROAST_UNFINISHED_WORK,
  ROAST_INVENTED_RULE,
  MEMORY_IN_ROAST,
].join(' ')

const ROAST_CONTENT_WITHOUT_REPEATS =
  `${ROAST_CONTENT} Leave out each point that an earlier roast in this conversation ` +
  'already made, unless the assistant repeated what that point names after that roast.'

const NOT_A_POINT =
  'The way the assistant got to the result is never a point: a step of a process that it ' +
  'skipped or did another way, such as a skill it did not load or a record it did not keep, is ' +
  'not a point. Neither is anything else that happens inside the session, except what this ' +
  'message asks you to name. How the assistant wrote, ordered or filed a memory or another ' +
  'record that it keeps for itself is not a point. Code without comments or documents is not ' +
  'a point either, unless the user asked for them.'

const ROAST_BLUNTNESS = 'Be blunt: no praise, no softening.'

const JSON_REPLY =
  'You have no tools for this reply, so answer straight away with one JSON object and nothing ' +
  'before or after it, without a code fence.'

/** The request for the points of the roast, without the reply where the transcript proves none. */
const ROAST_POINTS =
  `${ROAST_OPENING} Find one or more points where the result of the work falls short: code ` +
  'that is wrong, slow, unclean, poorly split into modules or poorly engineered, a fix or ' +
  'another change based on a guess, without evidence in the transcript that backs it, work ' +
  'that does not do what the user asked for or decided, or a statement about the result that the ' +
  'transcript shows to be false. Hold the code to the highest standard. Where code breaks a ' +
  'rule loaded in this conversation, say how to improve the code, such as a class to refactor, ' +
  'a file to split in two, a layer smeared into another or a type leaked across a boundary. ' +
  `Judge the result alone. ${NOT_A_POINT} ${ROAST_CONTENT_WITHOUT_REPEATS}`

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
 * with those messages before it. `prompt` alone where `unseen` is empty. Only `prompt` says which
 * part of the transcript the fork judges.
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
    'the text of each tool result. Read them as the end of the transcript:\n\n' +
    `${JSON.stringify(unseen)}\n\n${prompt}`
  )
}

/**
 * `prompt` for a fork, after `agents`, the background agents of the session that are still
 * running, with the request to roast each one that the work no longer needs. Where `agents` is
 * empty, the function returns `prompt` alone, without that request.
 */
export function writePromptAfterRunningAgents(
  prompt: string,
  agents: readonly RunningAgent[],
): string {
  if (agents.length === 0) {
    return prompt
  }

  return (
    'This JSON array lists each background agent of this conversation that is running, with id, ' +
    'agent type, task description and, where given, name. The assistant stops an agent by ' +
    'passing the id listed with it to TaskStop. Count as a point each listed agent whose result ' +
    'the work no longer needs, and tell the assistant to stop it:\n\n' +
    `${JSON.stringify(agents)}\n\n${prompt}`
  )
}

export function writePromptAfterRecordedWords(
  prompt: string,
  words: readonly RecordedWords[],
): string {
  if (words.length === 0) {
    return prompt
  }
  const listed = words.map(recorded => ({
    recordedFor: describeIdeaLink(recorded.link),
    words: recorded.words,
  }))

  return (
    'This JSON array lists what the assistant recorded in this session as verbatim words of ' +
    'the user, each with the entry of TODO.md or the goal that the assistant recorded it for, ' +
    'and every project idea of this project: recorded words that count for the whole project, ' +
    'each with the entry or goal that it was for before that was finished. Read them as ' +
    'part of the transcript, also where the transcript no longer shows the message of the ' +
    'user. Judge what the user asked for and decided by these words and by the messages of the ' +
    'user in the transcript, never by how the assistant put it. A message of the user in the ' +
    'transcript outranks recorded words, and recorded words that contradict such a message ' +
    `are a point:\n\n${JSON.stringify(listed)}\n\n${prompt}`
  )
}

export function writePromptAfterOpenGoals(prompt: string, openGoals: string | undefined): string {
  if (openGoals === undefined) {
    return prompt
  }

  return (
    'This list shows the goals of the user that are open at this moment, read from the board of ' +
    'the goals and not from the transcript, each with its age, its done mark where it has one ' +
    'and the entries of TODO.md attached to it. The board proves that a goal is open, and the ' +
    'transcript shows where its work stands, also where it shows no work on the goal at all. ' +
    'Where the transcript shows the work on a goal without a done mark finished, tell the ' +
    `assistant to mark the goal as done with ${MARK_GOAL_DONE_TOOL} and name the evidence to ` +
    'give. Where the assistant is not working on such a goal although it could, count that as ' +
    'a point that holds up the work: name the goal and say what is still missing to complete ' +
    'it, such as a merge, a test or a fix that the assistant left out. A goal that the ' +
    'assistant never started counts too, and so does a goal that the assistant left alone ' +
    'again after an earlier roast named ' +
    `it. Leave out a goal that cannot move without the user:\n\n${openGoals}\n\n${prompt}`
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
    'take the complaint into the roast as a point, whatever the complaint is about, written to ' +
    'the assistant as "you". The assistant does not see the complaint. Do not quote it, and ' +
    'write the point from the transcript alone.' +
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

const HINT_ROAST_REPLY_EXAMPLE = JSON.stringify({
  verdict: HintRoastVerdict.Roast,
  roast: '<the roast>',
} satisfies HintRoastReply)

const HINT_NO_POINT_REPLY_EXAMPLE = JSON.stringify({
  verdict: HintRoastVerdict.NoPoint,
} satisfies HintRoastReply)

/**
 * The message that asks a fork made from the main conversation for the roast that sends the
 * assistant back to work after `reply`, the reply on which it ended a turn. The transcript of a
 * fork asked again after an API error may go on past `reply`, so the message quotes it. The roast
 * takes the place of `hints`, the texts of the hints that phrases in that reply call for, and names
 * what `tasks` ask for, the roaster task of each kind of those hints. The fork replies with a JSON
 * object, which readHintRoastReply reads.
 */
export function writeHintRoastPrompt({
  reply,
  tasks,
  hints,
}: {
  reply: string
  tasks: readonly string[]
  hints: readonly string[]
}): string {
  return (
    `${ROASTER_ROLE} The assistant ended a turn on the reply ${JSON.stringify(reply)}, and a ` +
    'hook found phrases in that reply that call for the hint below. The transcript may go on ' +
    'after that reply. The assistant goes back to work with your roast, in place of the hint, ' +
    `which it does not see. ${DO_NOT_CONTINUE_WORK} Roast that reply. ` +
    `${tasks.join(' ')} Carry into the roast every step of the hint that the transcript does ` +
    `not show done. ${NOT_A_POINT} ${ROAST_CONTENT} ${WRITE_ROAST_TO_ASSISTANT} ` +
    `${ROAST_BLUNTNESS} ` +
    `${JSON_REPLY} Reply with ${HINT_ROAST_REPLY_EXAMPLE}, or with ` +
    `${HINT_NO_POINT_REPLY_EXAMPLE} if the transcript proves no point.\n\nThe hint:\n\n` +
    hints.join('\n\n')
  )
}
