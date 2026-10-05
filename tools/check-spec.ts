import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { fromMarkdown } from 'mdast-util-from-markdown@2.0.3'
import { fingerprint } from './fingerprint.js'

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
  '[--json] [--base <JSON list of { path, sha }> [--partial-base]] [--proof <proof>], ' +
  'or bun tools/check-spec.ts --fix-list <file> [--json [--entries]] ' +
  '[--base <JSON list of { path, sha }> [--partial-base]] [--proof <proof>], ' +
  'or bun tools/check-spec.ts --make-fix-list <result> [--size <json>]'

// The proof of the checked values. A workflow script passes the proof of its own launch values, so a
// check of other values fails before the stage that runs it edits anything.
function proven(values: Mapping, expected: string | undefined) {
  const proof = fingerprint(values)
  if (expected !== undefined && expected !== proof) {
    throw new Error(`the checked values give the proof ${proof}, and the run launched with the proof ${expected}`)
  }
  return proof
}

async function main() {
  if (!Bun.YAML?.parse) throw new Error(`Bun ${minimumBun} or newer is required: Bun.YAML is unavailable`)
  const { values, positionals } = parseArgs({ args: Bun.argv.slice(2), allowPositionals: true,
    options: { transcripts: { type: 'string' }, json: { type: 'boolean' }, base: { type: 'string' }, 'partial-base': { type: 'boolean' },
      'fix-list': { type: 'string' }, entries: { type: 'boolean' }, 'make-fix-list': { type: 'string' }, size: { type: 'string' },
      proof: { type: 'string' } } })
  if (values['make-fix-list'] !== undefined) {
    if (positionals.length || !values['make-fix-list'] || values.transcripts !== undefined || values.base || values['partial-base'] ||
      values['fix-list'] !== undefined || values.entries || values.json || values.proof !== undefined) {
      throw new Error(usage)
    }
    return makeFixList(values['make-fix-list'], values.size)
  }
  if (values.size !== undefined || (values['partial-base'] && values.base === undefined)) throw new Error(usage)
  const partialBase = values['partial-base'] === true
  if (values['fix-list'] !== undefined) {
    if (positionals.length || !values['fix-list'] || values.transcripts !== undefined || (values.entries && !values.json)) throw new Error(usage)
    const base = values.base === undefined ? null : await baseRepositories(values.base, partialBase)
    return checkFixList(values['fix-list'],
      { json: values.json === true, withEntries: values.entries === true, base, partialBase, expected: values.proof })
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
  // The text of every entry: the width rule checks it and the size check counts its non-blank lines.
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
    // The spec lines the size check divides by: the non-blank lines of the entries' text.
    specLines,
    unbreakable: unbreakableLines,
    // The base list is checked against the tree the tool runs in, so the proof covers that tree too.
    proof: proven({ spec: specPath, transcripts, base, partialBase, tree: process.cwd() }, values.proof),
    spec: specPath,
  }
  console.log(values.json ? JSON.stringify(summary) :
    `sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} specLines=${summary.specLines} ` +
    `unbreakable=${JSON.stringify(summary.unbreakable)} proof=${summary.proof} spec=${summary.spec}`)
}

const fixListKeys = ['result', 'spec', 'entries']
const itemFields = { impl: 'finding', verify: 'decision', issue: 'issue', roaster: 'finding', diff: 'finding', proof: 'proof' } as const
const entrySource = new RegExp(`^(?:(?<kind>${Object.keys(itemFields).join('|')}|entry|review:[a-z][a-z-]*):(?:0|[1-9][0-9]*)|size)$`)
const sourceNames = [...Object.keys(itemFields), 'review:<seat>', 'entry'].map(kind => `${kind}:<index>`).concat('size').join(', ')
const fields: Record<string, string> = { ...itemFields, entry: 'entry', size: 'size' }
const sourceOf = (source: unknown): { source: string, field: string } | undefined => {
  const kind = typeof source === 'string' ? (entrySource.exec(source)?.groups?.kind ?? (source === 'size' ? 'size' : undefined)) : undefined
  if (typeof source !== 'string' || kind === undefined) return undefined
  return { source, field: kind.startsWith('review:') ? 'finding' : fields[kind] }
}
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

