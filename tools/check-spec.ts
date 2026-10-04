import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { fromMarkdown } from 'mdast-util-from-markdown@2.0.3'

const minimumBun = '1.2.21'
// A spec holds the discussion of a unit and nothing else: each entry quotes one session record, the
// user's words or the assistant's context, and only an entry of author user is authority.
const specKeys = ['unit', 'entries']
const entryKeys = ['file', 'line', 'uuid', 'author', 'text']
const authors = ['user', 'assistant']
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
// The one tool whose call holds a whole file the assistant wrote, in input.content.
const writeTool = 'Write'
const toolCalls = (record: Mapping, name: string) => blocksOf(record).filter((block): block is Mapping =>
  mapping(block) && block.type === 'tool_use' && block.name === name)
const dialogCalls = (record: Mapping) => toolCalls(record, dialogTool).filter(call => text(call.id))
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
// A queued prompt is a string, or a block array when the message carries an image beside its text.
const promptText = (prompt: unknown) => {
  if (typeof prompt === 'string') return withoutReminders(prompt)
  if (Array.isArray(prompt)) return withoutReminders(textBlocks(prompt))
  throw new Error('attachment.prompt must be a string or block array')
}
const queuedText = (record: Mapping & { attachment: Mapping }) => {
  const { origin, prompt } = record.attachment
  const kind = mapping(origin) ? origin.kind : undefined
  if (kind !== 'human') throw new Error(`a queued command of origin ${JSON.stringify(kind ?? null)} is not the user's words`)
  return promptText(prompt)
}
// The host's placeholder in `answers` for a question the user answered with a typed note alone.
const notesOnly = '(notes only)'
// The words the user gave in the question dialog, when `answered` holds the id of a
// question-dialog call the record's tool result answers: the values of the record's structured
// `toolUseResult.answers` mapping and the `notes` of each entry of its `annotations` mapping, which
// is keyed by the question. The answer to a question whose annotation carries notes is the host's
// placeholder when it reads `(notes only)`, and the function drops that value. The `preview` of an
// annotation is the option's preview text. The tool result's content holds the question text and
// the host's own wording around the answers. Neither counts as the user's words.
const dialogAnswers = (record: Mapping, answered: Set<string>): string[] => {
  if (!answered.size || !mapping(record.toolUseResult)) return []
  const { answers, annotations } = record.toolUseResult
  const annotated: Mapping = mapping(annotations) ? annotations : {}
  const noteOf = (annotation: unknown) => mapping(annotation) && text(annotation.notes) ? annotation.notes : undefined
  const placeholder = ([question, answer]: [string, unknown]) =>
    answer === notesOnly && Object.hasOwn(annotated, question) && noteOf(annotated[question]) !== undefined
  const pairs = mapping(answers) ? Object.entries(answers) : []
  const chosen = pairs.filter(pair => !placeholder(pair)).map(([, answer]) => answer)
  const typed = Object.values(annotated).map(noteOf)
  return [...chosen, ...typed].filter(text)
}
const toolResult = (record: Mapping) => blocksOf(record).some(block => mapping(block) && block.type === 'tool_result')
const humanOrigin = (value: unknown) => mapping(value) && value.kind === 'human'
const parseRecord = (line: string): Mapping | undefined => {
  try { const record = JSON.parse(line); return mapping(record) ? record : undefined } catch { return undefined }
}
// The random string only a passing run prints, so a stage that returns it has run this tool.
const freshProof = () => Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')
const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The record at a line of a transcript, with the ids of the question-dialog calls asked before it.
async function readCited(transcripts: string, reference: Mapping) {
  const input = createReadStream(resolve(transcripts, reference.file as string), { encoding: 'utf8' })
  const reader = createInterface({ input, crlfDelay: Infinity })
  let cited: unknown, found = false, current = 0
  const asked = new Set<string>()
  try {
    for await (const line of reader) {
      if (++current === reference.line) { cited = JSON.parse(line); found = true; break }
      if (!line.includes(dialogTool)) continue
      const earlier = parseRecord(line)
      if (earlier?.type === 'assistant') for (const call of dialogCalls(earlier)) asked.add(call.id as string)
    }
  } finally { reader.close(); input.destroy() }
  if (!found) throw new Error('line is outside the transcript')
  return { cited, asked }
}

