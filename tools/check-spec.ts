import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
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
const blocksOf = (record: Mapping): unknown[] => {
  const content = mapping(record.message) ? record.message.content : undefined
  return Array.isArray(content) ? content : []
}
// The text of one text block. Any other block has none.
const blockText = (block: unknown) =>
  mapping(block) && block.type === 'text' ? (typeof block.text === 'string' ? block.text : '') : ''
const textBlocks = (blocks: unknown[]) => blocks.map(blockText).join('')
// The question dialog is the one tool whose result carries the user's own answer. The result of
// any other tool is output of a command or a program and never counts as the user's words.
const dialogTool = 'AskUserQuestion'
const dialogCalls = (record: Mapping) => blocksOf(record).filter((block): block is Mapping =>
  mapping(block) && block.type === 'tool_use' && block.name === dialogTool && text(block.id))
const resultIds = (record: Mapping) => blocksOf(record)
  .filter((block): block is Mapping => mapping(block) && block.type === 'tool_result' && text(block.tool_use_id))
  .map(block => block.tool_use_id as string)
// The question strings, option labels and option descriptions of one question-dialog input.
const dialogText = (input: unknown) => {
  const questions = mapping(input) && Array.isArray(input.questions) ? input.questions : []
  return questions.filter(mapping).flatMap(question => [question.question,
    ...(Array.isArray(question.options) ? question.options : []).filter(mapping).flatMap(option => [option.label, option.description])])
    .filter(value => typeof value === 'string').join(' ')
}
// The text of a transcript record: a string body, or its text blocks joined, with reminders removed.
// A tool result block adds nothing.
const textOf = (record: Mapping) => {
  const content = mapping(record.message) ? record.message.content : undefined
  let message: string
  if (typeof content === 'string') message = content
  else if (Array.isArray(content)) message = textBlocks(content)
  else throw new Error('message.content must be a string or block array')
  return message.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
}
// The answers the user chose in the question dialog: the values of the record's structured
// `toolUseResult.answers` mapping, when `answered` holds the id of a question-dialog call the
// record's tool result answers. The tool result's content holds the question text and the host's
// own wording around the answers, so it never counts as the user's words.
const dialogAnswers = (record: Mapping, answered: Set<string>): string[] => {
  if (!answered.size || !mapping(record.toolUseResult)) return []
  const { answers } = record.toolUseResult
  return mapping(answers) ? Object.values(answers).filter(text) : []
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
const kebabCase = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
// The random string only a passing run prints, so a stage that returns it has run this tool.
const freshProof = () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')

// The shape checks a spec and a fix list share. Each failure is recorded with the position of the
// item it concerns, so the report keeps file order, and with a path that names the item.
function validator(file: string) {
  const violations: { item: number, message: string }[] = []
  const fail = (item: number, path: string, message: string) => {
    violations.push({ item, message: `${file}: ${path}: ${message}` })
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
  // Prints every violation in item order and fails the run; returns whether there were any.
  const report = () => {
    for (const violation of violations.sort((a, b) => a.item - b.item)) console.error(violation.message.replace(/[\r\n]+/g, ' '))
    if (violations.length) process.exitCode = 1
    return violations.length > 0
  }
  return { fail, shape, stringField, list, report }
}

const usage = 'Usage: bun tools/check-spec.ts <spec.yaml> --transcripts <dir> ' +
  '[--render <path> | --check-render <path>] [--json] [--base <commit>], ' +
  'or bun tools/check-spec.ts --fix-list <file> --transcripts <dir> [--json] [--expect <json>]'

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, render: { type: 'string' },
      'check-render': { type: 'string' }, json: { type: 'boolean' }, base: { type: 'string' },
      'fix-list': { type: 'string' }, expect: { type: 'string' } } })
  if (values['fix-list'] !== undefined) {
    if (positionals.length || !values['fix-list'] || !values.transcripts || values.render || values['check-render'] || values.base) {
      throw new Error(usage)
    }
    return checkFixList(values['fix-list'], values.transcripts, values.json === true, values.expect)
  }
  if (positionals.length !== 1 || !values.transcripts || (values.render && values['check-render']) || values.expect !== undefined) {
    throw new Error(usage)
  }
  // A cited rule file is read as it stood at the base commit when it is tracked there, so a unit
  // that rewrites the very line its spec quotes still passes after the change. A file the commit
  // does not hold, a path outside the repository, or no repository at all reads from disk.
  const ruleText = async (file: string) => {
    if (values.base) {
      const shown = Bun.spawnSync(['git', 'show', `${values.base}:./${file}`], { stdout: 'pipe', stderr: 'pipe' })
      if (shown.exitCode === 0) return shown.stdout.toString()
    }
    return readFile(file, 'utf8')
  }
  const specPath = positionals[0]
  const { fail, shape, stringField, list, report } = validator(specPath)
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
        if (stringField(value, 'id', index, path) && !kebabCase.test(value.id as string)) {
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
                // The ids of the question-dialog calls in assistant records before the cited one.
                const asked = new Set<string>()
                try {
                  for await (const line of reader) {
                    if (++current === evidence.line) { record = JSON.parse(line); found = true; break }
                    if (!answersOK && !line.includes(dialogTool)) continue
                    const earlier = parseRecord(line)
                    if (!earlier) continue
                    if (earlier.type === 'assistant') {
                      for (const call of dialogCalls(earlier)) asked.add(call.id as string)
                      replies.push(earlier)
                    } else if (earlier.type === 'user' && opensTurn(earlier)) replies = []
                  }
                } finally { reader.close(); input.destroy() }
                if (!found) throw new Error('line is outside the transcript')
                if (!mapping(record) || record.type !== 'user' || !text(record.uuid) || record.uuid !== evidence.uuid) {
                  throw new Error('expected a user record with the cited uuid')
                }
                const dialog = new Set(resultIds(record).filter(id => asked.has(id)))
                const said = [textOf(record), ...dialogAnswers(record, dialog)]
                if (wordsOK && said.some(words => words.includes(value.user_words as string))) matched = true
                if (answersOK) {
                  const quote = normalize(value.answers as string)
                  // A reply's text includes the question text of the dialog calls the cited record answers.
                  const replyText = (reply: Mapping) => [textOf(reply),
                    ...dialogCalls(reply).filter(call => dialog.has(call.id as string)).map(call => dialogText(call.input))].join(' ')
                  if (replies.some(reply => { try { return normalize(replyText(reply)).includes(quote) } catch { return false } })) answered = true
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
              const fileLines = lines(await ruleText(rule.file as string))
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
  if (report()) return
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
    proof: freshProof(),
    spec: specPath,
  }
  const line = values.json ? JSON.stringify(summary) :
    `kind=${JSON.stringify(summary.counts.kind)} source=${JSON.stringify(summary.counts.source)} ` +
    `criteria=${JSON.stringify(summary.criteria)} sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} ` +
    `proof=${summary.proof} spec=${summary.spec}`
  if (values.json || !(values.render || values['check-render'])) console.log(line)
  else console.error(line)
}