type Sha256 = string & { readonly brand: 'Sha256' }
type SpecLineCount = number & { readonly brand: 'SpecLineCount' }
const sha256Form = (value: unknown): value is Sha256 => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
// A spec that passes its check holds at least one user entry with text, so it counts at least one line.
const specLineCount = (value: unknown): value is SpecLineCount => Number.isSafeInteger(value) && Number(value) > 0
type CheckedSpec = { path: string, sha256: Sha256, lines: SpecLineCount }
type Entry = Mapping & { source: string }
type Artifact = { path: string, what: string }
type Snapshot = { path: string, sha: string }
// snapshots is null after a review pass, which reviews the tree as it is and leaves no snapshot.
type Returned = { spec: CheckedSpec | null, entries: Entry[], artifacts: Artifact[], snapshots: Snapshot[] | null }
const commitId = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/

function checkedSpec(spec: unknown): CheckedSpec | null {
  if (spec === null) return null
  if (mapping(spec) && text(spec.path) && sha256Form(spec.sha256) && specLineCount(spec.lines)) {
    return { path: spec.path, sha256: spec.sha256, lines: spec.lines }
  }
  throw new Error('the run result names the spec its check passed on in another form')
}

const returnedItem = (value: unknown) => {
  if (!mapping(value)) return false
  const named = sourceOf(value.source)
  return named !== undefined && named.source !== 'size' && Object.keys(value).length === 2 && mapping(value[named.field])
}

const artifact = (value: unknown): value is Artifact => mapping(value) && Object.keys(value).length === 2 &&
  typeof value.path === 'string' && typeof value.what === 'string'
const snapshot = (value: unknown): value is Snapshot => mapping(value) && Object.keys(value).length === 2 &&
  repositoryPath(value.path) && typeof value.sha === 'string' && commitId.test(value.sha)
const snapshotList = (value: unknown): value is Snapshot[] => Array.isArray(value) && value.length > 0 &&
  value.every(snapshot) && new Set(value.map(({ path }) => path)).size === value.length

// The exit of a run names only the first cause that ended it, so a later cause shows only as its item
// in remaining. A run whose remaining list holds an item of one of these kinds gets no fix list.
const refusedKinds: { kind: string, refusal: string, describe: (item: Mapping) => string }[] = [
  { kind: 'stage-failure', refusal: 'a stage of the run failed, and an incomplete run gets no fix list',
    describe: item => `${String(item.label)}: ${String(item.message)}` },
  { kind: 'abort', refusal: "a stage of the run raised a hard flag, and only a new run that receives the user's answer continues the unit",
    describe: item => `${String(item.label)}: ${String(mapping(item.abort) ? item.abort.reason : item.abort)}` },
  { kind: 'writer-scope', refusal: 'a writer commit left its scope, and no fix run builds on the snapshot that holds it',
    describe: item => `${String(item.repository)} ${String(item.sha)}: ${String(item.note)}` },
]
const remainingOfKind = (remaining: unknown[], kind: string, describe: (item: Mapping) => string) => remaining
  .filter((entry): entry is Mapping => mapping(entry) && entry.kind === kind)
  .map(({ item }) => mapping(item) ? describe(item) : JSON.stringify(item))

// Runs of an earlier version of the scripts return neither toFix nor artifacts.
const earlierVersion = 'as a run of an earlier version of the scripts returns: finish its chain of fix runs as the skill, ' +
  'the spec tool and the scripts of the newest plugin version below 0.42.0 in the plugin cache say'

