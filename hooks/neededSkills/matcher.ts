import type { BuiltinToolInputs, BuiltinToolName } from 'claude-code'

import type { ToolArguments } from '../inputs'

// A matcher kind is a module of its own whose function reads one kind of target out of a tool
// call, such as the path of the file it writes, and builds a Matcher over the patterns of a row.
// The rule table calls that function, so a new kind plugs in by its file alone and the core, which
// receives only matchers, contains no list of kinds.

/** A tool call as the hooks read it, at `tool.call` or at `tool.check`. */
export type ToolCall = {
  /** The tool, as the model names it, such as `Bash`. */
  tool: string
  /**
   * The arguments of the call, as the model wrote them, such as `command` for Bash. Undefined for
   * a call to a tool of this plugin, whose rows match by tool name only, and where the engine
   * reports input that is not a record.
   */
  input: ToolArguments | undefined
  /** The agent whose loop made the call. Absent in the main conversation. */
  agentId?: string | undefined
  /** Whether the tool holds the call read-only by its own check, which `tool.check` reports. */
  isReadOnly: boolean
}

/** A tool call as passed to a matcher, with the root of the project the session works in. */
export type SeenToolCall = { call: ToolCall; projectRoot: string }

/** Whether a tool call matches the patterns of a row in the rule table. */
export type Matcher = (seen: SeenToolCall) => boolean

/** The arguments that the engine declares as text for every tool of `Tool`. */
type TextArgumentOf<Tool extends BuiltinToolName> = {
  [Argument in keyof BuiltinToolInputs[Tool] & string]-?: BuiltinToolInputs[Tool][Argument] extends
    | string
    | undefined
    ? Argument
    : never
}[keyof BuiltinToolInputs[Tool] & string]

/**
 * The text that `call` passes as `argument`, for a call to one of `tools`, so a renamed argument or
 * one no longer declared as text fails the type check.
 */
export function readTextArgument<Tool extends BuiltinToolName>(
  { tool, input }: ToolCall,
  tools: readonly Tool[],
  argument: TextArgumentOf<Tool>,
): string | undefined {
  const value = input?.[argument]

  return tools.some(name => name === tool) && typeof value === 'string' ? value : undefined
}
