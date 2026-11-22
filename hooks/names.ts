import { regExpLiteralOf } from './regExpLiteral'

/** The name of the plugin in its manifest, which the engine puts into the names of its tools. */
export const PLUGIN = 'workflow-skills'

export const SEND = 'send_request'
export const LIST = 'list_requests'
export const WITHDRAW = 'withdraw_request'

/** The start of the name of every tool of this plugin, as the engine lists it. */
const TOOL_PREFIX = `mcp__${PLUGIN}__` as const

/** The name of any tool of this plugin, as the engine lists it. */
export type PluginToolName = `${typeof TOOL_PREFIX}${string}`

/** The name the engine lists a tool of this plugin under. */
export function toolName<Name extends string>(name: Name): `${typeof TOOL_PREFIX}${Name}` {
  return `${TOOL_PREFIX}${name}`
}

/** The matcher of the calls to the tools of this plugin, whose names share the prefix. */
export const PLUGIN_TOOLS = { tool: new RegExp(`^${regExpLiteralOf(TOOL_PREFIX)}`, 'u') }

/** Whether the engine lists the tool `name` as a tool of this plugin. */
export function isToolOfPlugin(name: string): name is PluginToolName {
  return PLUGIN_TOOLS.tool.test(name)
}

/** The qualified name of a skill of this plugin, such as `workflow-skills:writing-code`. */
export type QualifiedSkill = `${typeof PLUGIN}:${string}`

/** The qualified name of the skill `name` of this plugin. */
export function skillName<Name extends string>(name: Name): `${typeof PLUGIN}:${Name}` {
  return `${PLUGIN}:${name}`
}

export const SEND_TOOL = toolName(SEND)
export const LIST_TOOL = toolName(LIST)
export const WITHDRAW_TOOL = toolName(WITHDRAW)

/** The built-in tool that loads a skill into the context of its caller. */
export const SKILL_TOOL = 'Skill'

/** The qualified name of the agent that judges the open goals against the project. */
export const GOAL_CHECKER_AGENT = `${PLUGIN}:goal-checker`

/** The qualified name for the skill that draws drafts and opens them for the user. */
export const VISUAL_DECISIONS_SKILL = skillName('visual-decisions')

export const REPLY_COMMAND = 'reply'

/** The id of the pane that lists the open requests. */
export const REQUESTS_PANE = 'requests'