// A fix list names findings of one earlier run and the correction each needs. It holds no words of
// the user, so its check resolves every entry against the parent run's journal in their place.
const fixListFields = ['parentSpec', 'run', 'entries']
const entryFields = ['id', 'source', 'finding', 'correction']
// A finding's source id in the parent run: the reader's name and the finding's index in its list.
// The name is kebabCase with its anchors removed, and both parts are captured for the resolver.
const sourceId = new RegExp(`^(${kebabCase.source.slice(1, -1)}):(0|[1-9][0-9]*)$`)
// A run id is one directory name under the session's workflow directory.
const runId = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
// The stage label the parent run gives a reader: the roaster's stage is roast, every other review:<name>.
const stageLabel = (reader: string) => reader === 'roaster' ? 'roast' : `review:${reader}`
const isFile = (path: string) => stat(path).then(found => found.isFile(), () => false)

// The journal of a run: <transcripts>/<session>/subagents/workflows/<run>/journal.jsonl, in exactly
// one session.
async function findJournal(transcripts: string, run: string): Promise<string> {
  const sessions = await readdir(transcripts, { withFileTypes: true })
  const found: string[] = []
  for (const session of sessions.filter(entry => entry.isDirectory())) {
    const path = join(transcripts, session.name, 'subagents', 'workflows', run, 'journal.jsonl')
    if (await isFile(path)) found.push(path)
  }
  if (!found.length) throw new Error(`run ${run} has no journal under the transcript directory`)
  if (found.length > 1) throw new Error(`run ${run} has a journal in more than one session`)
  return found[0]
}

// The result of every stage label's last started agent: a retried stage starts a new agent under
// the same label, and only the last one's result is the stage's result.
async function lastResults(journal: string): Promise<Map<string, unknown>> {
  const started = new Map<string, unknown>(), results = new Map<unknown, unknown>()
  lines(await readFile(journal, 'utf8')).forEach((line, index) => {
    if (!line.trim()) return
    let record: unknown
    try { record = JSON.parse(line) } catch { throw new Error(`journal line ${index + 1} is not JSON`) }
    if (!mapping(record)) return
    if (record.type === 'started' && text(record.label)) started.set(record.label, record.key)
    else if (record.type === 'result') results.set(record.key, record.result)
  })
  return new Map([...started].map(([label, key]) => [label, results.get(key)]))
}

