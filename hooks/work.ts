import { atom, read, update } from 'claude-code'
import type {
  ApiContentBlock,
  EngineInterface,
  PromptSubmitInput,
  SessionAppendInput,
  SessionAppendMessage,
} from 'claude-code'

import type { RuleCheckerWork } from '../types'

type Row = Pick<SessionAppendInput, 'door'> & { message: SessionAppendMessage }
type Words = Pick<PromptSubmitInput, 'text' | 'origin'>

const work = atom({ plugin: 'workflow-skills', key: 'ruleCheckerWork' } as const, {
  first: 0,
  entries: [],
  calls: {},
})

// The origins of a prompt that the user typed or sent.
const PERSON_ORIGINS: readonly Words['origin']['kind'][] = ['composer', 'bridge', 'sdk']

// The arguments that contain the work itself. The failure of a call repeats the call without them.
const WORK_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Edit: ['old_string', 'new_string'],
  Write: ['content'],
  Agent: ['prompt'],
  Workflow: ['script'],
}

// The tools that only look: a call shows what it looked at and nothing else. Grep and Glob are not
// tools of every build, so the table is keyed by the name of the tool.
const LOOKUP_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Read: ['file_path'],
  Grep: ['pattern', 'path'],
  Glob: ['pattern', 'path'],
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const fieldsWhere = (
  input: Record<string, unknown>,
  keep: (name: string) => boolean,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(input).filter(([name]) => keep(name)))

const linesOf = (text: string): string[] => (text === '' ? [] : text.split('\n'))

const diffOf = (before: string, after: string): string =>
  [...linesOf(before).map(line => `-${line}`), ...linesOf(after).map(line => `+${line}`)].join('\n')

// The arguments of a call as the work shows them: an edit as a diff, and a lookup by what it
// looked at.
const shownInput = (tool: string, input: unknown): unknown => {
  if (!isRecord(input)) return input
  const lookup = LOOKUP_FIELDS[tool]
  if (lookup !== undefined) return fieldsWhere(input, name => lookup.includes(name))
  const before = input.old_string
  const after = input.new_string
  if (tool !== 'Edit' || typeof before !== 'string' || typeof after !== 'string') return input
  const rest = fieldsWhere(input, name => name !== 'old_string' && name !== 'new_string')

  return { ...rest, diff: diffOf(before, after) }
}

const headInput = (tool: string, input: unknown): unknown => {
  const fields = WORK_FIELDS[tool]
  if (!isRecord(input) || fields === undefined) return shownInput(tool, input)

  return fieldsWhere(input, name => !fields.includes(name))
}

const textOf = (block: ApiContentBlock): string | undefined =>
  block.type === 'text' && typeof block.text === 'string' ? block.text : undefined

const resultText = (content: unknown): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .filter(isRecord)
          .map(block => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
          .join('\n')
      : ''

// The work after a prompt was submitted: its words when the user typed or sent it.
export const withWords = (before: RuleCheckerWork, { text, origin }: Words): RuleCheckerWork =>
  PERSON_ORIGINS.includes(origin.kind) && text.trim() !== ''
    ? { ...before, entries: [...before.entries, { kind: 'user', text }] }
    : before

// The work after one more row of the main conversation: the text and the calls of a response, and
// a result only where the call it answers failed. Thinking and every other part of a row are left
// out.
export const withRow = (before: RuleCheckerWork, row: Row): RuleCheckerWork => {
  const entries = [...before.entries]
  const calls = { ...before.calls }
  const blocks = row.message.content
  switch (row.door) {
    case 'response':
      for (const block of blocks) {
        const text = textOf(block)
        if (text !== undefined && text.trim() !== '') entries.push({ kind: 'say', text })
        if (
          block.type === 'tool_use' &&
          typeof block.id === 'string' &&
          typeof block.name === 'string'
        ) {
          entries.push({
            kind: 'call',
            tool: block.name,
            input: shownInput(block.name, block.input),
          })
          calls[block.id] = { tool: block.name, input: headInput(block.name, block.input) }
        }
      }
      break
    case 'tool-result':
      for (const block of blocks) {
        const id = block.tool_use_id
        const call = typeof id === 'string' ? calls[id] : undefined
        if (block.type !== 'tool_result' || typeof id !== 'string' || call === undefined) continue
        delete calls[id]
        if (block.is_error === true) {
          entries.push({ kind: 'failure', ...call, text: resultText(block.content) })
        }
      }
      break
  }

  return { first: before.first, entries, calls }
}

// The work after a check sent every entry before `upTo` and the reply decoded. Entries collected
// meanwhile stay, and a check that finishes after a later one removes nothing more.
export const withoutSent = (before: RuleCheckerWork, upTo: number): RuleCheckerWork => {
  const first = Math.max(before.first, upTo)

  return { ...before, first, entries: before.entries.slice(first - before.first) }
}

export function collect($: EngineInterface, row: Row) {
  return update($, work, before => withRow(before, row))
}

export function collectWords($: EngineInterface, words: Words) {
  return update($, work, before => withWords(before, words))
}

// The entries collected since the last successful check, and the number past the last of them.
export async function takeWork($: EngineInterface) {
  const { first, entries } = await read($, work)

  return { entries, upTo: first + entries.length }
}

export function removeSent($: EngineInterface, upTo: number) {
  return update($, work, before => withoutSent(before, upTo))
}
