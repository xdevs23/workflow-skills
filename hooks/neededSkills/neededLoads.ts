import { LoadKind } from './loadKind'
import type { Load } from './loadKind'
import type { SeenToolCall } from './matcher'
import { SKILL_RULES } from './skillRules'

/**
 * The skills and files listed by every row of the rule table that matches `seen`, each once. A call
 * that its tool holds read-only, such as `grep -rn "git commit" skills`, matches no row.
 */
export function loadsNeededBy(seen: SeenToolCall): readonly Load[] {
  const rows = seen.call.isReadOnly ? [] : SKILL_RULES.filter(rule => rule.when(seen))
  const skills = new Set(rows.flatMap(rule => rule.skills))
  const files = new Set(rows.flatMap(rule => rule.files))

  return [
    ...[...skills].map((name): Load => ({ kind: LoadKind.Skill, name })),
    ...[...files].map((name): Load => ({ kind: LoadKind.File, name })),
  ]
}