// The workflow tool saves what a script returns in its output file under the key result.
async function readSavedRunResult(file: string): Promise<Returned> {
  let output: unknown
  try { output = JSON.parse(await readFile(file, 'utf8')) } catch (error) {
    throw new Error(`the run result ${file} is unreadable or no JSON: ${messageOf(error)}`)
  }
  const result = mapping(output) ? output.result : undefined
  if (!mapping(result)) throw new Error(`${file} holds no run result`)
  if (!Array.isArray(result.remaining)) throw new Error('the run result holds no remaining list')
  for (const { kind, refusal, describe } of refusedKinds) {
    const found = remainingOfKind(result.remaining, kind, describe)
    if (found.length) throw new Error(`${refusal}: ${found.join('; ')}`)
  }
  if (!Array.isArray(result.toFix)) throw new Error(`the run result holds no toFix list, ${earlierVersion}`)
  if (!Array.isArray(result.artifacts)) throw new Error(`the run result holds no artifacts list, ${earlierVersion}`)
  const strange = result.artifacts.findIndex(item => !artifact(item))
  if (strange >= 0) throw new Error(`the run result holds artifact ${strange + 1} in another form`)
  const snapshots: unknown = result.snapshots
  if (snapshots !== null && !snapshotList(snapshots)) {
    throw new Error('the run result holds its final snapshots in another form: null, or one { path, sha } per repository')
  }
  const items: unknown[] = result.toFix
  const malformed = items.findIndex(item => !returnedItem(item))
  if (malformed >= 0) throw new Error(`the run result holds item ${malformed + 1} of toFix in another form`)
  const seen = new Set<string>()
  for (const { source } of items as Entry[]) {
    if (seen.has(source)) throw new Error(`the run result holds the source ${source} twice in toFix`)
    seen.add(source)
  }
  return { spec: checkedSpec(result.spec), entries: items as Entry[], artifacts: result.artifacts as Artifact[], snapshots }
}

// A fix run starts from the parent run's final snapshots, so a base list naming any other commit,
// even one the tree holds, is refused. A review pass returns no snapshots: the fix run of one starts
// from the commit each repository is at, and only the check against the tree covers its base list.
function baseProblems(base: Snapshot[], snapshots: Snapshot[] | null): string[] {
  if (snapshots === null) return []
  const final = new Map(snapshots.map(({ path, sha }) => [path, sha]))
  const listed = new Set(base.map(({ path }) => path))
  return [
    ...base.filter(({ path }) => !final.has(path))
      .map(({ path }) => `--base names the repository at ${path}, of which the parent run returned no final snapshot`),
    ...base.filter(({ path, sha }) => final.has(path) && final.get(path) !== sha)
      .map(({ path, sha }) => `--base names commit ${sha} at ${path}, and the parent run's final snapshot there is ${final.get(path)}`),
    ...snapshots.filter(({ path }) => !listed.has(path))
      .map(({ path }) => `--base leaves out the repository at ${path}, of which the parent run returned its final snapshot`),
  ]
}

// A size breach is measured after the run, against the spec lines the parent run's spec check counted.
const sizeKeys = ['specLines', 'codeAdded', 'repositories']
const measuredKeys = ['path', 'base', 'candidate']
const measuredRepository = (value: unknown) => mapping(value) &&
  Object.keys(value).length === measuredKeys.length && measuredKeys.every(key => Object.hasOwn(value, key)) &&
  repositoryPath(value.path) && typeof value.base === 'string' && commitId.test(value.base) &&
  typeof value.candidate === 'string' && commitId.test(value.candidate)
