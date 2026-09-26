import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
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
const withoutReminders = (message: string) => message.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
// The text of a transcript record: a string body, or its text blocks joined, with reminders removed.
// A tool result block adds nothing.
const textOf = (record: Mapping) => {
  const content = mapping(record.message) ? record.message.content : undefined
  let message: string
  if (typeof content === 'string') message = content
  else if (Array.isArray(content)) message = textBlocks(content)
  else throw new Error('message.content must be a string or block array')
  return withoutReminders(message)
}
// A message sent while the session was working is recorded as an attachment of type
// queued_command. Commands of other origins are queued the same way, so only the origin kind
// human marks the user's words.
const queuedCommand = (record: Mapping): record is Mapping & { attachment: Mapping } =>
  record.type === 'attachment' && mapping(record.attachment) && record.attachment.type === 'queued_command'
const queuedText = (record: Mapping & { attachment: Mapping }) => {
  const { origin, prompt } = record.attachment
  const kind = mapping(origin) ? origin.kind : undefined
  if (kind !== 'human') throw new Error(`a queued command of origin ${JSON.stringify(kind ?? null)} is not the user's words`)
  if (typeof prompt !== 'string') throw new Error('attachment.prompt must be a string')
  return withoutReminders(prompt)
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
const toolResult = (record: Mapping) => blocksOf(record).some(block => mapping(block) && block.type === 'tool_result')
const humanOrigin = (value: unknown) => mapping(value) && value.kind === 'human'
// A message the user wrote: a typed user record, or a queued command, of origin human. A task
// notification, an injected meta record, command output and a tool result are none. Such a message
// opens a turn: the assistant records after it and before a cited record are the ones the cited
// words reply to.
const writtenByUser = (record: Mapping) => queuedCommand(record) ? humanOrigin(record.attachment.origin)
  : record.type === 'user' && record.isMeta !== true && humanOrigin(record.origin) && !toolResult(record)
const parseRecord = (line: string): Mapping | undefined => {
  try { const record = JSON.parse(line); return mapping(record) ? record : undefined } catch { return undefined }
}
const kebabCase = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
// The random string only a passing run prints, so a stage that returns it has run this tool.
const freshProof = () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')
const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The record at a line of a transcript, with what came before it: the ids of the question-dialog
// calls asked earlier and, when withReplies is set, the assistant records since the last message
// the user wrote.
async function readCited(transcripts: string, reference: Mapping, withReplies: boolean) {
  const input = createReadStream(resolve(transcripts, reference.file as string), { encoding: 'utf8' })
  const reader = createInterface({ input, crlfDelay: Infinity })
  let cited: unknown, found = false, current = 0
  let replies: Mapping[] = []
  const asked = new Set<string>()
  try {
    for await (const line of reader) {
      if (++current === reference.line) { cited = JSON.parse(line); found = true; break }
      if (!withReplies && !line.includes(dialogTool)) continue
      const earlier = parseRecord(line)
      if (!earlier) continue
      if (earlier.type === 'assistant') {
        for (const call of dialogCalls(earlier)) asked.add(call.id as string)
        replies.push(earlier)
      } else if (writtenByUser(earlier)) replies = []
    }
  } finally { reader.close(); input.destroy() }
  if (!found) throw new Error('line is outside the transcript')
  return { cited, replies, asked }
}

// The words of the user a cited record holds, and the ids of the question-dialog calls it answers.
// A tool result holds them only as the answers to a dialog call asked before it; a record that is
// not a message the user wrote throws.
function userWords(cited: unknown, uuid: string, asked: Set<string>) {
  if (!mapping(cited)) throw new Error('expected a user record with the cited uuid')
  if (queuedCommand(cited)) {
    if (!text(cited.uuid) || cited.uuid !== uuid) throw new Error('expected a queued message with the cited uuid')
    return { said: [queuedText(cited)], dialog: new Set<string>() }
  }
  if (cited.type !== 'user' || !text(cited.uuid) || cited.uuid !== uuid) {
    throw new Error('expected a user record with the cited uuid')
  }
  if (toolResult(cited)) {
    const dialog = new Set(resultIds(cited).filter(id => asked.has(id)))
    return { said: dialogAnswers(cited, dialog), dialog }
  }
  if (cited.isMeta === true) throw new Error("an injected meta record is not the user's words")
  if (!humanOrigin(cited.origin)) {
    const kind = mapping(cited.origin) ? cited.origin.kind : undefined
    throw new Error(`a user record of origin ${JSON.stringify(kind ?? null)} is not the user's words`)
  }
  return { said: [textOf(cited)], dialog: new Set<string>() }
}

// The whitespace-collapsed text of each assistant record the cited words reply to, with the question
// text of the dialog calls the cited record answers.
const replyTexts = (replies: Mapping[], dialog: Set<string>) => replies.map(reply => {
  try {
    return normalize([textOf(reply),
      ...dialogCalls(reply).filter(call => dialog.has(call.id as string)).map(call => dialogText(call.input))].join(' '))
  } catch { return '' }
})

// The text a context quote is checked against: a message's text with the question text of its
// dialog calls, or the prompt of a queued command.
const recordText = (record: Mapping) => queuedCommand(record)
  ? (typeof record.attachment.prompt === 'string' ? withoutReminders(record.attachment.prompt) : '')
  : [textOf(record), ...dialogCalls(record).map(call => dialogText(call.input))].join(' ')

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
  // A mapping's file and line, as a transcript or rule reference holds them.
  const located = (value: Mapping, item: number, path: string) => {
    const fileOK = stringField(value, 'file', item, path)
    if (Object.hasOwn(value, 'line') && !lineNumber(value.line)) {
      fail(item, `${path}.line`, 'expected a positive integer')
    }
    return fileOK && lineNumber(value.line)
  }
  const reference = (value: unknown, fields: string[], item: number, path: string): value is Mapping =>
    shape(value, fields, item, path) && located(value, item, path)
  // Prints every violation in item order and fails the run; returns whether there were any.
  const report = () => {
    for (const violation of violations.sort((a, b) => a.item - b.item)) console.error(violation.message.replace(/[\r\n]+/g, ' '))
    if (violations.length) process.exitCode = 1
    return violations.length > 0
  }
  return { fail, shape, stringField, list, located, reference, report }
}

