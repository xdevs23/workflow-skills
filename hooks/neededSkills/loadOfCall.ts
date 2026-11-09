import type { Frozen, ToolCallInput } from 'claude-code'

import { SKILL_TOOL, skillName } from '../names'
import type { QualifiedSkill } from '../names'
import { LoadKind } from './loadKind'
import type { Load } from './loadKind'
import { SKILL_RULES } from './skillRules'

const NEEDED_SKILLS = SKILL_RULES.flatMap(rule => rule.skills)
const NEEDED_FILES = SKILL_RULES.flatMap(rule => rule.files)

/**
 * The skill listed by the rule table with the name `name`, as a qualified name or as a bare name,
 * such as `writing-code`.
 */
export function neededSkillNamed(name: string): QualifiedSkill | undefined {
  return NEEDED_SKILLS.find(needed => needed === name || needed === skillName(name))
}

/**
 * The load made by `call` once it ran without an error: a skill listed by the rule table for a
 * call to the Skill tool, and a file listed by the rule table for a Read of that whole file in the
 * plugin folder `pluginRoot`.
 */
export function loadMadeBy(call: Frozen<ToolCallInput>, pluginRoot: string): Load | undefined {
  switch (call.tool) {
    case SKILL_TOOL: {
      // The Skill tool loads a skill also when its name has surrounding spaces or a leading slash.
      const skill = neededSkillNamed(call.skill.trim().replace(/^\//u, ''))

      return skill === undefined ? undefined : { kind: LoadKind.Skill, name: skill }
    }
    case 'Read': {
      // A Read with an offset or a limit leaves part of the rules out of the context.
      const isWhole = call.offset === undefined && call.limit === undefined
      const file = isWhole
        ? NEEDED_FILES.find(needed => call.file_path === `${pluginRoot}/${needed}`)
        : undefined

      return file === undefined ? undefined : { kind: LoadKind.File, name: file }
    }
    default:
      return undefined
  }
}
