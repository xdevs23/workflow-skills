import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { entriesOf, TodoState } from './todo-file.ts'
import { ENTRY_LINE_LIMIT, longEntries } from './todo-reminder.ts'

const RULES = 'the rules of the todo record'
const SKILL_FILE = '/skills/todo-md/SKILL.md'
const TODO = '/project/TODO.md'
const SOURCES = ['startup', 'resume', 'clear', 'compact', 'fork'] as const

const OPEN = [
  '### #31 - Profile avatars - IN PROGRESS',
  '#### #31.1 - Resize a replaced avatar - IN PROGRESS',
  '### #210 - GH #73 - Reaction emoji - QUEUED',
  '### #212 - Dark mode - TODO',
]

const WITH_OPEN_WORK = [
  '# TODO',
  '## Current queue',
  OPEN[0],
  'Where it stands.',
  OPEN[1],
  '#### #31.2 - Crop the avatar - BUILT',
  '### #142 - Read receipts - RECORDED',
  OPEN[2],
  '### #211 - Group calls - NEEDS DECISION',
  OPEN[3],
  '### #213 - Without a state marker',
].join('\n')

const WITHOUT_OPEN_WORK = '### #142 - Read receipts - RECORDED\nCaptured.\n'

// A heading and the lines of text given, each followed by a blank line.
const section = (heading: string, lines: number) =>
  [heading, ...Array.from({ length: lines }, (_, index) => `Line ${index + 1}.\n`)].join('\n')

// The engine beneath the plugin: a project with the files given, a plugin whose todo-md skill has
// the rules above, and a transcript that records every log line.
const world = (on: On, files: Record<string, string>) => {
  const logged: string[] = []
  on('session.root', () => ({ value: '/project' }))
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('fs.list', () => ({
    value: [{ name: 'SKILL.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
  }))
  on('fs.read', ($, e) => {
    const text = e.path.endsWith(SKILL_FILE) ? RULES : files[e.path]
    if (text === undefined) throw new Error(`ENOENT: no such file or directory, ${e.path}`)
    return { value: text }
  })
  on('classic.SessionStart', () => ({}))
  on('classic.PostToolUse', () => ({}))
  on('ui.log', ($, e) => {
    logged.push(e.text)
    return { value: undefined }
  })

  return { logged }
}

// The texts of context the agent gets at the start of a context from each source.
const startContexts = async ($: Engine) =>
  Promise.all(
    SOURCES.map(async source => {
      const started = await $.classic.SessionStart({
        source,
        transcript_path: '/sessions/s1.jsonl',
      })
      return started.additionalContext ?? []
    }),
  )

// For each text of context, whether it has the rules, and the headings in it.
const partsOf = (contexts: readonly string[]) =>
  contexts.map(context => ({
    hasRules: context.includes(RULES),
    headings: context.split('\n').filter(line => line.startsWith('#')),
  }))

const change = ($: Engine, tool: 'Edit' | 'Write', path: string) =>
  $.classic.PostToolUse({
    tool_name: tool,
    tool_input:
      tool === 'Edit'
        ? { file_path: path, old_string: 'a', new_string: 'b' }
        : { file_path: path, content: 'c' },
    tool_response: {},
    tool_use_id: 'u1',
  })

describe('the context at the start', () => {
  test('has the rules of the skill and the headings of the work in progress and queued', async ($, on) => {
    world(on, { [TODO]: WITH_OPEN_WORK })

    for (const contexts of await startContexts($)) {
      expect(partsOf(contexts)).toEqual([{ hasRules: true, headings: OPEN }])
    }
  })

  test('has the rules of the skill alone without TODO.md or without open work', async ($, on) => {
    const files: Record<string, string> = {}
    world(on, files)

    const withoutTodo = await startContexts($)
    files[TODO] = WITHOUT_OPEN_WORK
    const withoutOpenWork = await startContexts($)

    for (const contexts of [...withoutTodo, ...withoutOpenWork]) {
      expect(partsOf(contexts)).toEqual([{ hasRules: true, headings: [] }])
    }
  })
})

describe('the entries of TODO.md', () => {
  test('have the state after the last separator of the heading, if the skill defines it', () => {
    expect(entriesOf(WITH_OPEN_WORK).map(entry => [entry.id, entry.state])).toEqual([
      ['#31', TodoState.InProgress],
      ['#31.1', TodoState.InProgress],
      ['#31.2', TodoState.Built],
      ['#142', TodoState.Recorded],
      ['#210', TodoState.Queued],
      ['#211', TodoState.NeedsDecision],
      ['#212', TodoState.Todo],
      ['#213', null],
    ])
  })

  test('count the lines of text up to the next heading, blank lines left out', () => {
    const todo = [
      section('### #4 - Parent - IN PROGRESS', 3),
      section('#### #4.1 - Child - QUEUED', 2),
      section('#### Notes', 5),
      section('## Deploy state', 7),
    ].join('\r\n')

    expect(entriesOf(todo).map(entry => [entry.id, entry.lines])).toEqual([
      ['#4', 3],
      ['#4.1', 2],
    ])
  })

  test('include the lines of a fenced code block, whose headings are no entries', () => {
    const todo = ['### #7 - Quotes - QUEUED', '```md', '### #8 - Quoted - IN PROGRESS', '```'].join(
      '\n',
    )

    expect(entriesOf(todo).map(entry => [entry.id, entry.lines])).toEqual([['#7', 3]])
  })

  test('above the limit are the long ones', () => {
    const todo = [
      section('### #5 - Over - IN PROGRESS', ENTRY_LINE_LIMIT + 1),
      section('### #6 - At - QUEUED', ENTRY_LINE_LIMIT),
    ].join('\n')

    expect(longEntries(todo).map(entry => entry.id)).toEqual(['#5'])
  })
})

describe('a change', () => {
  const WITH_LONG_ENTRY = section('### #5 - Over - IN PROGRESS', ENTRY_LINE_LIMIT + 1)

  test('of TODO.md reports the long entries to the agent and in the transcript', async ($, on) => {
    const { logged } = world(on, { [TODO]: WITH_LONG_ENTRY })

    for (const tool of ['Edit', 'Write'] as const) {
      const changed = await change($, tool, TODO)
      expect(changed.additionalContext).toEqual([logged.at(-1)])
    }
    expect(logged).toHaveLength(2)
  })

  test('of another file or of TODO.md without long entries reports nothing', async ($, on) => {
    const files: Record<string, string> = { [TODO]: WITH_LONG_ENTRY }
    const { logged } = world(on, files)

    const other = await change($, 'Edit', '/project/src/parser.ts')
    files[TODO] = WITHOUT_OPEN_WORK
    const short = await change($, 'Edit', TODO)

    expect([other.additionalContext, short.additionalContext]).toEqual([undefined, undefined])
    expect(logged).toEqual([])
  })
})