// The words of the user a cited record holds. A tool result holds them only as the answers to a
// dialog call asked before it; a record that is not a message the user wrote throws. An injected
// meta record or a record of any origin other than human throws before its tool result is read. A
// dialog answer carries no origin, so a tool result without one is read.
function userWords(cited: unknown, uuid: string, asked: Set<string>): string[] {
  if (!mapping(cited)) throw new Error('expected a user record with the cited uuid')
  if (queuedCommand(cited)) {
    if (!text(cited.uuid) || cited.uuid !== uuid) throw new Error('expected a queued message with the cited uuid')
    return [queuedText(cited)]
  }
  if (cited.type !== 'user' || !text(cited.uuid) || cited.uuid !== uuid) {
    throw new Error('expected a user record with the cited uuid')
  }
  if (cited.isMeta === true) throw new Error("an injected meta record is not the user's words")
  const foreign = () => {
    const kind = mapping(cited.origin) ? cited.origin.kind : undefined
    return new Error(`a user record of origin ${JSON.stringify(kind ?? null)} is not the user's words`)
  }
  if (cited.origin !== undefined && !humanOrigin(cited.origin)) throw foreign()
  if (toolResult(cited)) return dialogAnswers(cited, new Set(resultIds(cited).filter(id => asked.has(id))))
  if (!humanOrigin(cited.origin)) throw foreign()
  return [textOf(cited)]
}

// The texts an assistant entry may quote from a cited assistant record: its text blocks, the
// question text of each of its dialog calls, and the content of each of its Write calls.
function assistantTexts(cited: unknown, uuid: string): string[] {
  if (!mapping(cited) || cited.type !== 'assistant' || !text(cited.uuid) || cited.uuid !== uuid) {
    throw new Error('expected an assistant record with the cited uuid')
  }
  const written = toolCalls(cited, writeTool)
    .map(call => mapping(call.input) && typeof call.input.content === 'string' ? call.input.content : '')
  return [textOf(cited), ...dialogCalls(cited).map(call => dialogText(call.input)), ...written]
}

// A line of an entry's text, counted with its indentation and markers, holds at most this many
// characters.
const width = 120
const characters = (line: string) => [...line].length
type Point = { line: number, column: number }
type MarkdownNode = { type: string, position?: { start: Point, end: Point }, children?: MarkdownNode[] }
const paragraphs = (node: MarkdownNode): MarkdownNode[] =>
  node.type === 'paragraph' ? [node] : (node.children ?? []).flatMap(paragraphs)

// Checks one text against the width rule and returns a message for every line that breaks it.
// No line is longer than the width, and every line of a paragraph but its last is full: the first
// word of the next line would not fit on it. A line over the width passes only when its whole text is
// one word longer than the width, and its number is returned in unbreakable. The parser gives the
// paragraphs, and its prefix tokens give the column where each line's own text starts after the
// indentation, list markers and quote markers in front of it.
function widthViolations(prose: string) {
  const rows = lines(prose)
  const textStart = new Map<number, number>()
  const prefix = (token: { end: Point }) => {
    textStart.set(token.end.line, Math.max(textStart.get(token.end.line) ?? 1, token.end.column))
  }
  const tree: MarkdownNode = fromMarkdown(prose, { mdastExtensions: [{ enter: {
    linePrefix: prefix, blockQuotePrefix: prefix, listItemPrefix: prefix, listItemIndent: prefix } }] })
  const problems: string[] = [], unbreakable: number[] = []
  // The words of a line, without the indentation and markers in front of its own text.
  const words = (line: number) => rows[line - 1].slice((textStart.get(line) ?? 1) - 1).trim().split(/\s+/)
  rows.forEach((row, index) => {
    if (characters(row) <= width) return
    const own = words(index + 1)
    if (own.length === 1 && characters(own[0]) > width) unbreakable.push(index + 1)
    else problems.push(`line ${index + 1} is ${characters(row)} characters, over ${width}`)
  })
  for (const { position } of paragraphs(tree)) {
    for (let line = position!.start.line; line < position!.end.line; line++) {
      const next = words(line + 1)[0]
      if (characters(rows[line - 1].trimEnd()) + 1 + characters(next) <= width) {
        problems.push(`line ${line} is not full: the first word of line ${line + 1} fits on it`)
      }
    }
  }
  return { problems, unbreakable }
}

