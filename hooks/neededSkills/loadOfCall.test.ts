import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import { LoadKind } from './loadKind'
import { loadMadeBy } from './loadOfCall'

const PLUGIN_ROOT = '/home/dev/.claude/plugins/cache/workflow-skills/1.0.0'
const KOTLIN = 'skills/writing-code/languages/kotlin.md'

function read(path: string) {
  return { tool: 'Read', tool_use_id: 'call-1', file_path: path } as const
}

describe('the load made by a tool call', () => {
  test('a Skill call loads the skill it names', () => {
    const skill = ' /workflow-skills:writing-code'
    const call = { tool: 'Skill', tool_use_id: 'call-1', skill } as const

    expect(loadMadeBy(call, PLUGIN_ROOT)).toEqual({
      kind: LoadKind.Skill,
      name: 'workflow-skills:writing-code',
    })
  })

  test('a Skill call with the bare name of a skill of the plugin loads that skill', () => {
    const call = { tool: 'Skill', tool_use_id: 'call-1', skill: 'writing-code' } as const

    expect(loadMadeBy(call, PLUGIN_ROOT)).toEqual({
      kind: LoadKind.Skill,
      name: 'workflow-skills:writing-code',
    })
  })

  test('a Read of a file named by the rule table in the plugin folder loads that file', () => {
    expect(loadMadeBy(read(`${PLUGIN_ROOT}/${KOTLIN}`), PLUGIN_ROOT)).toEqual({
      kind: LoadKind.File,
      name: KOTLIN,
    })
  })

  test('a Read of another file or of the same path outside the plugin loads nothing', () => {
    for (const path of [`${PLUGIN_ROOT}/README.md`, `/home/dev/shop/${KOTLIN}`, KOTLIN]) {
      expect(loadMadeBy(read(path), PLUGIN_ROOT)).toBeUndefined()
    }
  })

  test('a Read of part of a file loads nothing', () => {
    const path = `${PLUGIN_ROOT}/${KOTLIN}`
    for (const part of [{ offset: 20 }, { limit: 30 }, { offset: 20, limit: 30 }]) {
      expect(loadMadeBy({ ...read(path), ...part }, PLUGIN_ROOT)).toBeUndefined()
    }
  })

  test('another tool loads nothing', () => {
    const command = `cat ${PLUGIN_ROOT}/${KOTLIN}`
    const call = { tool: 'Bash', tool_use_id: 'call-1', command } as const

    expect(loadMadeBy(call, PLUGIN_ROOT)).toBeUndefined()
  })
})
