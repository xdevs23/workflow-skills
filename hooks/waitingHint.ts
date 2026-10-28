import type { HintKind } from './hintKind'

/** The hint after a message that waits for an answer from the user. */
export const WAITING_HINT: HintKind = {
  phrases: [
    /\bstill\s+open\b/i,
    /\bstill\s+unanswered\b/i,
    /\bstill\s+pending\b/i,
    /\bstill\s+waiting\b/i,
    /\b(?:waiting|waits)\s+(?:for|on)\s+you(?:r)?\b/i,
    // The span is limited to one sentence, so a thanks for an answer is not joined to a later "is
    // still" of another sentence.
    /\byour\s+answer\s+on\s+[^.!?]+\s+is\s+still\b/i,
    /\b(?:once|until)\s+you\s+answer\b/i,
    /\bonce\s+you(?:['’]ve|\s+have)\s+answered\b/i,
    /\bneeds\s+your\s+(?:answer|approval|go)\b/i,
  ],
  text:
    "If you're waiting for an answer from the user, ensure you have first researched whether the " +
    'question is already answered by rules, instructions or older transcripts. Read around the ' +
    'context you find and do not trust markdown files in the project that paraphrase or take out ' +
    'of context what the user has said.',
}