// The shape checks a spec and a fix list share. Each failure is recorded with the position of the
// entry it concerns, so the report keeps file order, and with a path that names the entry.
function validator(file: string) {
  const violations: { item: number, message: string }[] = []
  const fail = (item: number, path: string, message: string) => {
    violations.push({ item, message: `${file}: ${path}: ${message}` })
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
  // A mapping's file and line, as a transcript reference holds them.
  const located = (value: Mapping, item: number, path: string) => {
    const fileOK = stringField(value, 'file', item, path)
    if (Object.hasOwn(value, 'line') && !lineNumber(value.line)) {
      fail(item, `${path}.line`, 'expected a positive integer')
    }
    return fileOK && lineNumber(value.line)
  }
  // Prints every violation in entry order and fails the run; returns whether there were any.
  const report = () => {
    for (const violation of violations.sort((a, b) => a.item - b.item)) console.error(violation.message.replace(/[\r\n]+/g, ' '))
    if (violations.length) process.exitCode = 1
    return violations.length > 0
  }
  return { fail, shape, stringField, list, located, report }
}

const usage = 'Usage: bun tools/check-spec.ts <spec.yaml> --transcripts <dir> ' +
  '[--json] [--base <JSON list of { path, sha }> [--partial-base]], ' +
  'or bun tools/check-spec.ts --fix-list <file> --transcripts <dir> [--json] [--expect <json>], ' +
  'or bun tools/check-spec.ts --make-fix-list <run> --transcripts <dir>'

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, json: { type: 'boolean' }, base: { type: 'string' }, 'partial-base': { type: 'boolean' },
      'fix-list': { type: 'string' }, expect: { type: 'string' }, 'make-fix-list': { type: 'string' } } })
  if (values['make-fix-list'] !== undefined) {
    if (positionals.length || !values['make-fix-list'] || !values.transcripts || values.base || values['partial-base'] ||
      values['fix-list'] !== undefined || values.expect !== undefined || values.json) {
      throw new Error(usage)
    }
    return makeFixList(values['make-fix-list'], values.transcripts)
  }
  if (values['fix-list'] !== undefined) {
    if (positionals.length || !values['fix-list'] || !values.transcripts || values.base || values['partial-base']) {
      throw new Error(usage)
    }
    return checkFixList(values['fix-list'], values.transcripts, values.json === true, values.expect)
  }
  if (positionals.length !== 1 || !values.transcripts || values.expect !== undefined ||
    (values['partial-base'] && values.base === undefined)) {
    throw new Error(usage)
  }
  if (values.base !== undefined) await baseRepositories(values.base, values['partial-base'] === true)
  const transcripts = values.transcripts
  const specPath = positionals[0]
  const { fail, shape, stringField, list, located, report } = validator(specPath)
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
  // The text of every entry: the width rule checks it and the size gate counts its non-blank lines.
  // unbreakableLines holds the lines over the width that pass because their one word cannot be broken.
  const unbreakableLines: { field: string, line: number }[] = []
  let specLines = 0
  if (parsed && shape(spec, specKeys, -1, 'spec')) {
    stringField(spec, 'unit', -1, 'spec')
    if (list(spec.entries, -1, 'entries')) {
      // The last line read in each session file, so entries of one file never go back in it.
      const reached = new Map<string, number>()
      for (const [index, entry] of spec.entries.entries()) {
        const path = `entry ${index + 1}`
        if (!shape(entry, entryKeys, index, path)) continue
        const placed = located(entry, index, path)
        const uuidOK = stringField(entry, 'uuid', index, path)
        const authorOK = authors.includes(entry.author as string)
        if (Object.hasOwn(entry, 'author') && !authorOK) fail(index, `${path}.author`, 'expected user or assistant')
        const textOK = stringField(entry, 'text', index, path)
        if (textOK) {
          specLines += nonBlankLines(entry.text as string)
          const { problems, unbreakable } = widthViolations(entry.text as string)
          for (const problem of problems) fail(index, `${path}.text`, problem)
          unbreakableLines.push(...unbreakable.map(line => ({ field: `${path}.text`, line })))
        }
        if (!placed) continue
        // The order is kept per file on disk, so two names of one session file, such as a symbolic
        // link beside it, share one position. A file that cannot be resolved fails as a transcript
        // reference below and has no position.
        const session = await realpath(resolve(transcripts, entry.file as string)).catch(() => undefined)
        if (session !== undefined) {
          const line = entry.line as number, previous = reached.get(session)
          if (previous !== undefined && line < previous) {
            fail(index, `${path}.line`, `goes back to line ${line} of ${entry.file} after line ${previous}`)
          }
          reached.set(session, Math.max(previous ?? line, line))
        }
        if (!uuidOK || !authorOK) continue
        try {
          const { cited, asked } = await readCited(transcripts, entry)
          const user = entry.author === 'user'
          const quoted = user ? userWords(cited, entry.uuid as string, asked) : assistantTexts(cited, entry.uuid as string)
          if (textOK && !quoted.some(message => normalize(message).includes(normalize(entry.text as string)))) {
            fail(index, `${path}.text`, `not found in the cited ${user ? 'user' : 'assistant'} message`)
          }
        } catch (error) { fail(index, path, `transcript reference failed: ${messageOf(error)}`) }
      }
      if (!spec.entries.some(entry => mapping(entry) && entry.author === 'user')) {
        fail(-1, 'entries', "no entry has author user: a spec needs the user's words")
      }
    }
  }
  if (report()) return
  const summary = {
    sha256: sha256Of(bytes!),
    nonBlankLines: nonBlankLines(bytes!.toString('utf8')),
    // The spec lines the size gate divides by: the non-blank lines of the entries' text.
    specLines,
    unbreakable: unbreakableLines,
    proof: freshProof(),
    spec: specPath,
  }
  console.log(values.json ? JSON.stringify(summary) :
    `sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} specLines=${summary.specLines} ` +
    `unbreakable=${JSON.stringify(summary.unbreakable)} proof=${summary.proof} spec=${summary.spec}`)
}