async function checkFixList(file: string, transcripts: string, json: boolean, expected?: string) {
  const { fail, shape, stringField, list, report } = validator(file)
  let bytes: Buffer | undefined
  let fixList: unknown
  let parsed = false
  try {
    bytes = await readFile(file)
    fixList = Bun.YAML.parse(bytes.toString('utf8'))
    parsed = true
  } catch (error) {
    fail(-1, 'fix list', `unreadable or malformed YAML: ${messageOf(error)}`)
  }
  const entries: { index: number, path: string, value: Mapping }[] = []
  if (parsed && shape(fixList, fixListFields, -1, 'fix list')) {
    const parentOK = stringField(fixList, 'parentSpec', -1, 'fix list')
    const runOK = stringField(fixList, 'run', -1, 'fix list') && runId.test(fixList.run as string)
    if (text(fixList.run) && !runOK) fail(-1, 'fix list.run', 'expected a run id')
    if (list(fixList.entries, -1, 'entries')) {
      const ids = new Set<string>()
      for (const [index, value] of fixList.entries.entries()) {
        const path = mapping(value) && text(value.id) ? value.id : `entry ${index + 1}`
        if (!shape(value, entryFields, index, path)) continue
        for (const field of entryFields) stringField(value, field, index, path)
        if (text(value.id)) {
          if (!kebabCase.test(value.id)) fail(index, `${path}.id`, 'expected a kebab-case id')
          if (ids.has(value.id)) fail(index, `${path}.id`, `duplicate id ${value.id}`)
          ids.add(value.id)
        }
        if (text(value.source) && !sourceId.test(value.source)) fail(index, `${path}.source`, 'expected <seat>:<index>')
        entries.push({ index, path, value })
      }
    }
    // Every entry rests on the parent spec and the parent run, so a failure of either is reported
    // against each entry, or against the list itself when no entry could be read.
    const eachEntry = (field: string, message: string) => {
      if (!entries.length) fail(-1, `fix list.${field}`, message)
      for (const { index, path } of entries) fail(index, `${path}.${field}`, message)
    }
    if (parentOK && !await isFile(resolve(fixList.parentSpec as string))) {
      eachEntry('parentSpec', `does not name an existing file: ${fixList.parentSpec}`)
    }
    // The launch values a fix script received: its entries and parentSpec. Each must equal the
    // list's, so the corrections the script hands on are the ones this check resolved.
    if (expected !== undefined) {
      let launch: unknown
      try { launch = JSON.parse(expected) } catch (error) { fail(-1, 'launch values', `malformed JSON: ${messageOf(error)}`) }
      if (launch !== undefined && shape(launch, ['entries', 'parentSpec'], -1, 'launch values')) {
        if (launch.parentSpec !== fixList.parentSpec) eachEntry('parentSpec', 'differs from the launch values')
        const launched = new Map<string, Mapping>()
        if (!Array.isArray(launch.entries)) fail(-1, 'launch values.entries', 'expected a list')
        else for (const given of launch.entries) {
          if (!mapping(given) || !text(given.id) || launched.has(given.id)) {
            fail(-1, 'launch values.entries', `expected a mapping with a unique id: ${JSON.stringify(given)}`)
          } else launched.set(given.id, given)
        }
        for (const { index, path, value } of entries) {
          const given = text(value.id) ? launched.get(value.id) : undefined
          if (!given) { fail(index, path, 'missing from the launch values'); continue }
          for (const key of new Set([...Object.keys(value), ...Object.keys(given)])) {
            if (value[key] !== given[key]) fail(index, `${path}.${key}`, 'differs from the launch values')
          }
        }
        const listed = new Set(entries.map(({ value }) => value.id))
        for (const id of launched.keys()) {
          if (!listed.has(id)) fail(-1, 'launch values.entries', `${id} is not an entry of the fix list`)
        }
      }
    }
    if (runOK) {
      let results: Map<string, unknown> | undefined
      try { results = await lastResults(await findJournal(transcripts, fixList.run as string)) }
      catch (error) { eachEntry('source', messageOf(error)) }
      if (results) for (const { index, path, value } of entries) {
        const match = text(value.source) ? sourceId.exec(value.source) : null
        if (!match) continue
        const [, reader, position] = match
        const label = stageLabel(reader)
        if (!results.has(label)) { fail(index, `${path}.source`, `the parent run has no stage labelled ${label}`); continue }
        const result = results.get(label)
        const findings = mapping(result) && Array.isArray(result.findings) ? result.findings : undefined
        if (!findings) { fail(index, `${path}.source`, `the last ${label} stage returned no findings list`); continue }
        if (Number(position) >= findings.length) {
          fail(index, `${path}.source`, `index ${position} is outside the ${findings.length} findings of ${label}`); continue
        }
        const found = findings[Number(position)]
        const claim = mapping(found) && typeof found.claim === 'string' ? found.claim : ''
        if (text(value.finding) && !normalize(claim).includes(normalize(value.finding))) {
          fail(index, `${path}.finding`, `not found in the claim of ${value.source}`)
        }
      }
    }
  }
  if (report()) return
  const { run, parentSpec } = fixList as Mapping
  const summary = {
    entries: entries.map(({ value }) => Object.fromEntries(entryFields.map(field => [field, value[field]]))),
    run,
    parentSpec,
    sha256: createHash('sha256').update(bytes!).digest('hex'),
    proof: freshProof(),
    fixList: file,
  }
  console.log(json ? JSON.stringify(summary) :
    `entries=${summary.entries.length} run=${summary.run} sha256=${summary.sha256} proof=${summary.proof} fixList=${summary.fixList}`)
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
