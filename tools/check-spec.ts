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
  const shape = (value: unknown, fields: string[], item: number, path: string): value is Mapping => {
    if (!mapping(value)) { fail(item, path, 'expected a mapping'); return false }
    for (const key of Object.keys(value)) {
      if (!fields.includes(key)) fail(item, `${path}.${key}`, 'unknown key')
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
  if (parsed && shape(spec, ['unit', 'items'], -1, 'spec')) {
    stringField(spec, 'unit', -1, 'spec')
    if (list(spec.items, -1, 'items')) {
      for (const [index, value] of spec.items.entries()) {
        const path = `items[${index + 1}]`
        if (!mapping(value)) { fail(index, path, 'expected a mapping'); items.push({}); continue }
        items.push(value)
        const extra = typeof value.source === 'string' && Object.hasOwn(sourceFields, value.source)
          ? sourceFields[value.source as keyof typeof sourceFields] : []
        shape(value, ['id', 'kind', 'content', 'source', ...(value.kind === 'rejected' ? ['reason'] : []),
          ...extra], index, path)
        if (stringField(value, 'id', index, path) && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value.id as string)) {
          fail(index, `${path}.id`, 'expected a kebab-case id')
        }
        if (!kinds.includes(value.kind as typeof kinds[number])) fail(index, `${path}.kind`, 'unknown kind')
        if (!sources.includes(value.source as typeof sources[number])) fail(index, `${path}.source`, 'unknown source')
        stringField(value, 'content', index, path)
        if (value.kind === 'rejected') stringField(value, 'reason', index, path)
        if (value.source === 'transcript') {
          const wordsOK = stringField(value, 'user_words', index, path)
          let matched = false
          if (list(value.evidence, index, `${path}.evidence`)) {
            for (const [entry, evidence] of value.evidence.entries()) {
              const at = `${path}.evidence[${entry + 1}]`
              const refOK = reference(evidence, ['file', 'line', 'uuid'], index, at)
              const uuidOK = mapping(evidence) && stringField(evidence, 'uuid', index, at)
              if (!refOK || !uuidOK) continue
              try {
                const input = createReadStream(resolve(values.transcripts!, evidence.file as string), { encoding: 'utf8' })
                const reader = createInterface({ input, crlfDelay: Infinity })
                let record: unknown, found = false, current = 0
                try {
                  for await (const line of reader) {
                    if (++current === evidence.line) { record = JSON.parse(line); found = true; break }
                  }
                } finally { reader.close(); input.destroy() }
                if (!found) throw new Error('line is outside the transcript')
                if (!mapping(record) || record.type !== 'user' || !text(record.uuid) || record.uuid !== evidence.uuid) {
                  throw new Error('expected a user record with the cited uuid')
                }
                const content = mapping(record.message) ? record.message.content : undefined
                let message: string
                if (typeof content === 'string') message = content
                else if (Array.isArray(content)) {
                  message = content.filter(block => mapping(block) && block.type === 'text')
                    .map(block => typeof block.text === 'string' ? block.text : '').join('')
                } else throw new Error('message.content must be a string or block array')
                message = message.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
                if (wordsOK && message.includes(value.user_words as string)) matched = true
              } catch (error) { fail(index, at, `transcript reference failed: ${messageOf(error)}`) }
            }
            if (wordsOK && !matched) fail(index, `${path}.user_words`, 'not found in any resolved user message')
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
              if (!text(parent)) fail(index, `${path}.parents[${entry + 1}]`, 'expected a non-empty item id')
            })
          }
        }
      }
    }
  }
  const byId = new Map<string, Mapping>()
  items.forEach((item, index) => {
    if (!text(item.id)) return
    if (byId.has(item.id)) fail(index, `items[${index + 1}].id`, `duplicate id ${item.id}`)
    else byId.set(item.id, item)
  })
  items.forEach((item, index) => {
    if (item.source !== 'derivation' || !Array.isArray(item.parents)) return
    const path = `items[${index + 1}].parents`
    for (const parent of item.parents) {
      if (text(parent) && !byId.has(parent)) fail(index, path, `parent id does not exist: ${parent}`)
    }
    const pending = [...item.parents], seen = new Set<string>()
    let grounded = false, cycle = false
    while (pending.length) {
      const id = pending.pop()
      if (typeof id !== 'string' || seen.has(id)) continue
      seen.add(id)
      if (id === item.id) cycle = true
      const parent = byId.get(id)
      if (!parent) continue
      if (['transcript', 'rule', 'observation'].includes(parent.source as string)) grounded = true
      else if (parent.source === 'derivation' && Array.isArray(parent.parents)) pending.push(...parent.parents)
    }
    if (!grounded) fail(index, path, 'parent chain never reaches a transcript, rule or observation item')
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
  const summary = {
    counts: {
      kind: Object.fromEntries(kinds.map(kind => [kind, items.filter(item => item.kind === kind).length])),
      source: Object.fromEntries(sources.map(source => [source, items.filter(item => item.source === source).length])),
    },
    criteria: items.filter(item => item.kind === 'criterion').map((item, index) => ({ ordinal: index + 1, id: item.id })),
    sha256: createHash('sha256').update(bytes!).digest('hex'),
    nonBlankLines: nonBlankLines(bytes!.toString('utf8')),
  }
  console.log(values.json ? JSON.stringify(summary) :
    `kind=${JSON.stringify(summary.counts.kind)} source=${JSON.stringify(summary.counts.source)} ` +
    `criteria=${JSON.stringify(summary.criteria)} sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines}`)
}

function render(spec: Mapping, items: Mapping[]): string {
  let ordinal = 0
  return `# ${spec.unit}\n\n` + items.map(item => {
    const heading = item.kind === 'criterion' ? `Criterion ${++ordinal}` :
      ({ requirement: 'Requirement', rejected: 'Rejected alternative', boundary: 'Boundary' } as Mapping)[item.kind as string]
    return `## ${heading}: ${item.id}\n\n${item.content}\n` +
      (item.kind === 'rejected' ? `\nReason: ${item.reason}\n` : '')
  }).join('\n')
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
