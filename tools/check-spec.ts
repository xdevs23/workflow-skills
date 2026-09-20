import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'

const minimumBun = '1.2.21'
const kinds = ['requirement', 'criterion', 'rejected', 'boundary'] as const
const sources = ['transcript', 'rule', 'observation', 'derivation'] as const
const sourceFields = {
  transcript: ['evidence', 'user_words'], rule: ['rule', 'quote'],
  observation: ['observation'], derivation: ['parents'],
}
type Mapping = Record<string, unknown>
const mapping = (value: unknown): value is Mapping =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim()
const lineNumber = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
const lines = (value: string) => value.split(/\r?\n/)
const nonBlankLines = (value: string) => lines(value).filter(line => line.trim()).length
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
// The text of a transcript record: a string body, or its text blocks joined, with reminders removed.
const textOf = (record: Mapping) => {
  const content = mapping(record.message) ? record.message.content : undefined
  let message: string
  if (typeof content === 'string') message = content
  else if (Array.isArray(content)) {
    message = content.filter(block => mapping(block) && block.type === 'text')
      .map(block => typeof block.text === 'string' ? block.text : '').join('')
  } else throw new Error('message.content must be a string or block array')
  return message.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
}
// A user record that carries a text block and is not a tool result opens a turn: the assistant
// records after it and before the cited user record are the ones the cited words reply to.
const opensTurn = (record: Mapping) => {
  const content = mapping(record.message) ? record.message.content : undefined
  if (typeof content === 'string') return true
  return Array.isArray(content) && content.some(block => mapping(block) && block.type === 'text') &&
    !content.some(block => mapping(block) && block.type === 'tool_result')
}
const parseRecord = (line: string): Mapping | undefined => {
  try { const record = JSON.parse(line); return mapping(record) ? record : undefined } catch { return undefined }
}

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, render: { type: 'string' },
      'check-render': { type: 'string' }, json: { type: 'boolean' } } })
  if (positionals.length !== 1 || !values.transcripts || (values.render && values['check-render'])) {
    throw new Error('Usage: bun tools/check-spec.ts <spec.yaml> --transcripts <dir> ' +
      '[--render <path> | --check-render <path>] [--json]')
  }
  const specPath = positionals[0]
  const violations: { item: number, message: string }[] = []
  const fail = (item: number, path: string, message: string) => {
    violations.push({ item, message: `${specPath}: ${path}: ${message}` })
  }
  const shape = (value: unknown, fields: string[], item: number, path: string, optional: string[] = []): value is Mapping => {
    if (!mapping(value)) { fail(item, path, 'expected a mapping'); return false }
    for (const key of Object.keys(value)) {
      if (!fields.includes(key) && !optional.includes(key)) fail(item, `${path}.${key}`, 'unknown key')
    }
    for (const key of fields) {
      if (!Object.hasOwn(value, key)) fail(item, `${path}.${key}`, 'missing field')
    }
    return true
  }
  const stringField = (value: Mapping, key: string, item: number, path: string) => {
    if (Object.hasOwn(value, key) && !text(value[key])) {
      fail(item, `${path}.${key}`, 'expected a non-empty string')
    }
    return text(value[key])
  }
  const list = (value: unknown, item: number, path: string): value is unknown[] => {
    if (!Array.isArray(value) || !value.length) {
      fail(item, path, 'expected a non-empty list'); return false
    }
    return true
  }
  const reference = (value: unknown, fields: string[], item: number, path: string): value is Mapping => {
    if (!shape(value, fields, item, path)) return false
    const fileOK = stringField(value, 'file', item, path)
    if (Object.hasOwn(value, 'line') && !lineNumber(value.line)) {
      fail(item, `${path}.line`, 'expected a positive integer')
    }
    return fileOK && lineNumber(value.line)
  }
  let bytes: Buffer | undefined
  let spec: unknown
  let parsed = false
  try {
    bytes = await readFile(specPath)
    spec = Bun.YAML.parse(bytes.toString('utf8'))
    parsed = true
  } catch (error) {
    fail(-1, 'spec', `unreadable or malformed YAML: ${messageOf(error)}`)
  }
  const items: Mapping[] = []
  if (parsed && shape(spec, ['unit', 'summary', 'items'], -1, 'spec')) {
    stringField(spec, 'unit', -1, 'spec')
    stringField(spec, 'summary', -1, 'spec')
    if (list(spec.items, -1, 'items')) {
      for (const [index, value] of spec.items.entries()) {
        const path = mapping(value) && text(value.id) ? value.id : `item ${index + 1}`
        if (!mapping(value)) { fail(index, path, 'expected a mapping'); items.push({}); continue }
        items.push(value)
        const extra = typeof value.source === 'string' && Object.hasOwn(sourceFields, value.source)
          ? sourceFields[value.source as keyof typeof sourceFields] : []
        shape(value, ['id', 'kind', 'content', 'source', ...(value.kind === 'rejected' ? ['reason'] : []),
          ...extra], index, path, value.source === 'transcript' ? ['answers'] : [])
        if (stringField(value, 'id', index, path) && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id as string)) {
          fail(index, `${path}.id`, 'expected a kebab-case id')
        }
        if (!kinds.includes(value.kind as typeof kinds[number])) fail(index, `${path}.kind`, 'unknown kind')
        if (!sources.includes(value.source as typeof sources[number])) fail(index, `${path}.source`, 'unknown source')
        stringField(value, 'content', index, path)
        if (value.kind === 'rejected') stringField(value, 'reason', index, path)
        if (value.source === 'transcript') {
          const wordsOK = stringField(value, 'user_words', index, path)
          const answersOK = Object.hasOwn(value, 'answers') && stringField(value, 'answers', index, path)
          let matched = false, answered = false
          if (list(value.evidence, index, `${path}.evidence`)) {
            for (const [entry, evidence] of value.evidence.entries()) {
              const at = `${path}.evidence entry ${entry + 1}`
              const refOK = reference(evidence, ['file', 'line', 'uuid'], index, at)
              const uuidOK = mapping(evidence) && stringField(evidence, 'uuid', index, at)
              if (!refOK || !uuidOK) continue
              try {
                const input = createReadStream(resolve(values.transcripts!, evidence.file as string), { encoding: 'utf8' })
                const reader = createInterface({ input, crlfDelay: Infinity })
                let record: unknown, found = false, current = 0
                // The assistant records since the last user record that opened a turn.
                let replies: Mapping[] = []
                try {
                  for await (const line of reader) {
                    if (++current === evidence.line) { record = JSON.parse(line); found = true; break }
                    if (!answersOK) continue
                    const earlier = parseRecord(line)
                    if (!earlier) continue
                    if (earlier.type === 'assistant') replies.push(earlier)
                    else if (earlier.type === 'user' && opensTurn(earlier)) replies = []
                  }
                } finally { reader.close(); input.destroy() }
                if (!found) throw new Error('line is outside the transcript')
                if (!mapping(record) || record.type !== 'user' || !text(record.uuid) || record.uuid !== evidence.uuid) {
                  throw new Error('expected a user record with the cited uuid')
                }
                if (wordsOK && textOf(record).includes(value.user_words as string)) matched = true
                if (answersOK) {
                  const quote = normalize(value.answers as string)
                  if (replies.some(reply => { try { return normalize(textOf(reply)).includes(quote) } catch { return false } })) answered = true
                }
              } catch (error) { fail(index, at, `transcript reference failed: ${messageOf(error)}`) }
            }
            if (wordsOK && !matched) fail(index, `${path}.user_words`, 'not found in any resolved user message')
            if (answersOK && !answered) fail(index, `${path}.answers`, 'not found in the assistant messages the cited words reply to')
          }
        } else if (value.source === 'rule') {
          const refOK = reference(value.rule, ['file', 'line'], index, `${path}.rule`)
          const quoteOK = stringField(value, 'quote', index, path)
          if (refOK) {
            try {
              const rule = value.rule as Mapping
              const fileLines = lines(await readFile(rule.file as string, 'utf8'))
              if (fileLines.at(-1) === '') fileLines.pop()
              const start = (rule.line as number) - 1
              if (start >= fileLines.length) throw new Error('line is outside the rule file')
              const window: string[] = []
              for (const line of fileLines.slice(start, start + 40)) {
                if (!line.trim()) break
                window.push(line)
              }
              if (quoteOK && !normalize(window.join('\n')).includes(normalize(value.quote as string))) {
                throw new Error('quote does not match the cited rule window')
              }
            } catch (error) { fail(index, `${path}.rule`, `rule reference failed: ${messageOf(error)}`) }
          }
        } else if (value.source === 'observation') {
          if (shape(value.observation, ['command', 'exit', 'output', 'date'], index, `${path}.observation`)) {
            for (const field of ['command', 'output', 'date']) stringField(value.observation, field, index, `${path}.observation`)
            if (Object.hasOwn(value.observation, 'exit') && !Number.isSafeInteger(value.observation.exit)) {
              fail(index, `${path}.observation.exit`, 'expected an integer')
            }
          }
        } else if (value.source === 'derivation') {
          if (list(value.parents, index, `${path}.parents`)) {
            value.parents.forEach((parent, entry) => {
              if (!text(parent)) fail(index, `${path}.parents entry ${entry + 1}`, 'expected a non-empty item id')
            })
          }
        }
      }
      if (!items.some(item => item.source === 'transcript')) {
        fail(-1, 'items', "no item has source transcript: a spec needs the user's words")
      }
    }
  }
  const byId = new Map<string, Mapping>()
  items.forEach((item, index) => {
    if (!text(item.id)) return
    if (byId.has(item.id)) fail(index, `${item.id}.id`, `duplicate id ${item.id}`)
    else byId.set(item.id, item)
  })
  items.forEach((item, index) => {
    if (item.source !== 'derivation' || !Array.isArray(item.parents)) return
    const path = `${text(item.id) ? item.id : `item ${index + 1}`}.parents`
    for (const parent of item.parents) {
      if (text(parent) && !byId.has(parent)) fail(index, path, `parent id does not exist: ${parent}`)
    }
    const pending = [...item.parents], seen = new Set<string>()
    let sourced = false, asked = false, cycle = false
    while (pending.length) {
      const id = pending.pop()
      if (typeof id !== 'string' || seen.has(id)) continue
      seen.add(id)
      if (id === item.id) cycle = true
      const parent = byId.get(id)
      if (!parent) continue
      if (['transcript', 'rule'].includes(parent.source as string)) sourced = asked = true
      else if (parent.source === 'observation') sourced = true
      else if (parent.source === 'derivation' && Array.isArray(parent.parents)) pending.push(...parent.parents)
    }
    if (!sourced) fail(index, path, 'parent chain never reaches a transcript, rule or observation item')
    // An observation shows that a condition exists; it does not show that anyone asked for a mechanism.
    else if (item.kind === 'requirement' && !asked) fail(index, path, 'parent chain of a requirement never reaches a transcript or rule item')
    if (cycle) fail(index, path, 'cycle among parents')
  })
  if (violations.length) {
    for (const violation of violations.sort((a, b) => a.item - b.item)) console.error(violation.message.replace(/[\r\n]+/g, ' '))
    process.exitCode = 1
    return
  }
  const document = render(spec as Mapping, items)
  if (values['check-render']) {
    let current: string
    try { current = await readFile(values['check-render'], 'utf8') }
    catch (error) { throw new Error(`generated document is unreadable: ${messageOf(error)}`) }
    if (current !== document) throw new Error('generated document differs from the one in the tree; regenerate it with --render')
  }
  if (values.render) await writeFile(values.render, document)
  // The proof is printed only by a passing run, so a stage that returns it has run this tool.
  const summary = {
    counts: {
      kind: Object.fromEntries(kinds.map(kind => [kind, items.filter(item => item.kind === kind).length])),
      source: Object.fromEntries(sources.map(source => [source, items.filter(item => item.source === source).length])),
    },
    criteria: items.filter(item => item.kind === 'criterion').map((item, index) => ({ ordinal: index + 1, id: item.id })),
    sha256: createHash('sha256').update(bytes!).digest('hex'),
    nonBlankLines: nonBlankLines(bytes!.toString('utf8')),
    proof: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex'),
    spec: specPath,
  }
  const line = values.json ? JSON.stringify(summary) :
    `kind=${JSON.stringify(summary.counts.kind)} source=${JSON.stringify(summary.counts.source)} ` +
    `criteria=${JSON.stringify(summary.criteria)} sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} ` +
    `proof=${summary.proof} spec=${summary.spec}`
  if (values.json || !(values.render || values['check-render'])) console.log(line)
  else console.error(line)
}

function render(spec: Mapping, items: Mapping[]): string {
  const body = (item: Mapping) => `**${item.id}**: ${(item.content as string).trim()}`
  const paragraphs = (kind: string, tail = (_: Mapping) => '') =>
    items.filter(item => item.kind === kind).map(item => body(item) + tail(item)).join('\n\n')
  const criteria = items.filter(item => item.kind === 'criterion').map((item, index) => {
    const marker = `${index + 1}. `
    return marker + body(item).replace(/\n(?=.)/g, '\n' + ' '.repeat(marker.length))
  }).join('\n')
  const groups = [
    ['Requirements', paragraphs('requirement')], ['Boundaries', paragraphs('boundary')],
    ['Rejected alternatives', paragraphs('rejected', item => `\nReason: ${(item.reason as string).trim()}`)],
    ['Acceptance criteria', criteria],
  ]
  return [`# ${spec.unit}`, (spec.summary as string).trim(),
    ...groups.filter(([, content]) => content).map(([heading, content]) => `## ${heading}\n\n${content}`)].join('\n\n') + '\n'
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
