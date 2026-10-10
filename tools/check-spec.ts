import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream'
import { parseArgs } from 'node:util'
import { fromMarkdown } from 'mdast-util-from-markdown@2.0.3'
import split from 'split2@4.2.0'
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
// queued_command. Commands of other origins are queued the same way, so the origin kind human
// marks the user's words, as does an origin-less entry queued from a prompt of a session hosted
// through the Agent SDK when the entry's attachment carries this command mode.
const queuedCommand = (record: Mapping): record is Mapping & { attachment: Mapping } =>
  record.type === 'attachment' && mapping(record.attachment) && record.attachment.type === 'queued_command'
// A queued prompt is a string, or a block array when the message carries an image beside its text.
const promptText = (prompt: unknown) => {
  if (typeof prompt === 'string') return withoutReminders(prompt)
  if (Array.isArray(prompt)) return withoutReminders(textBlocks(prompt))
  throw new Error('attachment.prompt must be a string or block array')
}
const queuedPromptMode = 'prompt'
const queuedText = (record: Mapping & { attachment: Mapping }) => {
  const { origin, prompt, commandMode } = record.attachment
  const kind = mapping(origin) ? origin.kind : undefined
  const queuedPrompt = origin === undefined && commandMode === queuedPromptMode
  if (kind !== 'human' && !queuedPrompt) {
    const why = kind !== undefined
      ? `origin ${JSON.stringify(kind)}`
      : `origin ${JSON.stringify(null)} and command mode ${JSON.stringify(commandMode ?? null)}`
    throw new Error(`a queued command of ${why} is not the user's words`)
  }
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
// A message typed in a session hosted through the Agent SDK carries no origin. The host marks it
// with this value as both its prompt source and its turn origin.
const sdkHost = 'sdk'
const sdkPrompt = (record: Mapping) => record.promptSource === sdkHost && record.turnOrigin === sdkHost
const parseRecord = (line: string): Mapping | undefined => {
  try { const record = JSON.parse(line); return mapping(record) ? record : undefined } catch { return undefined }
}
const sha256Of = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

// The record at a line of a transcript, with the ids of the question-dialog calls asked before it.
async function readCited(transcripts: string, reference: Mapping) {
  const input = createReadStream(resolve(transcripts, reference.file as string))
  // A record ends only at a newline, never at U+2028 or U+2029, which a JSON string may hold unescaped.
  const lines = pipeline(input, split(/\r?\n/), () => {})
  let cited: unknown, found = false, current = 0
  const asked = new Set<string>()
  try {
    for await (const line of lines) {
      if (++current === reference.line) { cited = JSON.parse(line); found = true; break }
      if (!line.includes(dialogTool)) continue
      const earlier = parseRecord(line)
      if (earlier?.type === 'assistant') for (const call of dialogCalls(earlier)) asked.add(call.id as string)
    }
  } finally { input.destroy() }
  if (!found) throw new Error('line is outside the transcript')
  return { cited, asked }
}

// The words of the user a cited record holds. A tool result holds them only as the answers to a
// dialog call asked before it; a record that is not a message the user wrote throws. An injected
// meta record or a record of any origin other than human throws before its tool result is read. A
// dialog answer carries no origin, so a tool result without one is read. A message without an
// origin counts only as a typed prompt of an SDK-hosted session.
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
  if (!humanOrigin(cited.origin) && !sdkPrompt(cited)) throw foreign()
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

// Each failure is recorded with the position of the entry it concerns, so the report keeps file
// order, and with a path that names the entry.
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
  '[--json] [--base <JSON list of { path, sha }> [--partial-base]] [--sha256 <sha256>] [--proof <proof>], ' +
  'or bun tools/check-spec.ts --base <JSON list of { path, sha }> [--partial-base] [--json] [--proof <proof>]'

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
      sha256: { type: 'string' }, proof: { type: 'string' } } })
  if (values['partial-base'] && values.base === undefined) throw new Error(usage)
  const partialBase = values['partial-base'] === true
  if (!positionals.length && values.transcripts === undefined && values.sha256 === undefined && values.base !== undefined) {
    return checkBase(await baseRepositories(values.base, partialBase), { json: values.json === true, partialBase, expected: values.proof })
  }
  if (positionals.length !== 1 || !values.transcripts) throw new Error(usage)
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
  // A run that reads the spec another run checked names its sha256, so a spec changed since fails here,
  // before the stage that runs the check edits anything.
  const sha256 = sha256Of(bytes!)
  if (values.sha256 !== undefined && values.sha256 !== sha256) {
    throw new Error(`the spec's sha256 is ${sha256}, and the run expects the spec its parent run checked, of sha256 ${values.sha256}`)
  }
  const summary = {
    sha256,
    nonBlankLines: nonBlankLines(bytes!.toString('utf8')),
    // The spec lines the size check divides by: the non-blank lines of the entries' text.
    specLines,
    unbreakable: unbreakableLines,
    // The base list is checked against the tree the tool runs in, so the proof covers that tree too.
    proof: proven({ spec: specPath, transcripts, base, partialBase, tree: process.cwd(),
      ...values.sha256 === undefined ? {} : { sha256: values.sha256 } }, values.proof),
    spec: specPath,
  }
  console.log(values.json ? JSON.stringify(summary) :
    `sha256=${summary.sha256} nonBlankLines=${summary.nonBlankLines} specLines=${summary.specLines} ` +
    `unbreakable=${JSON.stringify(summary.unbreakable)} proof=${summary.proof} spec=${summary.spec}`)
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

function checkBase(base: unknown[], { json, partialBase, expected }: { json: boolean, partialBase: boolean, expected?: string }) {
  const summary = { base, proof: proven({ base, partialBase, tree: process.cwd() }, expected) }
  console.log(json ? JSON.stringify(summary) : `base=${JSON.stringify(summary.base)} proof=${summary.proof}`)
}

main().catch(error => { console.error(messageOf(error).replace(/[\r\n]+/g, ' ')); process.exitCode = 1 })