const uncounted = 'the parent run counted no spec lines to measure a size breach against'
function sizeProblems(size: unknown, specLines: number): string[] {
  if (!mapping(size)) return ['expected a mapping']
  const problems = [
    ...Object.keys(size).filter(key => !sizeKeys.includes(key)).map(key => `${key}: unknown key`),
    ...sizeKeys.filter(key => !Object.hasOwn(size, key)).map(key => `${key}: missing field`),
  ]
  if (Object.hasOwn(size, 'specLines') && size.specLines !== specLines) {
    problems.push(`specLines: expected ${specLines}, the spec lines the parent run's spec check counted`)
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

// Fix runs read the saved result from another worktree.
async function makeFixList(file: string, size?: string) {
  const { spec, entries } = await readSavedRunResult(file)
  if (size !== undefined) {
    const expects = '--size expects a JSON mapping of codeAdded and repositories'
    let measured: unknown
    try { measured = JSON.parse(size) } catch (error) { throw new Error(`${expects}: ${messageOf(error)}`) }
    if (!mapping(measured)) throw new Error(expects)
    const specLines = spec?.lines
    if (specLines === undefined) throw new Error(`--size: ${uncounted}`)
    const breach = { specLines, ...measured }
    const problems = sizeProblems(breach, specLines)
    if (problems.length) throw new Error(`--size: ${problems.join('; ')}`)
    entries.push({ source: 'size', size: breach })
  }
  if (!entries.length) throw new Error('the run returned nothing to fix')
  console.log(Bun.YAML.stringify({ result: resolve(file), spec: spec?.path ?? null, entries }, null, 2))
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

async function compareWithResult({ fail }: Validator, file: string, spec: string | null | undefined, entries: ListedEntry[]) {
  let held: Returned
  try { held = await readSavedRunResult(file) } catch (error) {
    if (!entries.length) fail(-1, 'fix list.result', messageOf(error))
    for (const { index, source } of entries) fail(index, source, messageOf(error))
    return
  }
  const checked = held.spec?.path ?? null
  if (spec !== undefined && spec !== checked) {
    fail(-1, 'fix list.spec', checked === null ? 'expected null, because the parent run checked no spec'
      : `expected the spec the parent run checked, ${checked}`)
  } else if (spec !== undefined && held.spec) {
    try {
      if (sha256Of(await readFile(held.spec.path)) !== held.spec.sha256) fail(-1, 'fix list.spec', 'changed since the parent run checked it')
    } catch (error) { fail(-1, 'fix list.spec', messageOf(error)) }
  }
  const items = new Map(held.entries.map(entry => [entry.source, entry]))
  for (const { index, source, field, value } of entries) {
    if (source === 'size') {
      const specLines = held.spec?.lines
      if (specLines === undefined) fail(index, 'size', uncounted)
      else for (const problem of sizeProblems(value.size, specLines)) fail(index, 'size', problem)
      continue
    }
    const item = items.get(source)
    if (!item) fail(index, source, 'the parent run returned no item to fix under this source')
    else if (Object.hasOwn(value, field) && !Bun.deepEquals(value[field], item[field], true)) {
      fail(index, `${source}.${field}`, "differs from the parent run's result")
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
  return held
}

type FixListOptions = { json: boolean, withEntries: boolean, base: unknown[] | null, partialBase: boolean, expected?: string }

async function checkFixList(file: string, { json, withEntries, base, partialBase, expected }: FixListOptions) {
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
  let parent: Returned | undefined
  if (parsed && shape(fixList, fixListKeys, -1, 'fix list')) {
    const { result, spec } = fixList
    stringField(fixList, 'result', -1, 'fix list')
    if (spec !== null) stringField(fixList, 'spec', -1, 'fix list')
    if (list(fixList.entries, -1, 'entries')) {
      const seen = new Set<string>()
      fixList.entries.forEach((value, index) => {
        const listed = listedEntry(checks, value, index, seen)
        if (listed) entries.push(listed)
      })
    }
    if (text(result)) parent = await compareWithResult(checks, result, spec === null || text(spec) ? spec : undefined, entries)
  }
  if (report()) return
  if (!parent) throw new Error('the fix list passed without what its parent run checked')
  const mismatches = base ? baseProblems(base as Snapshot[], parent.snapshots) : []
  if (mismatches.length) throw new Error(mismatches.join('; '))
  const listed = entries.map(({ value }) => value)
  const spec = parent.spec?.path ?? null
  const { artifacts } = parent
  // The entries appear only with --entries, because the fixer returns the output whole.
  const summary = {
    ...(withEntries ? { entries: listed } : {}),
    result: (fixList as Mapping).result,
    spec,
    ...(parent.spec ? { specSha256: parent.spec.sha256, specLines: parent.spec.lines } : {}),
    artifacts,
    ...(base ? { base } : {}),
    sha256: sha256Of(bytes!),
    proof: proven({ fixList: file, spec, entries: listed, artifacts, base, partialBase, tree: process.cwd() }, expected),
    fixList: file,
  }
  console.log(json ? JSON.stringify(summary) :
    `entries=${listed.length} result=${summary.result} spec=${summary.spec} sha256=${summary.sha256} proof=${summary.proof} fixList=${summary.fixList}`)
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
