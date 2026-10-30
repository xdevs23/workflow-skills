import type { HintKind } from './hintKind'

/** The hint after a message that reports work as blocked or idle. */
export const BLOCKED_HINT: HintKind = {
  phrases: [
    /\bstill\s+blocked\b/i,
    /\b(?:is|are|stays|remains)\s+blocked\s+on\b/i,
    /\b(?:can['’]t|cannot|can\s+not)\s+continue\b/i,
    /\bneeds\s+you\b/i,
    /\bnothing\s+to\s+do\b(?!\s+with\b)/i,
    /\bno\s+workflows\s+(?:are\s+)?running\b/i,
    /\bnothing\s+is\s+running\b(?!\s+on\b)/i,
    /\bnothing\s+has\s+changed\b(?!\s+in\b)/i,
    /(?:^|[.!?:])\s*(?:still\s+)?no\s+change\b(?!\s+(?:to|in)\b)/im,
    /\bnothing\s+new\s+came\s+in\b/i,
    /\beverything\s+left\s+is\s+blocked\b/i,
    /\beverything\s+left\s+waits\s+on\s+you(?:r)?\b/i,
    /\bwaiting\s+(?:for|on)\s+you(?:r)?\b/i,
    /\bwhat(?:['’]s|\s+is)\s+left\s+for\s+you\b(?![\s:,—–-]*(?:nothing|none)\b)/i,
  ],
  text:
    'Check if any independent work can be picked up, like IN PROGRESS or QUEUED todos. If ' +
    'nothing is startable, try splitting up the blocked units into smaller sub-units and start ' +
    "the ones that don't depend on the blocker.",
}
