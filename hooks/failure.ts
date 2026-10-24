import type { HookFailure } from 'claude-code'

// The line for the transcript when a hook of a part of the plugin fails.
export const failureOf = (part: string, failure: HookFailure): string =>
  `${part} failed: ${failure.message ?? failure.kind}`
