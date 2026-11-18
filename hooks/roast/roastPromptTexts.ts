/** The opening of the prompts for the roast and the idle roast. */
const ROAST_OPENING =
  'Review the work of this conversation so far and roast it. The user may send your reply to ' +
  'this conversation as their own message, so write it to the assistant as "you".'

const ROAST_POINT_PROOF =
  'For each point, quote the rule or the fact, and say what the assistant did instead and what ' +
  'that cost. Name only points the transcript proves.'

const ROAST_TONE =
  'Be blunt: no praise, no softening. You have no tools for this reply, so answer straight away ' +
  'with the roast alone, with nothing before or after it.'

const ROAST_PROMPT =
  `${ROAST_OPENING} Find one or more points where the assistant disregarded the rules or the ` +
  'facts in its context: an instruction or a decision of the user, a rule of an instruction file ' +
  'or a loaded skill, or a fact that a tool result or the user stated. ' +
  `${ROAST_POINT_PROOF} If the transcript proves no point, write one sentence saying so. ` +
  ROAST_TONE

/** The whole reply of a fork asked for the idle roast that finds no point blocking the work. */
const NO_BLOCKING_POINT = 'NO BLOCKING POINT'

/** The message that asks a fork made from the idle main conversation for the idle roast. */
export const IDLE_ROAST_PROMPT =
  `This conversation has been idle since the last reply of the assistant. ${ROAST_OPENING} ` +
  'Name only points that hold up the work, such as waiting for something the assistant could do ' +
  'itself, asking permission for work the user already ordered, reporting something false as ' +
  'done, or leaving a task half finished. Leave out minor points, such as a skill that was not ' +
  `loaded again. ${ROAST_POINT_PROOF} If no point blocks the work, reply with ` +
  `${NO_BLOCKING_POINT} alone. ${ROAST_TONE}`

/**
 * Whether `reply`, the reply of a fork to IDLE_ROAST_PROMPT, says that no point blocks the work.
 * The fork may write NO_BLOCKING_POINT in any case, with punctuation or quotes, or beside a
 * sentence.
 */
export function isNoBlockingPointReply(reply: string): boolean {
  return reply.toUpperCase().includes(NO_BLOCKING_POINT)
}

/** Where the note of a roast goes to the model. */
export enum RoastNotePlace {
  /** With a tool result, for a roast that the user sent while the turn ran. */
  ToolResult = 'tool result',
  /** Beside a prompt typed by the user, for a roast that the user sent before that prompt. */
  Prompt = 'prompt',
}

const ROAST_SENT_AT: Record<RoastNotePlace, string> = {
  [RoastNotePlace.ToolResult]: 'They sent it while you worked.',
  [RoastNotePlace.Prompt]: 'They sent it before this message.',
}

/**
 * The note at `place` that sends the model `message`: a roast that the user sent, with the comment
 * that the user typed before it.
 */
export function describeRoastNote(place: RoastNotePlace, message: string): string {
  return (
    'The user sent you the following roast about your work as their own message. ' +
    `${ROAST_SENT_AT[place]} Read it before you go on:\n\n${message}`
  )
}

/** The message that sends the model `roast`, written by the idle roast, as one of the user. */
export function describeIdleRoastMessage(roast: string): string {
  return (
    'The user switched on the idle roast, which wrote the following roast about your work while ' +
    'this conversation was idle. The user sends it to you as their own message. Read it before ' +
    `you go on:\n\n${roast}`
  )
}

/**
 * The message that asks a fork made from the main conversation for the roast, with `finding`, the
 * point typed by the user after the command, unless it is empty.
 */
export function writeRoastPrompt(finding: string): string {
  if (finding === '') {
    return ROAST_PROMPT
  }

  return (
    `${ROAST_PROMPT}\n\nThe user found the following point. Include it as a point of the roast, ` +
    'in the same voice, with the rule or the fact from the transcript that it concerns. If the ' +
    `transcript does not show it, say so in place of that point:\n\n${finding}`
  )
}