// A private directive record holds the user's words and quoted context and nothing else, so every
// key is fixed and every quote is checked against the transcript record it cites.
const recordFormat = 'expected a YAML directive record: a mapping with exactly the keys unit and entries'
const recordKeys = ['unit', 'entries']
const entryRequired = ['id', 'file', 'line', 'uuid', 'words', 'context']
const entryOptional = ['answers', 'approves']
const approvalFields = ['text', 'file', 'sha256']
const sha256Hex = /^[0-9a-f]{64}$/

// Checks the private directive record a spec names and returns the words of its entries, or
// nothing when the record is not of that format. Its violations come before those of any item.
async function checkRecord(content: string, transcripts: string, { fail, shape, stringField, list, located, reference }: ReturnType<typeof validator>) {
  let record: unknown
  try { record = Bun.YAML.parse(content) } catch (error) { fail(-1, 'record', `${recordFormat}: ${messageOf(error)}`); return }
  if (!mapping(record)) { fail(-1, 'record', recordFormat); return }
  const keys = Object.keys(record)
  if (keys.length !== recordKeys.length || !recordKeys.every(key => keys.includes(key))) fail(-1, 'record', recordFormat)
  shape(record, recordKeys, -1, 'record')
  stringField(record, 'unit', -1, 'record')
  if (!list(record.entries, -1, 'record.entries')) return
  const words: string[] = [], ids = new Set<string>()
  for (const [index, entry] of record.entries.entries()) {
    const path = `record.${mapping(entry) && text(entry.id) ? entry.id : `entry ${index + 1}`}`
    if (!shape(entry, entryRequired, -1, path, entryOptional)) continue
    if (stringField(entry, 'id', -1, path)) {
      if (!kebabCase.test(entry.id as string)) fail(-1, `${path}.id`, 'expected a kebab-case id')
      if (ids.has(entry.id as string)) fail(-1, `${path}.id`, `duplicate id ${entry.id}`)
      ids.add(entry.id as string)
    }
    const refOK = located(entry, -1, path)
    const uuidOK = stringField(entry, 'uuid', -1, path)
    const wordsOK = stringField(entry, 'words', -1, path)
    if (wordsOK) words.push(entry.words as string)
    const answersOK = Object.hasOwn(entry, 'answers') && stringField(entry, 'answers', -1, path)
    // The approved plan text: a string standing in the assistant messages the words reply to, or a
    // mapping of the text with a file one of those messages names and that file's sha256.
    let approves: Mapping | undefined
    if (Object.hasOwn(entry, 'approves')) {
      const at = `${path}.approves`, value = entry.approves
      if (typeof value === 'string') {
        if (stringField(entry, 'approves', -1, path)) approves = { text: value }
      } else if (!mapping(value)) fail(-1, at, 'expected the approved text, or a mapping of text, file and sha256')
      else if (shape(value, approvalFields, -1, at) && approvalFields.every(field => stringField(value, field, -1, at))) {
        if (sha256Hex.test(value.sha256 as string)) approves = value
        else fail(-1, `${at}.sha256`, 'expected 64 lowercase hexadecimal digits')
      }
    }
    if (Object.hasOwn(entry, 'context') && list(entry.context, -1, `${path}.context`)) {
      for (const [position, quote] of entry.context.entries()) {
        const at = `${path}.context entry ${position + 1}`
        if (!reference(quote, ['file', 'line', 'uuid', 'quote'], -1, at)) continue
        if (!stringField(quote, 'uuid', -1, at) || !stringField(quote, 'quote', -1, at)) continue
        try {
          const { cited } = await readCited(transcripts, quote, false)
          if (!mapping(cited) || cited.uuid !== quote.uuid) throw new Error('expected a record with the cited uuid')
          if (!normalize(recordText(cited)).includes(normalize(quote.quote as string))) fail(-1, `${at}.quote`, 'not found in the cited record')
        } catch (error) { fail(-1, at, `transcript reference failed: ${messageOf(error)}`) }
      }
    }
    if (!refOK || !uuidOK) continue
    try {
      const { cited, replies, asked } = await readCited(transcripts, entry, answersOK || approves !== undefined)
      const { said, dialog } = userWords(cited, entry.uuid as string, asked)
      if (wordsOK && !said.some(message => normalize(message).includes(normalize(entry.words as string)))) {
        fail(-1, `${path}.words`, 'not found in the cited user message')
      }
      const texts = replyTexts(replies, dialog)
      const replied = (quote: string) => texts.some(reply => reply.includes(normalize(quote)))
      const unreplied = 'not found in the assistant messages the cited words reply to'
      if (answersOK && !replied(entry.answers as string)) fail(-1, `${path}.answers`, unreplied)
      if (approves && approves.file === undefined && !replied(approves.text as string)) fail(-1, `${path}.approves`, unreplied)
      else if (approves && approves.file !== undefined) {
        const plan = approves.file as string
        if (!replied(plan)) fail(-1, `${path}.approves.file`, 'not named in the assistant messages the cited words reply to')
        let bytes: Buffer | undefined
        try { bytes = await readFile(plan) } catch (error) { fail(-1, `${path}.approves.file`, `unreadable: ${messageOf(error)}`) }
        if (bytes && sha256Of(bytes) !== approves.sha256) fail(-1, `${path}.approves.sha256`, `does not match the file ${plan}`)
        else if (bytes && !normalize(bytes.toString('utf8')).includes(normalize(approves.text as string))) {
          fail(-1, `${path}.approves.text`, `not found in the file ${plan}`)
        }
      }
    } catch (error) { fail(-1, path, `transcript reference failed: ${messageOf(error)}`) }
  }
  return words
}