// A fix list holds what one earlier run returned to be fixed, each item as the run's journal holds
// it, and names the spec of the unit the run belongs to, which the fix run reads for the user's
// words. --make-fix-list writes such a list from the journal, and nobody adds, removes or edits an
// entry; the check holds every entry to the journal and the spec to the one the run checked. A fix
// list is never written from a spec, and the two never mix: each mode refuses the keys of the other.
const fixListKeys = ['run', 'spec', 'entries']
// An entry's source: a decision of the finding verifier, a finding of the roaster or of the diff
// check, or, in a run without a verify stage such as a review pass, a finding of a review seat, by
// its index in the list of the last result of that stage.
const sourceKinds = {
  verify: { label: 'verify', list: 'decisions', field: 'decision' },
  roaster: { label: 'roast', list: 'findings', field: 'finding' },
  diff: { label: 'diff', list: 'findings', field: 'finding' },
} as const
type SourceKind = keyof typeof sourceKinds
const reviewLabel = /^review:([a-z][a-z-]*)$/
const entrySource = new RegExp(`^(?:(${Object.keys(sourceKinds).join('|')})|review:([a-z][a-z-]*)):(0|[1-9][0-9]*)$`)
const sourceNames = [...Object.keys(sourceKinds), 'review:<seat>'].map(kind => `${kind}:<index>`).join(', ')
// The stage, list and field a source names, and its index, or nothing for a source of another form.
const sourceOf = (source: unknown) => {
  const match = typeof source === 'string' ? entrySource.exec(source) : null
  if (!match) return undefined
  const [, kind, seat, index] = match
  const { label, list, field } = kind ? sourceKinds[kind as SourceKind] : { label: `review:${seat}`, list: 'findings', field: 'finding' }
  return { label, list, field, index: Number(index) }
}
// A run id is one directory name under the session's workflow directory.
const runId = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
const isFile = (path: string) => stat(path).then(found => found.isFile(), () => false)
const exists = (path: string) => stat(path).then(() => true, () => false)
const git = (directory: string, ...command: string[]) =>
  Bun.spawnSync(['git', '-C', directory, ...command], { stdout: 'pipe', stderr: 'pipe' })

