/** The phrases by which a message shows that it waits for an answer from the user. */
const WAITING_PHRASES: readonly RegExp[] = [
  /\bstill\s+open\b/i,
  /\bstill\s+unanswered\b/i,
  /\bstill\s+pending\b/i,
  /\bstill\s+waiting\b/i,
  /\b(?:waiting|waits)\s+(?:for|on)\s+you(?:r)?\b/i,
  // The span stays inside one sentence, so a thanks for an answer is not joined to a later "is
  // still" of another sentence.
  /\byour\s+answer\s+on\s+[^.!?]+\s+is\s+still\b/i,
  /\b(?:once|until)\s+you\s+answer\b/i,
  /\bonce\s+you(?:['’]ve|\s+have)\s+answered\b/i,
  /\bneeds\s+your\s+(?:answer|approval|go)\b/i,
]

export function isWaitingForAnswer(message: string): boolean {
  return WAITING_PHRASES.some(phrase => phrase.test(message))
}
