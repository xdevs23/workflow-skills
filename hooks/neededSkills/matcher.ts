import type { ToolArguments } from '../inputs'

// A matcher kind is a module of its own whose function reads one kind of target out of a tool
// call, such as the path of the file it writes, and builds a Matcher over the patterns of a row.
// The rule table calls that function, so a new kind plugs in by its file alone and the core, which
// receives only matchers, contains no list of kinds.

/** A tool call as the hooks read it, at `tool.call` or at `tool.check`. */
export type ToolCall = {
  /** The tool, as the model names it, such as `Bash`. */
  tool: string
  /** The arguments of the call, as the model wrote them, such as `command` for Bash. */
  input: ToolArguments
  /** The agent whose loop made the call. Absent in the main conversation. */
  agentId?: string | undefined
  /** Whether the tool holds the call read-only by its own check, which `tool.check` reports. */
  isReadOnly: boolean
}

/** A tool call as passed to a matcher, with the root of the project the session works in. */
export type SeenToolCall = { call: ToolCall; projectRoot: string }

/** Whether a tool call matches the patterns of a row in the rule table. */
export type Matcher = (seen: SeenToolCall) => boolean
