import type { QualifiedSkill } from '../names'
import type { SeenToolCall } from './matcher'
import { SKILL_RULES } from './skillRules'

/** The skills listed by every row of the rule table that matches `seen`, each once. */
export function skillsNeededBy(seen: SeenToolCall): readonly QualifiedSkill[] {
  return [...new Set(SKILL_RULES.filter(rule => rule.when(seen)).flatMap(rule => rule.skills))]
}
