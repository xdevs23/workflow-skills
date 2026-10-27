/** The name of the plugin in its manifest, which the engine puts into the names of its tools. */
export const PLUGIN = 'workflow-skills'

export const ASK = 'ask_question'
export const LIST = 'list_questions'
export const WITHDRAW = 'withdraw_question'

/** The name the engine lists a tool of this plugin under. */
function toolName<Name extends string>(name: Name): `mcp__${typeof PLUGIN}__${Name}` {
  return `mcp__${PLUGIN}__${name}`
}

export const ASK_TOOL = toolName(ASK)
export const LIST_TOOL = toolName(LIST)
export const WITHDRAW_TOOL = toolName(WITHDRAW)

/** The built-in tool that loads a skill into the context of its caller. */
export const SKILL_TOOL = 'Skill'

/** The qualified name for the skill to load before a question is put to the user. */
export const QUESTION_SKILL = `${PLUGIN}:question`

export const ANSWER_COMMAND = 'answer'

/** The id of the pane that lists the open questions. */
export const PANE = 'questions'