const usage = 'Usage: bun tools/check-spec.ts <spec.yaml> --transcripts <dir> ' +
  '[--render <path> | --check-render <path>] [--json] [--base <commit>] [--record <path>], ' +
  'or bun tools/check-spec.ts --fix-list <file> --transcripts <dir> [--json] [--expect <json>] [--record <path>]'

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, render: { type: 'string' },
      'check-render': { type: 'string' }, json: { type: 'boolean' }, base: { type: 'string' },
      'fix-list': { type: 'string' }, expect: { type: 'string' }, record: { type: 'string' } } })
  // The private record path a script's launch check passes from its marked block.
  const launchRecord = values.record
  if (launchRecord === '') throw new Error(usage)
  if (values['fix-list'] !== undefined) {
    if (positionals.length || !values['fix-list'] || !values.transcripts || values.render || values['check-render'] || values.base) {
      throw new Error(usage)
    }
    return checkFixList(values['fix-list'], values.transcripts, values.json === true, values.expect, launchRecord)
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
  const check = validator(specPath)
  const { fail, shape, stringField, list, reference, report } = check
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
  // The words of the entries of the private directive record the spec names, once it has been
  // checked and found to be of the record format.
  let recordWords: string[] | undefined
  if (parsed && shape(spec, ['unit', 'summary', 'record', 'items'], -1, 'spec')) {
    stringField(spec, 'unit', -1, 'spec')
    stringField(spec, 'summary', -1, 'spec')
    if (stringField(spec, 'record', -1, 'spec')) {
      const path = spec.record as string
      if (!await isFile(path)) fail(-1, 'spec.record', `does not name an existing file: ${path}`)
      else {
        let content: string | undefined
        try { content = await readFile(path, 'utf8') }
        catch (error) { fail(-1, 'spec.record', `unreadable private record: ${messageOf(error)}`) }
        if (content !== undefined) recordWords = await checkRecord(content, values.transcripts!, check)
      }
      if (launchRecord !== undefined && launchRecord !== path) {
        fail(-1, 'spec.record', `differs from the launch record path ${launchRecord}`)
      }
    }
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
                const { cited, replies, asked } = await readCited(values.transcripts!, evidence, answersOK)
                const { said, dialog } = userWords(cited, evidence.uuid as string, asked)
                if (wordsOK && said.some(words => words.includes(value.user_words as string))) matched = true
                const quote = answersOK ? normalize(value.answers as string) : ''
                if (answersOK && replyTexts(replies, dialog).some(reply => reply.includes(quote))) answered = true
              } catch (error) { fail(index, at, `transcript reference failed: ${messageOf(error)}`) }
            }
            if (wordsOK && !matched) fail(index, `${path}.user_words`, 'not found in any resolved user message')
            if (answersOK && !answered) fail(index, `${path}.answers`, 'not found in the assistant messages the cited words reply to')
          }
          const recorded = (words: string) => normalize(words).includes(normalize(value.user_words as string))
          if (wordsOK && recordWords !== undefined && !recordWords.some(recorded)) {
            fail(index, `${path}.user_words`, 'not found in the words of any private record entry')
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
    sha256: sha256Of(bytes!),
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

async function checkFixList(file: string, transcripts: string, json: boolean, expected?: string, launchRecord?: string) {
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
    // The fix script names the parent spec to a stage in another tree, where a relative path
    // would resolve somewhere else.
    if (parentOK && !isAbsolute(fixList.parentSpec as string)) {
      eachEntry('parentSpec', `expected an absolute path: ${fixList.parentSpec}`)
    } else if (parentOK && !await isFile(fixList.parentSpec as string)) {
      eachEntry('parentSpec', `does not name an existing file: ${fixList.parentSpec}`)
    } else if (parentOK && launchRecord !== undefined) {
      // The fixer reads the parent unit's private record, so the record path the fix script passes
      // at launch must be the one the parent spec declares.
      try {
        const parent: unknown = Bun.YAML.parse(await readFile(fixList.parentSpec as string, 'utf8'))
        if (!mapping(parent) || parent.record !== launchRecord) {
          eachEntry('parentSpec', `the record of the parent spec differs from the launch record path ${launchRecord}`)
        }
      } catch (error) { eachEntry('parentSpec', `unreadable or malformed parent spec: ${messageOf(error)}`) }
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
    sha256: sha256Of(bytes!),
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