// The path of a repository of the --base list under the tree root: a single dot, or segments of
// letters, digits, dots, underscores and hyphens joined by slashes, no segment being one or two
// dots, so a list passes through a shell inside single quotes.
const repositoryPath = (path: unknown) => typeof path === 'string' && (path === '.' ||
  path.split('/').every(segment => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== '.' && segment !== '..'))

// Reads the --base list and checks it against the tree the tool runs in. Every entry names the top
// level of a git repository by a path of the list form, with a full commit ID that repository holds.
// A walk from the tree root, which descends until it meets the top level of a repository and goes no
// deeper there, finds no repository the list leaves out, so no repository of the tree goes unread.
// A partial list names only the repositories a unit changes, in a tree too large to list, and skips
// the walk: nothing then checks the repositories it leaves out.
async function baseRepositories(value: string, partial: boolean): Promise<void> {
  let list: unknown
  try { list = JSON.parse(value) } catch (error) { throw new Error(`--base expects a JSON list of { path, sha }: ${messageOf(error)}`) }
  if (!Array.isArray(list) || !list.length) throw new Error('--base expects a non-empty JSON list of { path, sha }, one per git repository of the tree')
  const listed = new Set<string>()
  for (const entry of list) {
    if (!mapping(entry) || !repositoryPath(entry.path)) {
      throw new Error(`--base names a path of another form: ${JSON.stringify(mapping(entry) ? entry.path : entry)}`)
    }
    const path = entry.path as string
    if (listed.has(path)) throw new Error(`--base names the path ${path} twice`)
    listed.add(path)
    if (typeof entry.sha !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(entry.sha)) {
      throw new Error(`--base carries no full commit ID for ${path}`)
    }
    const top = git(path, 'rev-parse', '--show-toplevel')
    if (top.exitCode !== 0 || top.stdout.toString().trim() !== await realpath(path)) {
      throw new Error(`--base path ${path} is not the top level of a git repository`)
    }
    if (git(path, 'cat-file', '-e', `${entry.sha}^{commit}`).exitCode !== 0) {
      throw new Error(`--base commit ${entry.sha} is not in the repository at ${path}`)
    }
  }
  if (partial) return
  const found: string[] = []
  const walk = async (directory: string) => {
    if (await exists(join(directory, '.git'))) { found.push(directory); return }
    for (const child of await readdir(directory, { withFileTypes: true })) {
      if (child.isDirectory()) await walk(join(directory, child.name))
    }
  }
  await walk('.')
  const missing = found.filter(path => !listed.has(path))
  if (missing.length) throw new Error(`--base leaves out the git repositories at ${missing.join(', ')}`)
}

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

