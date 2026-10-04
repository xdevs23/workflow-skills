import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { fromMarkdown } from 'mdast-util-from-markdown@2.0.3'
import { fingerprint } from './fingerprint.js'
import { checkDiffResult, checkFixerResult, hasHardFlag } from './fix-run-checks.js'

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
  'or bun tools/check-spec.ts --fix-list <file> --transcripts <dir> [--json [--entries]] ' +
  '[--base <JSON list of { path, sha }> [--partial-base]], ' +
  'or bun tools/check-spec.ts --make-fix-list <run> --transcripts <dir> [--size <json>]'

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, json: { type: 'boolean' }, base: { type: 'string' }, 'partial-base': { type: 'boolean' },
      'fix-list': { type: 'string' }, entries: { type: 'boolean' }, 'make-fix-list': { type: 'string' }, size: { type: 'string' } } })
  if (values['make-fix-list'] !== undefined) {
    if (positionals.length || !values['make-fix-list'] || !values.transcripts || values.base || values['partial-base'] ||
      values['fix-list'] !== undefined || values.entries || values.json) {
      throw new Error(usage)
    }
    return makeFixList(values['make-fix-list'], values.transcripts, values.size)
  }
  if (values.size !== undefined || (values['partial-base'] && values.base === undefined)) throw new Error(usage)
  const partialBase = values['partial-base'] === true
  if (values['fix-list'] !== undefined) {
    if (positionals.length || !values['fix-list'] || !values.transcripts || (values.entries && !values.json)) throw new Error(usage)
    const base = values.base === undefined ? null : await baseRepositories(values.base, partialBase)
    return checkFixList(values['fix-list'], values.transcripts, { json: values.json === true, withEntries: values.entries === true, base, partialBase })
  }
  if (positionals.length !== 1 || !values.transcripts || values.entries) throw new Error(usage)
  const base = values.base === undefined ? null : await baseRepositories(values.base, partialBase)
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
    // The base list is checked against the tree the tool runs in, so the proof covers that tree too.
    proof: fingerprint({ spec: specPath, transcripts, base, partialBase, tree: process.cwd() }),
    spec: specPath,
  }
  console.log(values.json ? JSON.stringify(summary) :
    `sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} specLines=${summary.specLines} ` +
    `unbreakable=${JSON.stringify(summary.unbreakable)} proof=${summary.proof} spec=${summary.spec}`)
}

// A fix list holds everything one earlier run returned to be fixed, each item as the run's journal
// holds it, and names the spec of the unit the run belongs to, which the fix run reads for the user's
// words. A fix list is never written from a spec, and the two never mix: each mode refuses the keys
// of the other.
const fixListKeys = ['run', 'spec', 'entries']
// The sources that name an item in the last result of one stage of the run: the stage label, the
// list in that result and the field an entry holds the item under.
const stageSources = {
  impl: { label: 'impl', list: 'specFindings', field: 'finding' },
  verify: { label: 'verify', list: 'decisions', field: 'decision' },
  issue: { label: 'verify', list: 'issues', field: 'issue' },
  roaster: { label: 'roast', list: 'findings', field: 'finding' },
  diff: { label: 'diff', list: 'findings', field: 'finding' },
} as const
type StageSource = keyof typeof stageSources
const reviewLabel = /^review:([a-z][a-z-]*)$/
// Beside the stage sources, review:<seat>:<index> names a finding of a review seat, entry:<index> an
// entry of a fix run's own list that its fixer left open, and size the measured size breach of the
// unit, which no stage returns.
const entrySource = new RegExp(`^(?:(?<kind>${Object.keys(stageSources).join('|')}|entry|review:[a-z][a-z-]*):(?:0|[1-9][0-9]*)|size)$`)
const sourceNames = [...Object.keys(stageSources), 'review:<seat>', 'entry'].map(kind => `${kind}:<index>`).concat('size').join(', ')
// The field an entry holds its item under, by the kind of its source.
const fields: Record<string, string> = {
  ...Object.fromEntries(Object.entries(stageSources).map(([kind, { field }]) => [kind, field])), entry: 'entry', size: 'size' }
