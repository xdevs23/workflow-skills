import type { Matcher } from './matcher'

/** Matches a call to one of the tools listed in `tools`, such as `Bash`. */
export function callsTool(...tools: readonly string[]): Matcher {
  return ({ call }) => tools.includes(call.tool)
}