// The spec of the run's unit and its sha256, as the run's launch check printed them: the check of a
// main run or a review pass prints the spec it passed, and the check of a fix run prints the spec its
// list names, so a fix run's own leftovers carry the same spec on.
function parentSpec(results: Map<string, unknown>): { spec: string, sha256: string } {
  const gate = results.get('gate')
  let printed: unknown
  try { printed = mapping(gate) && typeof gate.stdout === 'string' ? JSON.parse(gate.stdout) : undefined } catch { printed = undefined }
  if (mapping(printed) && Object.hasOwn(printed, 'fixList')) {
    if (text(printed.spec) && text(printed.specSha256)) return { spec: printed.spec, sha256: printed.specSha256 }
  } else if (mapping(printed) && text(printed.spec) && text(printed.sha256)) return { spec: printed.spec, sha256: printed.sha256 }
  throw new Error('the launch check of the run printed no spec')
}

// Writes the fix list of a run from its journal: every decision of its last verify stage except a
// cleanup decision, which names work outside the unit, and except an approved correction its fixer
// reported fixed; in a run without a verify stage, every finding of its review seats; then every
// finding of its last roast stage and of its last diff check. The spec is the one the run checked.
async function makeFixList(run: string, transcripts: string) {
  if (!runId.test(run)) throw new Error(`expected a run id: ${run}`)
  const results = await lastResults(await findJournal(transcripts, run))
  const { spec } = parentSpec(results)
  const entries: Mapping[] = []
  const verify = results.get('verify')
  if (mapping(verify) && Array.isArray(verify.decisions)) {
    // The main script keys the approved corrections fix:<n>, in the order of the approve-fix decisions.
    const fix = results.get('fix')
    const fixed = new Set((mapping(fix) && Array.isArray(fix.dispositions) ? fix.dispositions : [])
      .filter(d => mapping(d) && d.disposition === 'fixed').map(d => (d as Mapping).key))
    let approved = 0
    verify.decisions.forEach((decision, index) => {
      const key = mapping(decision) && decision.action === 'approve-fix' ? `fix:${approved++}` : undefined
      if ((mapping(decision) && decision.action === 'cleanup') || (key && fixed.has(key))) return
      entries.push({ source: `verify:${index}`, decision })
    })
  } else {
    for (const [label, result] of results) {
      const seat = reviewLabel.exec(label)?.[1]
      if (seat && mapping(result) && Array.isArray(result.findings)) {
        result.findings.forEach((finding, index) => entries.push({ source: `review:${seat}:${index}`, finding }))
      }
    }
  }
  for (const kind of ['roaster', 'diff'] as const) {
    const { label, list, field } = sourceKinds[kind]
    const result = results.get(label)
    const items = mapping(result) && Array.isArray(result[list]) ? result[list] : []
    items.forEach((item, index) => entries.push({ source: `${kind}:${index}`, [field]: item }))
  }
  if (!entries.length) throw new Error(`run ${run} returned no decision or finding to fix`)
  console.log(Bun.YAML.stringify({ run, spec, entries }, null, 2))
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
  // The entries the list holds, in its order. Each keeps the field its source names.
  const entries: { index: number, source: string, value: Mapping }[] = []
  let specSha256: string | undefined
  if (parsed && shape(fixList, fixListKeys, -1, 'fix list')) {
    const runOK = stringField(fixList, 'run', -1, 'fix list') && runId.test(fixList.run as string)
    if (text(fixList.run) && !runOK) fail(-1, 'fix list.run', 'expected a run id')
    const specOK = stringField(fixList, 'spec', -1, 'fix list')
    if (list(fixList.entries, -1, 'entries')) {
      for (const [index, value] of fixList.entries.entries()) {
        const named = mapping(value) ? sourceOf(value.source) : undefined
        const path = named ? value.source as string : `entry ${index + 1}`
        if (!shape(value, ['source', ...(named ? [named.field] : [])], index, path)) continue
        if (!named) { fail(index, `${path}.source`, `expected ${sourceNames}: ${JSON.stringify(value.source)}`); continue }
        if (entries.some(entry => entry.source === path)) { fail(index, path, `duplicate source ${path}`); continue }
        if (Object.hasOwn(value, named.field) && !mapping(value[named.field])) fail(index, `${path}.${named.field}`, 'expected a mapping')
        entries.push({ index, source: path, value })
      }
    }
    if (runOK) {
      let results: Map<string, unknown> | undefined
      try { results = await lastResults(await findJournal(transcripts, fixList.run as string)) } catch (error) {
        // Every entry rests on the parent run, so its failure is reported against each entry, or
        // against the run itself when no entry could be read.
        if (!entries.length) fail(-1, 'fix list.run', messageOf(error))
        for (const { index, source } of entries) fail(index, source, messageOf(error))
      }
      if (results) {
        // The spec is the one the parent run checked, unchanged since: same path, same bytes.
        if (specOK) {
          try {
            const checked = parentSpec(results)
            if (fixList.spec !== checked.spec) fail(-1, 'fix list.spec', `expected the spec the parent run checked, ${checked.spec}`)
            else if (sha256Of(await readFile(checked.spec)) !== checked.sha256) fail(-1, 'fix list.spec', 'changed since the parent run checked it')
            else specSha256 = checked.sha256
          } catch (error) { fail(-1, 'fix list.spec', messageOf(error)) }
        }
        for (const { index, source, value } of entries) {
          const { label, list: name, field, index: position } = sourceOf(source)!
          if (!results.has(label)) { fail(index, source, `the parent run has no stage labelled ${label}`); continue }
          const result = results.get(label)
          const items = mapping(result) && Array.isArray(result[name]) ? result[name] : undefined
          if (!items) { fail(index, source, `the last ${label} stage returned no ${name} list`); continue }
          if (position >= items.length) { fail(index, source, `index ${position} is outside the ${items.length} ${name} of ${label}`); continue }
          if (Object.hasOwn(value, field) && !Bun.deepEquals(value[field], items[position], true)) {
            fail(index, `${source}.${field}`, `differs from the parent run's journal`)
          }
        }
      }
    }
    // The launch values a fix script received: the spec and the entries this check prints. Each must
    // equal the list's, so what the fix run hands its stages is what the journal holds.
    if (expected !== undefined) {
      let launch: unknown
      try { launch = JSON.parse(expected) } catch (error) { fail(-1, 'launch values', `malformed JSON: ${messageOf(error)}`) }
      if (launch !== undefined && shape(launch, ['spec', 'entries'], -1, 'launch values')) {
        if (launch.spec !== fixList.spec) fail(-1, 'launch values.spec', 'differs from the spec of the fix list')
        const launched = new Map<string, Mapping>()
        if (!Array.isArray(launch.entries)) fail(-1, 'launch values.entries', 'expected a list')
        else for (const given of launch.entries) {
          if (!mapping(given) || !text(given.source) || launched.has(given.source)) {
            fail(-1, 'launch values.entries', `expected a mapping with a unique source: ${JSON.stringify(given)}`)
          } else launched.set(given.source, given)
        }
        for (const { index, source, value } of entries) {
          const given = launched.get(source)
          if (!given) fail(index, source, 'missing from the launch values')
          else if (!Bun.deepEquals(given, value, true)) fail(index, source, 'differs from the launch values')
        }
        const listed = new Set(entries.map(({ source }) => source))
        for (const source of launched.keys()) {
          if (!listed.has(source)) fail(-1, 'launch values.entries', `${source} is not an entry of the fix list`)
        }
      }
    }
  }
  if (report()) return
  const { run, spec } = fixList as Mapping
  const summary = {
    entries: entries.map(({ value }) => value),
    run,
    spec,
    specSha256,
    sha256: sha256Of(bytes!),
    proof: freshProof(),
    fixList: file,
  }
  console.log(json ? JSON.stringify(summary) :
    `entries=${summary.entries.length} run=${summary.run} spec=${summary.spec} sha256=${summary.sha256} proof=${summary.proof} fixList=${summary.fixList}`)
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
