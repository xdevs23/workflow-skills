import { describe, expect, test } from 'claude-code/testing'
import type { ApiContentBlock, SessionAppendInput } from 'claude-code'

import type { RuleCheckerWork } from '../types'
import { withoutSent, withRow, withWords } from './work.ts'

const EMPTY: RuleCheckerWork = { first: 0, entries: [], calls: {} }
type Row = Parameters<typeof withRow>[1]
type Words = Parameters<typeof withWords>[1]

const row = (door: SessionAppendInput['door'], content: ApiContentBlock[]): Row => ({
  door,
  message: { type: 'user', content },
})
const response = (...content: ApiContentBlock[]) => row('response', content)
const use = (id: string, name: string, input: unknown): ApiContentBlock => ({
  type: 'tool_use',
  id,
  name,
  input,
})
const result = (id: string, content: unknown, isError: boolean) =>
  row('tool-result', [{ type: 'tool_result', tool_use_id: id, content, is_error: isError }])

const collected = (...rows: Row[]) => rows.reduce(withRow, EMPTY)

describe('the work', () => {
  test('lists the words of the user and no other prompt', () => {
    const prompts: Words[] = [
      { text: 'fix the parser', origin: { kind: 'composer' } },
      { text: 'from the phone', origin: { kind: 'bridge' } },
      { text: 'a notification', origin: { kind: 'task-notification' } },
      { text: ' ', origin: { kind: 'composer' } },
    ]
    const work = prompts.reduce(withWords, EMPTY)

    expect(work.entries).toEqual([
      { kind: 'user', text: 'fix the parser' },
      { kind: 'user', text: 'from the phone' },
    ])
  })

  test('lists text and calls in order, with lookups by what they looked at', () => {
    const work = collected(
      row('attachment', [{ type: 'text', text: 'a reminder' }]),
      response(
        { type: 'thinking', thinking: 'hm' },
        { type: 'text', text: 'Let me look.' },
        use('r1', 'Read', { file_path: '/p/a.ts', offset: 10 }),
      ),
      result('r1', 'the whole file', false),
      response(use('e1', 'Edit', { file_path: '/p/a.ts', old_string: 'a\nb', new_string: 'c' })),
      response(use('a1', 'Agent', { description: 'review', prompt: 'Review it.' })),
    )

    expect(work.entries).toEqual([
      { kind: 'say', text: 'Let me look.' },
      { kind: 'call', tool: 'Read', input: { file_path: '/p/a.ts' } },
      { kind: 'call', tool: 'Edit', input: { file_path: '/p/a.ts', diff: '-a\n-b\n+c' } },
      { kind: 'call', tool: 'Agent', input: { description: 'review', prompt: 'Review it.' } },
    ])
  })

  test('adds a failure with the arguments of its call but not the work they contain', () => {
    const work = collected(
      response(use('w1', 'Write', { file_path: '/p/b.ts', content: 'body' })),
      result('w1', [{ type: 'text', text: 'denied' }], true),
    )

    expect(work.entries.at(-1)).toEqual({
      kind: 'failure',
      tool: 'Write',
      input: { file_path: '/p/b.ts' },
      text: 'denied',
    })
    expect(work.calls).toEqual({})
  })

  test('shows arguments it cannot read as they came', () => {
    const work = collected(response(use('e1', 'Edit', { file_path: '/p/a.ts', old_string: 3 })))

    expect(work.entries).toEqual([
      { kind: 'call', tool: 'Edit', input: { file_path: '/p/a.ts', old_string: 3 } },
    ])
  })

  test('removes only what a check sent, once', () => {
    const work = collected(
      response({ type: 'text', text: 'one' }),
      response({ type: 'text', text: 'two' }),
    )
    const sentOne = withoutSent(work, 1)
    const more = withRow(sentOne, response({ type: 'text', text: 'three' }))

    expect(withoutSent(more, 1)).toEqual(more)
    expect(withoutSent(more, 2)).toEqual({
      first: 2,
      entries: [{ kind: 'say', text: 'three' }],
      calls: {},
    })
  })
})
