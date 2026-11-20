import type { BuiltinToolName, McpToolName } from 'claude-code'

import type { Matcher } from './matcher'

/** Matches a call to one of the tools listed in `tools`, such as `Bash`. */
export function callsTool(...tools: readonly (BuiltinToolName | McpToolName)[]): Matcher {
  return ({ call }) => tools.some(tool => tool === call.tool)
}
