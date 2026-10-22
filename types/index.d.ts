// The prompts the user typed or sent since the last successful check. `first` is the number of the
// first of them, counted from the start of the session, so a check removes exactly the prompts it
// sent.
export type RuleCheckerPrompts = {
  first: number
  prompts: string[]
}

// A workflow that runs at the end of a turn.
export type RunningWorkflow = { id: string; name?: string; description: string }

// A background task or a scheduled wakeup started during the current turn, with a kind, such as
// shell, subagent, monitor or wakeup, and a description of what it does.
export type WaitingTask = { kind: string; description: string }

// The ids of the background tasks and of the scheduled wakeups of the session at one moment.
export type BackgroundIds = { tasks: string[]; crons: string[] }

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
      ruleCheckerPrompts: RuleCheckerPrompts
      // The text of TODO.md and the running workflows at the last successful check, as one JSON
      // string, or null before the first one.
      ruleCheckerLastState: string | null
      ruleCheckerIdsAtLastStop: BackgroundIds
      ruleCheckerIdsAtTurnStart: BackgroundIds
      ruleCheckerNote: RuleCheckerNote
      ruleCheckerInstructions: RuleCheckerInstructionFile[]
      // The texts of the instruction files the engine loaded during the conversation.
      ruleCheckerNestedInstructions: string[]
    }
  }
}