const sourceOf = (source: unknown): { source: string, field: string } | undefined => {
  const kind = typeof source === 'string' ? (entrySource.exec(source)?.groups?.kind ?? (source === 'size' ? 'size' : undefined)) : undefined
  if (typeof source !== 'string' || kind === undefined) return undefined
  return { source, field: kind.startsWith('review:') ? 'finding' : fields[kind] }
}
const listIn = (result: unknown, list: string): unknown[] => mapping(result) && Array.isArray(result[list]) ? result[list] : []
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
async function baseRepositories(value: string, partial: boolean): Promise<unknown[]> {
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
  if (partial) return list
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
  return list
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

type Launch = { spec: string, specSha256: string, specLines?: number, fixList?: { path: string, sha256: string }, base?: unknown[] }
type Entry = Mapping & { source: string }

// What the launch check of a run printed. The spec check of a main run or a review pass prints the
// spec it passed; the check of a fix run prints its own fix list and the spec that list names, so the
// spec carries on from run to run, beside the base list the fix run started from. The fix-list check
// of an earlier version of this tool printed no spec lines and no base list, so a fix run it launched
// carries no spec lines on and has no base list to check its fixer's result against.
function launchOf(results: Map<string, unknown>): Launch {
  const gate = results.get('gate')
  let printed: unknown
  try { printed = mapping(gate) && typeof gate.stdout === 'string' ? JSON.parse(gate.stdout) : undefined } catch { printed = undefined }
  if (mapping(printed) && text(printed.spec)) {
    const { spec, specLines, sha256, specSha256, fixList, base } = printed
    const counted = Number.isSafeInteger(specLines) ? { specLines: Number(specLines) } : undefined
    if (!Object.hasOwn(printed, 'fixList')) {
      if (text(sha256) && counted) return { spec, specSha256: sha256, ...counted }
    } else if (text(fixList) && text(specSha256) && text(sha256) && (counted || specLines === undefined)) {
      return { spec, specSha256, ...counted, fixList: { path: fixList, sha256 }, ...(Array.isArray(base) ? { base } : {}) }
    }
  }
  throw new Error('the launch check of the run printed no spec')
}

// The entries of the fix list a fix run launched on, unchanged since its launch check read them.
async function launchedEntries({ path, sha256 }: { path: string, sha256: string }): Promise<unknown[]> {
  const bytes = await readFile(path)
  if (sha256Of(bytes) !== sha256) throw new Error(`the fix list ${path} changed since the run's launch check read it`)
  const list: unknown = Bun.YAML.parse(bytes.toString('utf8'))
  if (!mapping(list) || !Array.isArray(list.entries)) throw new Error(`the fix list ${path} holds no entries`)
  return list.entries
}

// A fix run's fixer closes an entry by rejecting it, by raising it as a question for the user, or by a
// fix its run's diff check mapped a change to. Every other entry stays open.
const closed = (disposition: unknown, mapped: boolean) =>
  disposition === 'rejected' || disposition === 'question' || (disposition === 'fixed' && mapped)

// The journal holds the last result of a stage whether or not its run accepted it, so a result counts
// only when it carries no hard flag and passes the checks the fix run applies to it.
function acceptedResult(result: unknown, check: (result: unknown) => void): unknown {
  if (hasHardFlag(result)) return undefined
  try { check(result) } catch { return undefined }
  return result
}

// Everything a run returned to be fixed, as its journal holds it: the implementer's spec findings;
// every decision and every unresolved issue of the finding verifier, or, in a run without a verify
// stage such as a review pass, every finding of the review seats; in a fix run, every entry of its own
// list its fixer left open; and every finding of the roaster and of the diff check.
async function returned(run: string, transcripts: string): Promise<{ launch: Launch, entries: Entry[] }> {
  const results = await lastResults(await findJournal(transcripts, run))
  const launch = launchOf(results)
  const entries: Entry[] = []
  const take = (kind: string, field: string, items: unknown[]) =>
    items.forEach((item, index) => entries.push({ source: `${kind}:${index}`, [field]: item }))
  const fromStage = (kind: StageSource) => {
    const { label, list, field } = stageSources[kind]
    take(kind, field, listIn(results.get(label), list))
  }
  fromStage('impl')
  fromStage('verify')
  fromStage('issue')
  if (!results.has('verify')) {
    for (const [label, result] of results) {
      const seat = reviewLabel.exec(label)?.[1]
      if (seat) take(`review:${seat}`, 'finding', listIn(result, 'findings'))
    }
  }
  if (launch.fixList) {
    const launched = await launchedEntries(launch.fixList)
    const keys = launched.map(entry => mapping(entry) ? entry.source : undefined)
    // Without the base list the fixer started from, its result cannot be checked and closes no entry.
    const { base } = launch
    const fix = base && acceptedResult(results.get('fix'), result => checkFixerResult(result, keys, base))
    const diff = fix && acceptedResult(results.get('diff'), result => checkDiffResult(result, keys))
    const dispositions = new Map(listIn(fix, 'dispositions').filter(mapping).map(d => [d.key, d.disposition]))
    const mapped = new Set(listIn(diff, 'mappings').filter(mapping).map(m => m.source))
    launched.forEach((entry, index) => {
      const source = mapping(entry) ? entry.source : undefined
      if (!closed(dispositions.get(source), mapped.has(source))) entries.push({ source: `entry:${index}`, entry })
    })
  }
  fromStage('roaster')
  fromStage('diff')
  return { launch, entries }
}

// A size breach of the unit, measured after the run: the implementation lines its candidate added
// over the base in each repository, beside the spec lines the parent run's launch check counted.
const sizeKeys = ['specLines', 'codeAdded', 'repositories']
const measuredKeys = ['path', 'base', 'candidate']
const commitId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
const measuredRepository = (value: unknown) => mapping(value) &&
  Object.keys(value).length === measuredKeys.length && measuredKeys.every(key => Object.hasOwn(value, key)) &&
  repositoryPath(value.path) && typeof value.base === 'string' && commitId.test(value.base) &&
  typeof value.candidate === 'string' && commitId.test(value.candidate)
const uncounted = "the parent run's launch check printed no spec lines to measure a size breach against"
function sizeProblems(size: unknown, specLines: number): string[] {
  if (!mapping(size)) return ['expected a mapping']
  const problems = [
    ...Object.keys(size).filter(key => !sizeKeys.includes(key)).map(key => `${key}: unknown key`),
    ...sizeKeys.filter(key => !Object.hasOwn(size, key)).map(key => `${key}: missing field`),
  ]
  if (Object.hasOwn(size, 'specLines') && size.specLines !== specLines) {
    problems.push(`specLines: expected ${specLines}, the spec lines the parent run's launch check counted`)
  }
  if (Object.hasOwn(size, 'codeAdded') && !(Number.isSafeInteger(size.codeAdded) && Number(size.codeAdded) >= 0)) {
    problems.push('codeAdded: expected the count of implementation lines added')
  }
  if (Object.hasOwn(size, 'repositories') && !(Array.isArray(size.repositories) && size.repositories.length &&
    size.repositories.every(measuredRepository))) {
    problems.push('repositories: expected a non-empty list of { path, base, candidate } with full commit IDs')
  }
  return problems
}

async function makeFixList(run: string, transcripts: string, size?: string) {
  if (!runId.test(run)) throw new Error(`expected a run id: ${run}`)
  const { launch, entries } = await returned(run, transcripts)
  if (size !== undefined) {
    const expects = '--size expects a JSON mapping of codeAdded and repositories'
    let measured: unknown
    try { measured = JSON.parse(size) } catch (error) { throw new Error(`${expects}: ${messageOf(error)}`) }
    if (!mapping(measured)) throw new Error(expects)
    if (launch.specLines === undefined) throw new Error(`--size: ${uncounted}`)
    const breach = { specLines: launch.specLines, ...measured }
    const problems = sizeProblems(breach, launch.specLines)
    if (problems.length) throw new Error(`--size: ${problems.join('; ')}`)
    entries.push({ source: 'size', size: breach })
  }
  if (!entries.length) throw new Error(`run ${run} returned nothing to fix`)
  console.log(Bun.YAML.stringify({ run, spec: launch.spec, entries }, null, 2))
}

type Validator = ReturnType<typeof validator>
type ListedEntry = { index: number, source: string, field: string, value: Mapping }

// One entry of the list by its shape alone: a mapping with a source of a known form, the one field
// that source names and no source a former entry already holds.
function listedEntry({ fail, shape }: Validator, value: unknown, index: number, seen: Set<string>): ListedEntry | undefined {
  if (!mapping(value)) { fail(index, `entry ${index + 1}`, 'expected a mapping'); return }
  const named = sourceOf(value.source)
  if (!named) {
    shape(value, ['source'], index, `entry ${index + 1}`)
    fail(index, `entry ${index + 1}.source`, `expected ${sourceNames}: ${JSON.stringify(value.source)}`)
    return
  }
  const { source, field } = named
  shape(value, ['source', field], index, source)
  if (seen.has(source)) { fail(index, source, `duplicate source ${source}`); return }
  seen.add(source)
  if (Object.hasOwn(value, field) && !mapping(value[field])) fail(index, `${source}.${field}`, 'expected a mapping')
  return { index, source, field, value }
}

// Holds the list to what the parent run returned to be fixed: every entry the run returned, each as
// its journal holds it and in the order the generator writes it, nothing else beside a size breach of
// the unit, which comes last, and the spec the run checked, unchanged since. Returns what the run's
// launch check printed.
async function compareWithRun({ fail }: Validator, transcripts: string, run: string, spec: string | undefined, entries: ListedEntry[]) {
  let held: Awaited<ReturnType<typeof returned>>
  try { held = await returned(run, transcripts) } catch (error) {
    // Every entry rests on the parent run, so its failure is reported against each entry, or against
    // the run itself when no entry could be read.
    if (!entries.length) fail(-1, 'fix list.run', messageOf(error))
    for (const { index, source } of entries) fail(index, source, messageOf(error))
    return
  }
  const { launch } = held
  if (spec !== undefined && spec !== launch.spec) fail(-1, 'fix list.spec', `expected the spec the parent run checked, ${launch.spec}`)
  else if (spec !== undefined) {
    try {
      if (sha256Of(await readFile(launch.spec)) !== launch.specSha256) fail(-1, 'fix list.spec', 'changed since the parent run checked it')
    } catch (error) { fail(-1, 'fix list.spec', messageOf(error)) }
  }
  const items = new Map(held.entries.map(entry => [entry.source, entry]))
  for (const { index, source, field, value } of entries) {
    if (source === 'size') {
      if (launch.specLines === undefined) fail(index, 'size', uncounted)
      else for (const problem of sizeProblems(value.size, launch.specLines)) fail(index, 'size', problem)
      continue
    }
    const item = items.get(source)
    if (!item) fail(index, source, 'the parent run returned no item to fix under this source')
    else if (Object.hasOwn(value, field) && !Bun.deepEquals(value[field], item[field], true)) {
      fail(index, `${source}.${field}`, "differs from the parent run's journal")
    }
  }
  const listed = new Set(entries.map(({ source }) => source))
  for (const { source } of held.entries) {
    if (!listed.has(source)) fail(entries.length, source, 'missing, and the parent run returned it to be fixed')
  }
  const order = [...held.entries.map(({ source }) => source), 'size']
  const expected = order.filter(source => listed.has(source))
  const known = entries.filter(({ source }) => order.includes(source))
  const position = known.findIndex(({ source }, at) => source !== expected[at])
  if (position >= 0) {
    fail(known[position].index, known[position].source, `out of order: the parent run returned ${expected[position]} in this place`)
  }
  return launch
}

type FixListOptions = { json: boolean, withEntries: boolean, base: unknown[] | null, partialBase: boolean }

async function checkFixList(file: string, transcripts: string, { json, withEntries, base, partialBase }: FixListOptions) {
  const checks = validator(file)
  const { fail, shape, stringField, list, report } = checks
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
  const entries: ListedEntry[] = []
  let launch: Launch | undefined
  if (parsed && shape(fixList, fixListKeys, -1, 'fix list')) {
    const { run, spec } = fixList
    if (stringField(fixList, 'run', -1, 'fix list') && text(run) && !runId.test(run)) fail(-1, 'fix list.run', 'expected a run id')
    stringField(fixList, 'spec', -1, 'fix list')
    if (list(fixList.entries, -1, 'entries')) {
      const seen = new Set<string>()
      fixList.entries.forEach((value, index) => {
        const listed = listedEntry(checks, value, index, seen)
        if (listed) entries.push(listed)
      })
    }
    if (text(run) && runId.test(run)) launch = await compareWithRun(checks, transcripts, run, text(spec) ? spec : undefined, entries)
  }
  if (report()) return
  if (!launch) throw new Error('the fix list passed without the launch output of its parent run')
  const listed = entries.map(({ value }) => value)
  // The entries appear only on request, because the launch check's stage returns the output whole. The
  // base list was checked against the tree the tool runs in, so the proof covers that tree too, and a
  // fix run's launch output carries the base list on to the check of its fixer's result.
  const summary = {
    ...(withEntries ? { entries: listed } : {}),
    run: (fixList as Mapping).run,
    spec: launch.spec,
    specSha256: launch.specSha256,
    specLines: launch.specLines,
    ...(base ? { base } : {}),
    sha256: sha256Of(bytes!),
    proof: fingerprint({ fixList: file, transcripts, spec: launch.spec, entries: listed, base, partialBase, tree: process.cwd() }),
    fixList: file,
  }
  console.log(json ? JSON.stringify(summary) :
    `entries=${listed.length} run=${summary.run} spec=${summary.spec} sha256=${summary.sha256} proof=${summary.proof} fixList=${summary.fixList}`)
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
