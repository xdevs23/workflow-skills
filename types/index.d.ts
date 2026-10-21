// One step of the work of the main agent, in the order it happened, as the rule checker reads it:
// words the user typed, text the agent wrote, a tool call, and the failure of a call.
export type RuleCheckerEntry =
  | { kind: 'user'; text: string }
  | { kind: 'say'; text: string }
  | { kind: 'call'; tool: string; input: unknown }
  | { kind: 'failure'; tool: string; input: unknown; text: string }

// A call whose result has not arrived yet: its tool, and its arguments without the work they
// contain, which the failure of the call repeats.
export type RuleCheckerCall = { tool: string; input: unknown }

// The work collected since the last successful check. `first` is the number of the first entry,
// counted from the start of the session, so a check removes exactly the entries it sent.
export type RuleCheckerWork = {
  first: number
  entries: RuleCheckerEntry[]
  calls: Record<string, RuleCheckerCall>
}

// The fields of a finding, in the order the instructions of the checker list them.
export type RuleCheckerFindingFields = readonly ['rule', 'source', 'place', 'wrong', 'instead']
export type RuleCheckerFinding = Record<RuleCheckerFindingFields[number], string>

// What the note above the prompt box shows for the current prompt: the findings sent to the agent,
// the checks that failed, and the error a check is waiting out before it tries again.
export type RuleCheckerNote = {
  findings: RuleCheckerFinding[]
  failures: string[]
  retrying: string | null
}

// An instruction file the main agent reads, as the engine loaded it for the conversation.
export type RuleCheckerInstructionFile = { kind: string; path: string; content: string }

declare module 'claude-code' {
  interface PluginState {
    'workflow-skills': {
      ruleCheckerWork: RuleCheckerWork
      ruleCheckerNote: RuleCheckerNote
      ruleCheckerInstructions: RuleCheckerInstructionFile[]
      // The texts of the instruction files the engine loaded during the conversation.
      ruleCheckerNestedInstructions: string[]
      // The place and the wrong of every finding sent to the agent in this session.
      ruleCheckerSent: string[]
    }
  }
}
