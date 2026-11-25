import { skillName } from '../names'
import type { QualifiedSkill } from '../names'
import { SKILL_RULES } from './skillRules'

const NEEDED_SKILLS = SKILL_RULES.flatMap(rule => rule.skills)

/**
 * The skill listed by the rule table with the name `name`, as a qualified name or as a bare name,
 * such as `writing-code`. The Skill tool loads a skill also when its name has surrounding spaces or
 * a leading slash.
 */
export function neededSkillNamed(name: string): QualifiedSkill | undefined {
  const bare = name.trim().replace(/^\//u, '')

  return NEEDED_SKILLS.find(needed => needed === bare || needed === skillName(bare))
}
