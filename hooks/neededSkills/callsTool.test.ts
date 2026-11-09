import { describe, expect } from 'claude-code/testing'

import type { ToolArguments } from '../inputs'
import { test } from '../testDeclaration'
import { callsTool } from './callsTool'

const ASK_TOOL = 'mcp__workflow-skills__ask_question'

describe('the tool name matcher', () => {
  test('matches a call to a named tool and no other', () => {
    const matcher = callsTool('Bash', ASK_TOOL)
    const matches = (tool: string, input: ToolArguments) =>
      matcher({ call: { tool, input, isReadOnly: false }, projectRoot: '/home/dev' })

    expect(matches('Bash', { command: 'ls' })).toBe(true)
    expect(matches(ASK_TOOL, {})).toBe(true)
    expect(matches('Read', { file_path: 'notes.md' })).toBe(false)
  })
})
