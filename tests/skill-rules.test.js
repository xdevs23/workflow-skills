import { expect, test } from 'bun:test'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { PLUGIN } from '../hooks/names.ts'
import { SKILL_RULES } from '../hooks/neededSkills/skillRules.ts'

// The rule table of the hooks module lists skills and files of this repository by name, which no
// type checks, so this test reads each of them from the repository root.
const ROOT = fileURLToPath(new URL('../', import.meta.url))

async function isMissing(path) {
  try {
    await access(`${ROOT}${path}`)

    return false
  } catch (error) {
    if (error.code === 'ENOENT') {
      return true
    }
    throw error
  }
}

test('every skill and file listed by the rule table exists', async () => {
  const skills = SKILL_RULES.flatMap(rule => rule.skills)
  const paths = [
    ...skills.map(skill => `skills/${skill.slice(`${PLUGIN}:`.length)}/SKILL.md`),
    ...SKILL_RULES.flatMap(rule => rule.files),
  ]
  const missing = []
  for (const path of new Set(paths)) {
    if (await isMissing(path)) {
      missing.push(path)
    }
  }

  expect(missing).toEqual([])
})
