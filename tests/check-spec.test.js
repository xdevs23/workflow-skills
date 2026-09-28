import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = join(root, 'tests/fixtures/spec-provenance')
const tool = join(root, 'tools/check-spec.ts')
mkdirSync(join(root, '.cache'), { recursive: true })
const scratch = mkdtempSync(join(root, '.cache/check-spec-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const valid = Bun.YAML.parse(await Bun.file(join(fixtures, 'valid.yaml')).text())
let serial = 0
const run = (file, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, file, '--transcripts', fixtures, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const fixture = (name, options = []) => run(join(fixtures, name + '.yaml'), options)
const changed = (edit, options = []) => {
  const spec = structuredClone(valid)
  edit(spec)
  const path = join(scratch, `${serial++}.yaml`)
  writeFileSync(path, Bun.YAML.stringify(spec))
  return run(path, options)
}
const invalid = (result, message) => {
  expect(result.exit).not.toBe(0)
  expect(result.out).toBe('')
  expect(result.err).toContain(message)
}
const validRecord = Bun.YAML.parse(await Bun.file(join(fixtures, 'record.yaml')).text())
const entryOf = (record, id) => structuredClone(record.entries.find(entry => entry.id === id))
// A record written to the scratch directory, as YAML or, given a string, as that text.
const recordFile = record => {
  const path = join(scratch, `${serial++}-record.yaml`)
  writeFileSync(path, typeof record === 'string' ? record : Bun.YAML.stringify(record))
  return path
}
// The valid spec checked against an edited copy of the valid record.
const withRecord = edit => {
  const record = structuredClone(validRecord)
  edit(record, id => record.entries.find(entry => entry.id === id))
  return changed(s => { s.record = recordFile(record) })
}

describe('structured unit spec validation', () => {
  // The valid spec with its transcript item citing `words` in the given session record, and quoting
  // `answers` when they are given.
  const citeSession = (line, uuid, words, answers) => changed(s => {
    s.items[0].evidence = [{ file: 'session.jsonl', line, uuid }]
    s.items[0].user_words = words
    if (answers !== undefined) s.items[0].answers = answers
  })

  test('valid example covers every kind and source, with ordered integer ordinals and byte hash', async () => {
    const result = fixture('valid', ['--json'])
    expect(result.err).toBe('')
    expect(result.exit).toBe(0)
    const bytes = await Bun.file(join(fixtures, 'valid.yaml')).arrayBuffer()
    expect(JSON.parse(result.out)).toEqual({
      counts: { kind: { requirement: 1, criterion: 2, rejected: 1, boundary: 1 },
        source: { transcript: 1, rule: 1, observation: 1, derivation: 2 } },
      criteria: [{ ordinal: 1, id: 'row-order' }, { ordinal: 2, id: 'stream-result' }],
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      nonBlankLines: 41,
      specLines: 15,
      unbreakable: [],
      proof: expect.stringMatching(/^[0-9a-f]{32}$/),
      spec: join(fixtures, 'valid.yaml'),
    })
    const plain = fixture('valid')
    expect(plain.exit).toBe(0)
    expect(plain.err).toBe('')
    expect(plain.out.trim().split('\n')).toHaveLength(1)
    for (const value of ['kind=', 'source=', 'criteria=', 'sha256=', 'nonBlankLines=41', 'specLines=15', 'unbreakable=[]', 'proof=', `spec=${join(fixtures, 'valid.yaml')}`]) expect(plain.out).toContain(value)
  })

  test('a passing run prints a fresh 32-character hexadecimal proof in both output forms, a failing run none', () => {
    const proofs = [fixture('valid', ['--json']), fixture('valid', ['--json'])].map(result => JSON.parse(result.out).proof)
    expect(proofs[0]).toMatch(/^[0-9a-f]{32}$/)
    expect(proofs[1]).toMatch(/^[0-9a-f]{32}$/)
    expect(proofs[0]).not.toBe(proofs[1])
    expect(fixture('valid').out).toMatch(/ proof=[0-9a-f]{32} /)
    const failing = fixture('chain', ['--json'])
    expect(failing.exit).not.toBe(0)
    expect(failing.out).toBe('')
    expect(failing.err).not.toContain('proof')
    expect(failing.err).not.toContain('spec=')
  })

  test('a spec with no transcript item fails naming items, and a requirement resting on observations alone fails naming it', () => {
    invalid(changed(s => { s.items = s.items.slice(1) }), 'items: no item has source transcript')
    const observed = changed(s => {
      s.items.push({ id: 'harden', kind: 'requirement', content: 'Harden the batch path.', source: 'derivation', parents: ['batch-unavailable'] })
    })
    invalid(observed, 'harden.parents: parent chain of a requirement never reaches a transcript or rule item')
    expect(observed.err).not.toContain('harden.parents: parent chain never reaches')
    const viaRule = changed(s => {
      s.items.push({ id: 'ordered', kind: 'requirement', content: 'Keep the order.', source: 'derivation', parents: ['row-order'] })
    })
    expect(viaRule.exit).toBe(0)
    expect(changed(s => {
      s.items.push({ id: 'shape', kind: 'boundary', content: 'Only the batch path.', source: 'derivation', parents: ['batch-unavailable'] })
    }).exit).toBe(0)
  })

  test('answers resolves against the assistant records between the previous user turn and the cited record', () => {
    const cite = (answers, words = 'Stream the rows.') => changed(s => {
      s.items[0].evidence = [{ file: 'session.jsonl', line: 9, uuid: 'answer' }]
      s.items[0].user_words = words
      if (answers !== undefined) s.items[0].answers = answers
    })
    expect(cite(undefined).exit).toBe(0)
    expect(cite('(a) stream the rows,   (b) batch them. Which one?').exit).toBe(0)
    invalid(cite('Export the selected rows.'), 'export-request.answers: not found in the assistant messages the cited words reply to')
    invalid(cite(''), 'export-request.answers: expected a non-empty string')
    invalid(changed(s => { s.items[1].answers = 'x' }), 'row-order.answers: unknown key')
    invalid(changed(s => { s.items[0].answers = 'Export the selected rows.' }), 'export-request.answers: not found')
  })

  test('user words match only the structured answers of the question dialog, and a result of any other tool never counts', () => {
    const unmatched = 'export-request.user_words: not found in any resolved user message'
    expect(citeSession(11, 'dialog-answer', 'Stream, in input order').exit).toBe(0)
    expect(citeSession(15, 'dialog-answer-blocks', 'Nightly, after the backup').exit).toBe(0)
    // The tool result's content carries the question text and the host's wording, never the user's words.
    for (const [line, uuid, words] of [[11, 'dialog-answer', 'Which interface should the export use?'],
      [11, 'dialog-answer', 'The user answered'], [15, 'dialog-answer-blocks', 'How often should the export run?'],
      [15, 'dialog-answer-blocks', 'The user answered']]) {
      invalid(citeSession(line, uuid, words), unmatched)
    }
    invalid(citeSession(13, 'command-output', 'Stream, in input order'), unmatched)
    invalid(citeSession(7, 'tool-turn', 'ok'), unmatched)
    invalid(citeSession(16, 'early-answer', 'An answer before its question'), unmatched)
    for (const question of ['Which interface should the export use?', 'Stream', 'Rows leave one at a time.', 'Batch Rows leave together.']) {
      expect([question, citeSession(11, 'dialog-answer', 'Stream, in input order', question).exit]).toEqual([question, 0])
    }
    expect(citeSession(15, 'dialog-answer-blocks', 'Nightly', 'How often should the export run? Nightly Once after midnight.').exit).toBe(0)
    invalid(citeSession(15, 'dialog-answer-blocks', 'Nightly', 'Which interface should the export use?'),
      'export-request.answers: not found in the assistant messages the cited words reply to')
    invalid(citeSession(11, 'dialog-answer', 'Stream, in input order', 'Interface'), 'export-request.answers: not found')
  })

  test('a note typed on a dialog answer counts as user words, and the host placeholder and an option preview never do', () => {
    const unmatched = 'export-request.user_words: not found in any resolved user message'
    const failed = 'export-request.evidence entry 1: transcript reference failed: '
    expect(citeSession(34, 'note-answer', 'Keep the ids, drop the audit columns').exit).toBe(0)
    expect(citeSession(34, 'note-answer', 'Keep the ids, drop the audit columns', 'Which columns should the export keep?').exit).toBe(0)
    invalid(citeSession(34, 'note-answer', '(notes only)'), unmatched)
    // Without a note on its question, an answer that reads `(notes only)` is the user's own text.
    expect(citeSession(42, 'typed-placeholder', '(notes only)').exit).toBe(0)
    invalid(citeSession(34, 'note-answer', 'A stray annotation'), unmatched)
    invalid(citeSession(36, 'preview-answer', '1,Ada'), unmatched)
    // A note counts only where an answer would.
    invalid(citeSession(37, 'early-note', 'A note before its question'), unmatched)
    invalid(citeSession(39, 'meta-note', 'A note in a meta record'), failed + 'an injected meta record is not the user\'s words')
    invalid(citeSession(40, 'notification-note', 'A note in a notification'), failed + 'a user record of origin "task-notification" is not the user\'s words')
  })

  test('a message queued by the user while the session worked counts as user words, a queued command of any other origin never', () => {
    expect(citeSession(20, 'queued-human', 'Skip the empty rows.').exit).toBe(0)
    invalid(citeSession(20, 'queued-human', 'queued reminder'), 'export-request.user_words: not found in any resolved user message')
    invalid(citeSession(20, 'queued-task', 'Skip the empty rows.'), 'export-request.evidence entry 1: transcript reference failed: expected a queued message with the cited uuid')
    invalid(citeSession(21, 'queued-task', 'Skip the empty rows.'), 'transcript reference failed: a queued command of origin "task-notification" is not the user\'s words')
    invalid(citeSession(22, 'queued-no-origin', 'Skip the empty rows.'), 'transcript reference failed: a queued command of origin null is not the user\'s words')
    invalid(citeSession(23, 'other-attachment', 'Skip the empty rows.'), 'transcript reference failed: expected a user record with the cited uuid')
    // The assistant records after the previous user turn and before the queued message are the ones it replies to.
    expect(citeSession(20, 'queued-human', 'Skip the empty rows.', 'Should the export skip empty rows?').exit).toBe(0)
    invalid(citeSession(20, 'queued-human', 'Skip the empty rows.', 'Two shapes: (a) stream the rows'),
      'export-request.answers: not found in the assistant messages the cited words reply to')
  })

  test('a spec names its private record, which must exist and hold every user_words in the words of an entry after collapsing whitespace', () => {
    invalid(changed(s => { delete s.record }), 'spec.record: missing field')
    invalid(changed(s => { s.record = ' ' }), 'spec.record: expected a non-empty string')
    const absent = join(scratch, 'absent-record.yaml')
    invalid(changed(s => { s.record = absent }), `spec.record: does not name an existing file: ${absent}`)
    invalid(changed(s => { s.record = scratch }), `spec.record: does not name an existing file: ${scratch}`)
    const thin = { unit: 'example-export', entries: [entryOf(validRecord, 'stream-choice')] }
    const lacking = changed(s => { s.record = recordFile(thin) })
    invalid(lacking, 'export-request.user_words: not found in the words of any private record entry')
    expect(lacking.err.trim().split('\n')).toHaveLength(1)
    const wrapped = { unit: 'example-export', entries: [{ ...entryOf(validRecord, 'export-request'), words: 'Export the\n  selected   rows.' }] }
    expect(changed(s => { s.record = recordFile(wrapped) }).exit).toBe(0)
    // Every transcript item is checked.
    invalid(changed(s => {
      s.record = recordFile(wrapped)
      s.items.push({ ...structuredClone(s.items[0]), id: 'stream-request', evidence: [{ file: 'session.jsonl', line: 9, uuid: 'answer' }], user_words: 'Stream the rows.' })
    }), 'stream-request.user_words: not found in the words of any private record entry')
  })

  test('user words and the reply window come only from messages the user wrote', () => {
    const failed = 'export-request.evidence entry 1: transcript reference failed: '
    invalid(citeSession(26, 'notification', 'Approved, go ahead.'), failed + 'a user record of origin "task-notification" is not the user\'s words')
    invalid(citeSession(27, 'meta', 'Approved, go ahead.'), failed + 'an injected meta record is not the user\'s words')
    invalid(citeSession(28, 'command-stdout', 'Approved, go ahead.'), failed + 'a user record of origin null is not the user\'s words')
    invalid(citeSession(3, 'assistant-record', 'Export the selected rows.'), failed + 'expected a user record with the cited uuid')
    // A dialog answer counts only in a record that is neither injected nor of another origin.
    invalid(citeSession(31, 'meta-answer', 'January, then every month'), failed + 'an injected meta record is not the user\'s words')
    invalid(citeSession(32, 'notification-answer', 'January, then every month'), failed + 'a user record of origin "task-notification" is not the user\'s words')
    expect(citeSession(11, 'dialog-answer', 'Stream, in input order').exit).toBe(0)
    // The notification, the meta record and the command output between the proposal and the
    // approval open no turn, so the proposal is still what the approval replies to.
    expect(citeSession(29, 'approval', 'Approved, go ahead.', 'group the rows by month').exit).toBe(0)
    invalid(citeSession(29, 'approval', 'Approved, go ahead.', 'Two shapes: (a) stream the rows'),
      'export-request.answers: not found in the assistant messages the cited words reply to')
  })

  test('a launch record path that differs from the spec\'s record fails, and an equal one passes', () => {
    const declared = valid.record
    expect(fixture('valid', ['--json', '--record', declared]).exit).toBe(0)
    const other = join(root, declared)
    const result = fixture('valid', ['--json', '--record', other])
    invalid(result, `spec.record: differs from the launch record path ${other}`)
    expect(result.err).not.toContain('proof')
    invalid(fixture('valid', ['--record', '']), 'Usage')
  })

  test.each([
    ['shape', 'unknown key'], ['transcript', 'expected a user record with the cited uuid'],
    ['rule', 'quote does not match'], ['observation', 'output: missing field'],
    ['parent', 'parent id does not exist'], ['chain', 'parent chain never reaches'],
    ['cycle', 'cycle among parents'], ['malformed', 'unreadable or malformed YAML'],
    ['absent', 'unreadable or malformed YAML'],
  ])('%s fixture reports its violation class', (name, message) => invalid(fixture(name), message))

  test('all violations are reported in item file order, including deferred parent checks', () => {
    const result = fixture('several')
    invalid(result, 'parent id does not exist: missing')
    const prefix = 'tests/fixtures/spec-provenance/several.yaml: '
    const messages = result.err.trim().split('\n').map(line => line.slice(line.indexOf(prefix) + prefix.length))
    expect(messages).toEqual([
      "items: no item has source transcript: a spec needs the user's words",
      'first.parents: parent id does not exist: missing',
      'first.parents: parent chain never reaches a transcript, rule or observation item',
      'second.extra: unknown key', 'second.kind: unknown kind',
      'second.content: expected a non-empty string',
      'third.observation.exit: missing field', 'third.observation.output: missing field',
      'third.observation.date: missing field',
    ])
  })

  test.each([
    ['unknown root key', s => { s.extra = true }, 'spec.extra: unknown key'],
    ['empty unit', s => { s.unit = ' ' }, 'spec.unit: expected a non-empty string'],
    ['wrong unit type', s => { s.unit = 3 }, 'spec.unit: expected a non-empty string'],
    ['missing summary', s => { delete s.summary }, 'spec.summary: missing field'],
    ['wrong record type', s => { s.record = [] }, 'spec.record: expected a non-empty string'],
    ['empty summary', s => { s.summary = ' ' }, 'spec.summary: expected a non-empty string'],
    ['wrong summary type', s => { s.summary = [] }, 'spec.summary: expected a non-empty string'],
    ['empty items', s => { s.items = [] }, 'items: expected a non-empty list'],
    ['wrong items type', s => { s.items = {} }, 'items: expected a non-empty list'],
    ['wrong item type', s => { s.items[0] = null }, 'item 1: expected a mapping'],
    ['bad id', s => { s.items[0].id = 'Not Kebab' }, 'expected a kebab-case id'],
    ['duplicate id', s => { s.items[1].id = s.items[0].id }, 'duplicate id export-request'],
    ['unknown kind', s => { s.items[0].kind = 'extra' }, 'unknown kind'],
    ['unknown source', s => { s.items[0].source = 'finding' }, 'unknown source'],
    ['wrong source type', s => { s.items[0].source = { toString: {} } }, 'unknown source'],
    ['missing reason', s => { delete s.items[3].reason }, 'reason: missing field'],
    ['empty reason', s => { s.items[3].reason = '' }, 'reason: expected a non-empty string'],
    ['wrong content type', s => { s.items[0].content = [] }, 'content: expected a non-empty string'],
    ['foreign source field', s => { s.items[4].user_words = 'extra' }, 'user_words: unknown key'],
    ['empty evidence', s => { s.items[0].evidence = [] }, 'evidence: expected a non-empty list'],
    ['unknown evidence key', s => { s.items[0].evidence[0].extra = true }, 'extra: unknown key'],
    ['unknown rule key', s => { s.items[1].rule.extra = true }, 'extra: unknown key'],
    ['unknown observation key', s => { s.items[3].observation.extra = true }, 'extra: unknown key'],
    ['wrong exit type', s => { s.items[3].observation.exit = '0' }, 'exit: expected an integer'],
    ['fractional exit', s => { s.items[3].observation.exit = 0.5 }, 'exit: expected an integer'],
    ['empty date', s => { s.items[3].observation.date = '' }, 'date: expected a non-empty string'],
    ['empty output', s => { s.items[3].observation.output = '' }, 'output: expected a non-empty string'],
    ['wrong parent type', s => { s.items[4].parents = [3] }, 'expected a non-empty item id'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changed(edit), message))

  test('violations name the item id, or the position in words when no id is usable', () => {
    const named = changed(s => { s.items[0].evidence[1].uuid = ''; s.items[4].parents = ['export-request', 3] })
    invalid(named, 'export-request.evidence entry 2.uuid: expected a non-empty string')
    invalid(named, 'export-only.parents entry 2: expected a non-empty item id')
    const unnamed = changed(s => { delete s.items[2].id; s.items[2].kind = 'extra'; s.items[4].parents = ['export-request'] })
    invalid(unnamed, 'item 3.id: missing field')
    invalid(unnamed, 'item 3.kind: unknown kind')
    for (const result of [named, unnamed, fixture('several')]) expect(result.err).not.toMatch(/\[\d+\]/)
  })

  test.each([
    [1, 'wrong-uuid', 'expected a user record'], [3, 'assistant-record', 'expected a user record'],
    [4, 'missing-uuid', 'expected a user record'], [5, 'malformed', 'transcript reference failed'],
    [99, 'missing-line', 'line is outside'], [0, 'zero-line', 'expected a positive integer'],
    [1.5, 'fractional', 'expected a positive integer'], ['1', 'string-line', 'expected a positive integer'],
  ])('transcript line %s and uuid %s must resolve', (line, uuid, message) => {
    invalid(changed(s => { s.items[0].evidence = [{ file: 'session.jsonl', line, uuid }] }), message)
  })

  test('every evidence entry must resolve even when another already matches', () => {
    invalid(changed(s => { s.items[0].evidence[1].file = 'missing.jsonl' }), 'transcript reference failed')
    invalid(changed(s => { delete s.items[0].evidence[1].uuid }), 'uuid: missing field')
  })

  test('string and text-block messages both match, excluding reminders and non-text blocks', () => {
    for (const entry of valid.items[0].evidence) {
      expect(changed(s => { s.items[0].evidence = [entry] }).exit).toBe(0)
    }
    for (const words of ['private reminder text', 'second reminder', 'ignored image text', 'no matching words']) {
      invalid(changed(s => { s.items[0].user_words = words }), 'not found in any resolved user message')
    }
  })

  test('rule windows normalize whitespace, stop at blank lines and include at most forty lines', () => {
    expect(changed(s => { s.items[1].quote = 'Retain  the input order across\t every exported row.' }).exit).toBe(0)
    invalid(changed(s => { s.items[1].quote = 'A different paragraph' }), 'quote does not match')
    invalid(changed(s => { s.items[1].rule.line = 99 }), 'line is outside')
    invalid(changed(s => { s.items[1].rule.line = 0 }), 'expected a positive integer')
    invalid(changed(s => { s.items[1].rule.file = join(scratch, 'absent.txt') }), 'rule reference failed')
    const path = join(scratch, 'long-rule.txt')
    writeFileSync(path, Array.from({ length: 41 }, (_, i) => `rule-${i + 1}`).join('\n') + '\n')
    for (const [quote, exit] of [['rule-40', 0], ['rule-41', 1]]) {
      const result = changed(s => { s.items[1].rule = { file: path, line: 1 }; s.items[1].quote = quote })
      expect(result.exit).toBe(exit)
    }
  })

  test('with --base a tracked rule file is read at that commit, and an untracked one from disk', () => {
    // The fixture rule file is tracked, so a quote of its committed text passes at HEAD even when
    // the working copy has moved on, and a quote of the working copy fails at HEAD.
    const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root }).stdout.toString().trim()
    const base = JSON.stringify([{ path: '.', sha: head }])
    const trackedRules = 'tests/fixtures/spec-provenance/rules.txt'
    const committed = Bun.spawnSync(['git', 'show', `${head}:${trackedRules}`], { cwd: root }).stdout.toString()
    const original = readFileSync(join(root, trackedRules), 'utf8')
    writeFileSync(join(root, trackedRules), committed.replace('Retain the input order', 'Keep the input order'))
    try {
      expect(changed(s => { s.items[1].rule.file = trackedRules }, ['--base', base]).exit).toBe(0)
      invalid(changed(s => { s.items[1].rule.file = trackedRules }), 'quote does not match')
      invalid(changed(s => { s.items[1].rule.file = trackedRules; s.items[1].quote = 'Keep the input order' }, ['--base', base]), 'quote does not match')
    } finally { writeFileSync(join(root, trackedRules), original) }
    // An untracked file has no committed state, so --base reads it from disk.
    const untracked = join(scratch, 'untracked-rule.txt')
    writeFileSync(untracked, 'Retain the input order across every exported row.\n')
    expect(changed(s => { s.items[1].rule = { file: untracked, line: 1 } }, ['--base', base]).exit).toBe(0)
  })

  test('--base takes one entry per repository of the tree, checks the list against the tree and reads a rule in its own repository', () => {
    // A tree root that is no repository and holds two, as a repo-tool task tree does. api changes after
    // its base commit, web never changes, and the spec cites a rule inside api.
    const tree = join(scratch, `${serial++}-tree`)
    const git = (repository, ...command) => {
      const result = Bun.spawnSync(['git', '-C', join(tree, repository), ...command], { stdout: 'pipe', stderr: 'pipe' })
      expect([command[0], result.exitCode]).toEqual([command[0], 0])
      return result.stdout.toString().trim()
    }
    const repository = (path, text) => {
      mkdirSync(join(tree, path), { recursive: true })
      git(path, 'init', '--quiet', '--initial-branch=main')
      writeFileSync(join(tree, path, 'rules.txt'), text)
      git(path, 'add', '--', 'rules.txt')
      git(path, 'commit', '--quiet', '-m', 'fixture: record the rules')
      return git(path, 'rev-parse', '--verify', 'HEAD^{commit}')
    }
    const api = repository('api', 'Retain the input order across every exported row.\n')
    const web = repository('web', 'Unrelated.\n')
    writeFileSync(join(tree, 'api', 'rules.txt'), 'Keep the input order across every exported row.\n')
    const spec = structuredClone(valid)
    // The tool runs in the tree, where a link to the fixtures keeps the record's relative paths valid.
    // The walk for repositories follows no link.
    symlinkSync(join(root, 'tests'), join(tree, 'tests'))
    spec.items[1].rule = { file: 'api/rules.txt', line: 1 }
    const path = join(scratch, `${serial++}.yaml`)
    writeFileSync(path, Bun.YAML.stringify(spec))
    const inTree = list => {
      const result = Bun.spawnSync([process.execPath, tool, path, '--transcripts', fixtures, '--base', JSON.stringify(list)], { cwd: tree })
      return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
    }
    const complete = [{ path: 'api', sha: api }, { path: 'web', sha: web }]
    // The rule is read at api's base commit, where it still says Retain, although the file on disk moved on.
    expect(inTree(complete)).toMatchObject({ exit: 0, err: '' })
    invalid(inTree(complete.slice(0, 1)), '--base leaves out the git repositories at web')
    invalid(inTree([{ path: 'api', sha: web }, complete[1]]), `--base commit ${web} is not in the repository at api`)
    invalid(inTree([...complete, { path: '.', sha: api }]), '--base path . is not the top level of a git repository')
    invalid(inTree([{ path: 'api/../web', sha: web }]), '--base names a path of another form')
    invalid(inTree([complete[0], complete[0]]), '--base names the path api twice')
    invalid(inTree([]), '--base expects a non-empty JSON list')
  })

  test('a cycle whose chain reaches a sourced item still fails, while a shared-parent acyclic derivation passes', () => {
    invalid(changed(s => { s.items[4].parents = ['export-only', 'export-request'] }), 'cycle among parents')
    expect(changed(s => { s.items[4].parents = ['stream-result', 'export-request'] }).exit).toBe(0)
  })

  test('observation commands are data and never execute', async () => {
    const marker = join(scratch, 'must-not-exist')
    expect(changed(s => { s.items[3].observation.command = `touch ${JSON.stringify(marker)}` }).exit).toBe(0)
    expect(await Bun.file(marker).exists()).toBe(false)
  })

  test('the tool neither renders nor checks a design document: both options are refused and nothing is written', async () => {
    for (const option of ['--render', '--check-render']) {
      const path = join(scratch, `refused${option}.md`)
      invalid(fixture('valid', [option, path]), `Unknown option '${option}'`)
      expect(await Bun.file(path).exists()).toBe(false)
      const list = Bun.spawnSync([process.execPath, tool, '--fix-list', join(root, 'tests/fixtures/fix-list/list.yaml'),
        '--transcripts', fixtures, option, path], { cwd: root })
      expect([list.exitCode, list.stderr.toString().includes(`Unknown option '${option}'`)]).toEqual([1, true])
    }
  })

  test('specLines counts the non-blank lines of the prose and one line per distinct parent, and nothing else', () => {
    const count = edit => JSON.parse(changed(edit, ['--json']).out).specLines
    // The unit 1, the summary 2, the contents 5, the quoted words 1, the rule quote 1, the reason 1, the
    // observation output 1, and three distinct parents.
    expect(count(() => {})).toBe(15)
    // A code block counts its lines: four non-blank lines replace the first item's one.
    expect(count(s => { s.items[0].content = 'Export the selected rows.\n\n```sh\nexport\n```\n' })).toBe(18)
    // A parent named by two items counts once, and a parent no item named before adds a line.
    expect(count(s => { s.items[4].parents = ['stream-result', 'export-request'] })).toBe(15)
    expect(count(s => { s.items[4].parents = ['stream-result', 'row-order'] })).toBe(16)
    // Evidence, the observation command and the ids are not prose and add nothing.
    expect(count(s => {
      s.items[0].evidence.push({ file: 'session.jsonl', line: 1, uuid: 'request-string' })
      s.items[3].observation.command = "printf 'batch'\nprintf ' unavailable\\n'"
    })).toBe(15)
    expect(changed(() => {}).out).toContain(' specLines=15 ')
  })

  describe('the width rule', () => {
    // Words of four letters, so n of them joined by spaces are 5n - 1 characters wide.
    const words = n => Array(n).fill('word').join(' ')
    const withContent = (content, options = []) => changed(s => { s.items[0].content = content }, options)
    const failsWith = (content, message) => invalid(withContent(content), `export-request.content: ${message}`)
    const url = 'https://example.com/' + 'a'.repeat(110)

    test('a correctly wrapped paragraph, bullet list, nested list, ordered list and code block pass', () => {
      const content = [words(24), words(3) + '.', '',
        '- ' + words(23), '  ' + words(23), '  end.', '  - ' + words(23), '    tail.', '- second', '',
        '1. ' + words(23), '   end.', '2. two', '',
        '```js', 'const short = 1', '', 'const next = 2', '```', ''].join('\n')
      const result = withContent(content, ['--json'])
      expect([result.exit, result.err]).toEqual([0, ''])
      expect(JSON.parse(result.out).unbreakable).toEqual([])
    })

    test('a line over 120 characters fails, counted with its indentation and bullet marker', () => {
      failsWith(words(25), 'line 1 is 124 characters, over 120')
      failsWith('- ' + words(23) + '\n  ' + words(24), 'line 2 is 121 characters, over 120')
    })

    test('a line left short before the last line of a paragraph or a bullet fails', () => {
      failsWith(words(3) + '\n' + words(3) + '.', 'line 1 is not full: the first word of line 2 fits on it')
      failsWith(words(24) + '\n' + words(3) + '\n' + words(3) + '.', 'line 2 is not full: the first word of line 3 fits on it')
      failsWith('- ' + words(2) + '\n  ' + words(2) + '.\n- next', 'line 1 is not full: the first word of line 2 fits on it')
      // A paragraph's or a bullet's last line may be short, and a new bullet starts a new block.
      expect(withContent('Intro:\n- ' + words(2) + '\n- ' + words(2)).exit).toBe(0)
    })

    test('a paragraph in a block quote is held to the fill rule like any other', () => {
      failsWith('> ' + words(3) + '\n> ' + words(3) + '.', 'line 1 is not full: the first word of line 2 fits on it')
      expect(withContent('> ' + words(23) + '\n> ' + words(3) + '.').exit).toBe(0)
    })

    test('a list item whose first line is empty holds the text below it to the fill rule', () => {
      failsWith('-\n  ' + words(3) + '\n  ' + words(3) + '.', 'line 2 is not full: the first word of line 3 fits on it')
      expect(withContent('-\n  ' + words(23) + '\n  end.').exit).toBe(0)
    })

    test('every prose field of a spec is held to the rule, not the content alone', () => {
      invalid(changed(s => { s.summary = words(25) }), 'spec.summary: line 1 is 124 characters, over 120')
      invalid(changed(s => { s.items[3].reason = words(3) + '\n' + words(3) + '.' }), 'batch-unavailable.reason: line 1 is not full')
      invalid(changed(s => { s.items[3].observation.output = words(25) }), 'batch-unavailable.observation.output: line 1 is 124 characters, over 120')
      // Quoted words wrap like any other prose: only their words and punctuation are held verbatim.
      expect(changed(s => { s.items[0].user_words = 'Export the  selected\trows.' }).exit).toBe(0)
    })

    test('a code line over 120 characters fails, and short code lines are never held to the fill rule', () => {
      failsWith('```\n' + words(25) + '\n```', 'line 2 is 124 characters, over 120')
      expect(withContent('```\nshort\nlines\n```').exit).toBe(0)
      // A row of spaces is measured whole, and holds no word that could excuse it.
      failsWith('```\n' + ' '.repeat(121) + '\n```', 'line 2 is 121 characters, over 120')
    })

    test('a line holding one word that does not fit passes and is named in the summary', () => {
      const content = 'See\n' + url + '\nfor details.'
      const json = withContent(content, ['--json'])
      expect(json.exit).toBe(0)
      expect(JSON.parse(json.out).unbreakable).toEqual([{ field: 'export-request.content', line: 2 }])
      expect(withContent('- ' + url).exit).toBe(0)
      expect(withContent(content).out).toContain(' unbreakable=[{"field":"export-request.content","line":2}] ')
      // A long word beside other words is no exception: the line breaks before the word.
      failsWith('See ' + url, 'line 1 is 134 characters, over 120')
      // A word that fits within the width is no exception, however far it is indented.
      failsWith('- ' + ' '.repeat(10) + 'x'.repeat(110), 'line 1 is 122 characters, over 120')
    })

    test('a folded scalar is checked as the lines it folds into', async () => {
      const text = await Bun.file(join(fixtures, 'valid.yaml')).text()
      const folded = (lines) => {
        const path = join(scratch, `${serial++}-folded.yaml`)
        writeFileSync(path, text.replace('    content: Export the selected rows.\n',
          '    content: >\n' + lines.map(line => '      ' + line + '\n').join('')))
        return run(path)
      }
      expect(folded(['Export the selected', 'rows.']).exit).toBe(0)
      invalid(folded([words(20), words(20)]), 'export-request.content: line 1 is 199 characters, over 120')
    })
  })

  test('unavailable YAML support names the same runtime minimum as the README', async () => {
    const preload = join(scratch, 'without-YAML.js')
    writeFileSync(preload, 'Bun.YAML = undefined\n')
    const result = Bun.spawnSync([process.execPath, '--preload', preload, tool], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('Bun 1.2.21 or newer is required: Bun.YAML is unavailable')
    expect(await Bun.file(join(root, 'README.md')).text()).toContain('Bun 1.2.21 or newer')
  })
})

describe('private directive record validation', () => {
  test('every fixture that names a record names a YAML record', async () => {
    const named = []
    for (const directory of ['tests/fixtures/spec-provenance', 'tests/fixtures/fix-list']) {
      for (const file of new Bun.Glob('*.yaml').scanSync({ cwd: join(root, directory) })) {
        // malformed.yaml is not YAML by design, so it is the one fixture read no further.
        let parsed
        try { parsed = Bun.YAML.parse(await Bun.file(join(root, directory, file)).text()) } catch { continue }
        if (parsed?.record !== undefined) named.push([file, parsed.record])
      }
    }
    expect(named.length).toBeGreaterThan(9)
    for (const [file, record] of named) expect([file, record]).toEqual([file, 'tests/fixtures/spec-provenance/record.yaml'])
  })

  test('the valid record passes with context, answers and approved text in the replies and in a named file', () => {
    const fields = validRecord.entries.flatMap(entry => Object.keys(entry))
    for (const field of ['context', 'answers', 'approves']) expect(fields).toContain(field)
    for (const entry of validRecord.entries) expect([entry.id, entry.context.length > 0]).toEqual([entry.id, true])
    expect(validRecord.entries.some(entry => typeof entry.approves === 'string')).toBe(true)
    expect(validRecord.entries.some(entry => entry.approves?.file)).toBe(true)
    const result = withRecord(() => {})
    expect([result.exit, result.err]).toEqual([0, ''])
  })

  test.each([
    ['an unknown top-level key', r => { r.notes = 'The user prefers streaming.' }, 'record.notes: unknown key'],
    ['an unknown entry key', (r, e) => { e('export-request').note = 'Said twice.' }, 'record.export-request.note: unknown key'],
    ['an unknown approves key', (r, e) => { e('monthly-plan').approves.note = 'x' }, 'record.monthly-plan.approves.note: unknown key'],
    ['an unknown context key', (r, e) => { e('stream-choice').context[0].note = 'x' }, 'record.stream-choice.context entry 1.note: unknown key'],
    ['a missing unit', r => { delete r.unit }, 'record.unit: missing field'],
    ['missing words', (r, e) => { delete e('export-request').words }, 'record.export-request.words: missing field'],
    ['a missing uuid', (r, e) => { delete e('export-request').uuid }, 'record.export-request.uuid: missing field'],
    ['a missing sha256', (r, e) => { delete e('monthly-plan').approves.sha256 }, 'record.monthly-plan.approves.sha256: missing field'],
    ['a missing context quote', (r, e) => { delete e('stream-choice').context[0].quote }, 'record.stream-choice.context entry 1.quote: missing field'],
    ['an entry without context', (r, e) => { delete e('export-request').context }, 'record.export-request.context: missing field'],
    ['an entry with an empty context list', (r, e) => { e('export-request').context = [] }, 'record.export-request.context: expected a non-empty list'],
    ['context that is not a list', (r, e) => { e('schedule').context = 'How often should the export run?' }, 'record.schedule.context: expected a non-empty list'],
    ['empty entries', r => { r.entries = [] }, 'record.entries: expected a non-empty list'],
    ['an id that is not kebab-case', (r, e) => { e('export-request').id = 'Export request' }, 'expected a kebab-case id'],
    ['a duplicate id', (r, e) => { e('schedule').id = 'interface' }, 'record.interface.id: duplicate id interface'],
    ['a line that is not a positive integer', (r, e) => { e('export-request').line = 0 }, 'record.export-request.line: expected a positive integer'],
    ['a short sha256', (r, e) => { e('monthly-plan').approves.sha256 = 'c299a2f7' }, 'record.monthly-plan.approves.sha256: expected 64 lowercase hexadecimal digits'],
    ['approves of another type', (r, e) => { e('stream-choice').approves = ['(a) stream the rows'] }, 'record.stream-choice.approves: expected the approved text, or a mapping of text, file and sha256'],
  ])('%s fails the record shape', (name, edit, message) => invalid(withRecord(edit), message))

  test('a record of the wrong top-level shape or in Markdown fails naming the format', () => {
    const format = 'record: expected a YAML directive record: a mapping with exactly the keys unit and entries'
    for (const content of [Bun.YAML.stringify(validRecord.entries), 'The user wants the selected rows exported.\n',
      '# Private directive record\n\n## The request, line 1\n> Export the selected rows.\n\nThe user repeated this twice.\n']) {
      const result = changed(s => { s.record = recordFile(content) })
      invalid(result, format)
      expect(result.err).not.toContain('user_words')
    }
    // A mapping with any other set of top-level keys names the format beside the key it concerns.
    for (const [edit, detail] of [[r => { r.notes = 'The user prefers streaming.' }, 'record.notes: unknown key'],
      [r => { delete r.entries }, 'record.entries: missing field']]) {
      const result = withRecord(edit)
      invalid(result, format)
      expect(result.err).toContain(detail)
    }
  })

  test('words must stand in the cited message, which the user wrote, typed or queued', () => {
    invalid(withRecord((r, e) => { e('export-request').words = 'Export every row.' }), 'record.export-request.words: not found in the cited user message')
    expect(withRecord((r, e) => { e('export-request').words = 'Export the\n selected rows.' }).exit).toBe(0)
    const cite = (line, uuid) => withRecord((r, e) => { Object.assign(e('monthly-report'), { line, uuid }) })
    const failed = 'record.monthly-report: transcript reference failed: '
    invalid(cite(26, 'notification'), failed + 'a user record of origin "task-notification" is not the user\'s words')
    invalid(cite(27, 'meta'), failed + 'an injected meta record is not the user\'s words')
    invalid(cite(28, 'command-stdout'), failed + 'a user record of origin null is not the user\'s words')
    invalid(cite(3, 'assistant-record'), failed + 'expected a user record with the cited uuid')
    invalid(cite(21, 'queued-task'), failed + 'a queued command of origin "task-notification" is not the user\'s words')
    invalid(cite(13, 'command-output'), 'record.monthly-report.words: not found in the cited user message')
  })

  test('a dialog answer in an injected meta record or a task notification is not the user\'s words', () => {
    const cite = (line, uuid) => withRecord((r, e) => {
      Object.assign(e('schedule'), { line, uuid, words: 'January, then every month' })
    })
    const failed = 'record.schedule: transcript reference failed: '
    invalid(cite(31, 'meta-answer'), failed + 'an injected meta record is not the user\'s words')
    invalid(cite(32, 'notification-answer'), failed + 'a user record of origin "task-notification" is not the user\'s words')
    // The genuine dialog answers carry no origin and still pass.
    expect(withRecord(() => {}).exit).toBe(0)
    expect(withRecord((r, e) => { e('schedule').words = 'Nightly' }).exit).toBe(0)
  })

  test('a note typed on a dialog answer backs a record entry, and the host placeholder and an option preview never do', () => {
    const cite = (line, uuid, words, answers) => withRecord((r, e) => {
      const entry = Object.assign(e('columns'), { line, uuid, words, answers })
      if (answers === undefined) delete entry.answers
    })
    const unfound = 'record.columns.words: not found in the cited user message'
    const failed = 'record.columns: transcript reference failed: '
    expect(cite(34, 'note-answer', 'Keep the ids', 'Which columns should the export keep?').exit).toBe(0)
    expect(cite(36, 'preview-answer', 'Quote every field', 'Which format should the export write?').exit).toBe(0)
    expect(cite(36, 'preview-answer', 'CSV').exit).toBe(0)
    invalid(cite(34, 'note-answer', '(notes only)'), unfound)
    invalid(cite(36, 'preview-answer', '1,Ada'), unfound)
    invalid(cite(37, 'early-note', 'A note before its question'), unfound)
    invalid(cite(39, 'meta-note', 'A note in a meta record'), failed + 'an injected meta record is not the user\'s words')
    invalid(cite(40, 'notification-note', 'A note in a notification'), failed + 'a user record of origin "task-notification" is not the user\'s words')
  })

  test('each context quote must stand in the record it cites', () => {
    invalid(withRecord((r, e) => { e('stream-choice').context[1].quote = 'Three shapes.' }),
      'record.stream-choice.context entry 2.quote: not found in the cited record')
    invalid(withRecord((r, e) => { e('stream-choice').context[1].uuid = 'answer' }),
      'record.stream-choice.context entry 2: transcript reference failed: expected a record with the cited uuid')
    // A context quote may come from any record, including the question text of a dialog call.
    expect(withRecord((r, e) => { e('interface').context = [{ file: 'session.jsonl', line: 10, uuid: 'dialog-call', quote: 'Rows leave one at a time.' }] }).exit).toBe(0)
  })

  test('answers and approved text must stand in the assistant messages the words reply to', () => {
    const unreplied = 'not found in the assistant messages the cited words reply to'
    invalid(withRecord((r, e) => { e('stream-choice').answers = 'Should the export stream or batch?' }), 'record.stream-choice.answers: ' + unreplied)
    invalid(withRecord((r, e) => { e('stream-choice').approves = '(b) batch them and stream nothing' }), 'record.stream-choice.approves: ' + unreplied)
    invalid(withRecord((r, e) => { e('monthly-report').approves = 'Plan the monthly report.' }), 'record.monthly-report.approves: ' + unreplied)
  })

  test('approved text from a named file passes with a matching sha256 and fails with a mismatching one', () => {
    const plan = 'tests/fixtures/spec-provenance/plan.html'
    const digest = createHash('sha256').update(readFileSync(join(root, plan))).digest('hex')
    expect(entryOf(validRecord, 'monthly-plan').approves.sha256).toBe(digest)
    invalid(withRecord((r, e) => { e('monthly-plan').approves.sha256 = 'f'.repeat(64) }), `record.monthly-plan.approves.sha256: does not match the file ${plan}`)
    invalid(withRecord((r, e) => { e('monthly-plan').approves.text = 'Total each quarter.' }), `record.monthly-plan.approves.text: not found in the file ${plan}`)
    // The file must be one an assistant message the words reply to names.
    const copy = join(scratch, 'plan-copy.html')
    writeFileSync(copy, readFileSync(join(root, plan)))
    invalid(withRecord((r, e) => { e('monthly-plan').approves.file = copy }), 'record.monthly-plan.approves.file: not named in the assistant messages the cited words reply to')
    invalid(withRecord((r, e) => { e('monthly-plan').approves.file = join(scratch, 'absent-plan.html') }), 'record.monthly-plan.approves.file: unreadable')
  })

  test('an item built on an approval from a named file quotes text a verified entry approves in the same record', () => {
    const approval = { file: 'session.jsonl', line: 29, uuid: 'approval' }
    const item = (answers, evidence = approval, words = 'Approved, go ahead.', edit = () => {}) => {
      const record = structuredClone(validRecord)
      edit(record.entries.find(entry => entry.id === 'monthly-plan'))
      return changed(s => {
        s.record = recordFile(record)
        Object.assign(s.items[0], { evidence: [evidence], user_words: words, answers })
      })
    }
    const unanswered = 'export-request.answers: not found in the assistant messages the cited words reply to'
    expect(item('Leave rows without a date out of every total.').exit).toBe(0)
    expect(item('Leave rows   without a date').exit).toBe(0)
    expect(item('group the rows by month and total each month').exit).toBe(0)
    invalid(item('Total each quarter.'), unanswered)
    // The approved text counts only for an item citing the record the approval stands in.
    invalid(item('Leave rows without a date out of every total.', { file: 'session.jsonl', line: 9, uuid: 'answer' }, 'Stream the rows.'), unanswered)
    // An entry that fails its checks approves nothing.
    const mismatched = item('Leave rows without a date out of every total.', approval, 'Approved, go ahead.', entry => { entry.approves.sha256 = 'f'.repeat(64) })
    invalid(mismatched, 'record.monthly-plan.approves.sha256: does not match the file')
    invalid(mismatched, unanswered)
  })
})

const fixLists = join(root, 'tests/fixtures/fix-list')
const transcripts = join(fixLists, 'transcripts')
const parentSpec = join(fixLists, 'parent.yaml')
// The fixture with parentSpec as the absolute path of parent.yaml, written to the scratch directory.
const validList = { parentSpec, ...Bun.YAML.parse(await Bun.file(join(fixLists, 'list.yaml')).text()) }
const validPath = join(scratch, 'valid-list.yaml')
writeFileSync(validPath, Bun.YAML.stringify(validList))
const checkList = (path, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', transcripts, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const changedList = (edit, options = []) => {
  const list = structuredClone(validList)
  edit(list)
  const path = join(scratch, `${serial++}.yaml`)
  writeFileSync(path, Bun.YAML.stringify(list))
  return checkList(path, options)
}

describe('fix list validation', () => {
  test('a valid fix list passes with a fresh proof and its entries, in both output forms', async () => {
    const path = validPath
    const [first, second] = [checkList(path, ['--json']), checkList(path, ['--json'])]
    expect([first.exit, first.err]).toEqual([0, ''])
    const bytes = await Bun.file(path).arrayBuffer()
    expect(JSON.parse(first.out)).toEqual({
      entries: validList.entries, run: 'wf_parent-run', parentSpec,
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      proof: expect.stringMatching(/^[0-9a-f]{32}$/), fixList: path,
    })
    expect(JSON.parse(first.out).proof).not.toBe(JSON.parse(second.out).proof)
    const plain = checkList(path)
    expect([plain.exit, plain.err]).toEqual([0, ''])
    expect(plain.out).toMatch(/^entries=2 run=wf_parent-run sha256=[0-9a-f]{64} proof=[0-9a-f]{32} fixList=/)
  })

  test.each([
    ['an unknown run', l => { l.run = 'wf_missing-run' }, 'return-error.source: run wf_missing-run has no journal under the transcript directory'],
    ['an unknown reader', l => { l.entries[0].source = 'naming:0' }, 'return-error.source: the parent run has no stage labelled review:naming'],
    ['an index out of range', l => { l.entries[0].source = 'correctness:2' }, 'return-error.source: index 2 is outside the 2 findings of review:correctness'],
    ['a finding not in the claim', l => { l.entries[1].finding = 'The file handle leaks memory' }, 'close-handle.finding: not found in the claim of roaster:0'],
    ['a missing parentSpec file', l => { l.parentSpec = join(fixLists, 'absent.yaml') }, 'return-error.parentSpec: does not name an existing file: ' + join(fixLists, 'absent.yaml')],
    ['a relative parentSpec', l => { l.parentSpec = 'tests/fixtures/fix-list/parent.yaml' }, 'return-error.parentSpec: expected an absolute path: tests/fixtures/fix-list/parent.yaml'],
    ['an unknown key', l => { l.entries[0].severity = 'must-fix' }, 'return-error.severity: unknown key'],
  ])('%s fails with a violation naming the entry', (name, edit, message) => {
    const result = changedList(edit)
    invalid(result, message)
    expect(result.err).not.toContain('proof')
  })

  test('a run-wide failure names every entry', () => {
    for (const edit of [l => { l.run = 'wf_missing-run' }, l => { l.parentSpec = join(fixLists, 'absent.yaml') }, l => { l.parentSpec = 'parent.yaml' }]) {
      const result = changedList(edit)
      for (const id of ['return-error', 'close-handle']) invalid(result, `: ${id}.`)
      expect(result.err.trim().split('\n')).toHaveLength(2)
    }
  })

  test('a retried stage resolves against its last result only, and the claim match collapses whitespace', () => {
    invalid(changedList(l => { l.entries[0].source = 'correctness:0'; l.entries[0].finding = 'Only the first attempt reported this defect.' }),
      'return-error.finding: not found in the claim of correctness:0')
    expect(changedList(l => { l.entries[0].finding = 'error is swallowed   by the catch' }).exit).toBe(0)
    invalid(changedList(l => { l.entries[0].source = 'quality:0' }), 'return-error.source: the last review:quality stage returned no findings list')
  })

  test.each([
    ['an unknown list key', l => { l.extra = true }, 'fix list.extra: unknown key'],
    ['a missing run', l => { delete l.run }, 'fix list.run: missing field'],
    ['a run id with a path in it', l => { l.run = '../wf_parent-run' }, 'fix list.run: expected a run id'],
    ['empty entries', l => { l.entries = [] }, 'entries: expected a non-empty list'],
    ['an entry that is not a mapping', l => { l.entries[1] = 'close-handle' }, 'entry 2: expected a mapping'],
    ['a missing correction', l => { delete l.entries[0].correction }, 'return-error.correction: missing field'],
    ['an empty finding', l => { l.entries[0].finding = ' ' }, 'return-error.finding: expected a non-empty string'],
    ['a duplicate id', l => { l.entries[1].id = 'return-error' }, 'return-error.id: duplicate id return-error'],
    ['an id that is not kebab-case', l => { l.entries[0].id = 'Return error' }, 'expected a kebab-case id'],
    ['a malformed source', l => { l.entries[0].source = 'correctness-1' }, 'return-error.source: expected <seat>:<index>'],
    ['a field for user words', l => { l.entries[0].user_words = 'Sounds good.' }, 'return-error.user_words: unknown key'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changedList(edit), message))

  test('an unreadable fix list or a malformed journal line fails', () => {
    invalid(checkList(join(scratch, 'absent-list.yaml')), 'fix list: unreadable or malformed YAML')
    const sessions = join(scratch, 'broken-transcripts')
    mkdirSync(join(sessions, 'session/subagents/workflows/wf_broken'), { recursive: true })
    writeFileSync(join(sessions, 'session/subagents/workflows/wf_broken/journal.jsonl'), '{"type":"launched"}\nnot json\n')
    const path = join(scratch, 'broken.yaml')
    writeFileSync(path, Bun.YAML.stringify({ ...validList, run: 'wf_broken' }))
    const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', sessions], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('return-error.source: journal line 2 is not JSON')
  })

  describe('launch values', () => {
    const path = validPath
    const launch = (edit = () => {}) => {
      const values = structuredClone({ entries: validList.entries, parentSpec: validList.parentSpec })
      edit(values)
      return ['--expect', JSON.stringify(values)]
    }

    test('launch values equal to the fix list pass with a proof', () => {
      const result = checkList(path, ['--json', ...launch()])
      expect([result.exit, result.err]).toEqual([0, ''])
      expect(JSON.parse(result.out).proof).toMatch(/^[0-9a-f]{32}$/)
    })

    test.each([
      ['a changed correction', v => { v.entries[0].correction = 'Log the error and continue.' }, 'return-error.correction: differs from the launch values'],
      ['a missing entry', v => { v.entries.pop() }, 'close-handle: missing from the launch values'],
      ['a changed parentSpec', v => { v.parentSpec = join(fixLists, 'other.yaml') }, 'return-error.parentSpec: differs from the launch values'],
      ['an entry the list does not hold', v => { v.entries.push({ ...v.entries[0], id: 'rename-helper' }) }, 'launch values.entries: rename-helper is not an entry of the fix list'],
      ['an extra field', v => { v.entries[1].severity = 'must-fix' }, 'close-handle.severity: differs from the launch values'],
    ])('%s fails with a violation naming the entry', (name, edit, message) => {
      const result = checkList(path, launch(edit))
      invalid(result, message)
      expect(result.err).not.toContain('proof')
    })

    test('malformed launch values fail', () => {
      invalid(checkList(path, ['--expect', '{"entries": [']), 'launch values: malformed JSON')
      invalid(checkList(path, ['--expect', '[]']), 'launch values: expected a mapping')
    })

    test('a launch record path must equal the record of the parent spec', () => {
      const declared = Bun.YAML.parse(readFileSync(parentSpec, 'utf8')).record
      const passing = checkList(path, ['--json', ...launch(), '--record', declared])
      expect([passing.exit, passing.err]).toEqual([0, ''])
      const other = join(root, declared)
      const result = checkList(path, [...launch(), '--record', other])
      for (const id of ['return-error', 'close-handle']) {
        invalid(result, `${id}.parentSpec: the record of the parent spec differs from the launch record path ${other}`)
      }
      expect(result.err).not.toContain('proof')
      const bare = join(scratch, 'parent-without-record.yaml')
      writeFileSync(bare, 'unit: example-parent\nsummary: A synthetic unit.\nitems: []\n')
      invalid(changedList(l => { l.parentSpec = bare }, ['--record', declared]), 'return-error.parentSpec: the record of the parent spec differs')
      const broken = join(scratch, 'parent-malformed.yaml')
      writeFileSync(broken, 'unit: [unterminated\n')
      invalid(changedList(l => { l.parentSpec = broken }, ['--record', declared]), 'return-error.parentSpec: unreadable or malformed parent spec')
      invalid(checkList(path, ['--record', '']), 'Usage')
    })

    test('launch values beside a spec argument are a usage error', () => {
      const result = Bun.spawnSync([process.execPath, tool, join(fixtures, 'valid.yaml'), '--transcripts', fixtures, ...launch()], { cwd: root })
      expect([result.exitCode, result.stderr.toString().includes('Usage')]).toEqual([1, true])
    })
  })

  test('a spec argument or a spec option beside --fix-list is a usage error', () => {
    const path = validPath
    for (const options of [[join(fixtures, 'valid.yaml')], ['--base', 'HEAD']]) {
      invalid(checkList(path, options), 'Usage')
    }
    const bare = Bun.spawnSync([process.execPath, tool, '--fix-list', path], { cwd: root })
    expect([bare.exitCode, bare.stderr.toString().includes('Usage')]).toEqual([1, true])
  })
})
