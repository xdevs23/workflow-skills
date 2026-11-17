const ROAST_PROMPT =
  'Review the work of this conversation so far and roast it. The user reads your reply and may ' +
  'send it back to this conversation as their own message, so write it to the assistant as ' +
  '"you". Find one or more points where the assistant disregarded the rules or the facts in its ' +
  'context: an instruction or a decision of the user, a rule of an instruction file or a loaded ' +
  'skill, or a fact that a tool result or the user stated. For each point, quote the rule or the ' +
  'fact, and say what the assistant did instead and what that cost. Name only points the ' +
  'transcript proves. If the transcript proves no point, write one sentence saying so. Be blunt: ' +
  'no praise, no softening. You have no tools for this reply, so answer straight away with the ' +
  'roast alone, with nothing before or after it.'

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
