import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

describe('structured unit spec validation', () => {
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
      proof: expect.stringMatching(/^[0-9a-f]{32}$/),
      spec: join(fixtures, 'valid.yaml'),
    })
    const plain = fixture('valid')
    expect(plain.exit).toBe(0)
    expect(plain.err).toBe('')
    expect(plain.out.trim().split('\n')).toHaveLength(1)
    for (const value of ['kind=', 'source=', 'criteria=', 'sha256=', 'nonBlankLines=41', 'proof=', `spec=${join(fixtures, 'valid.yaml')}`]) expect(plain.out).toContain(value)
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
    const cite = (line, uuid, words, answers) => changed(s => {
      s.items[0].evidence = [{ file: 'session.jsonl', line, uuid }]
      s.items[0].user_words = words
      if (answers !== undefined) s.items[0].answers = answers
    })
    const unmatched = 'export-request.user_words: not found in any resolved user message'
    expect(cite(11, 'dialog-answer', 'Stream, in input order').exit).toBe(0)
    expect(cite(15, 'dialog-answer-blocks', 'Nightly, after the backup').exit).toBe(0)
    // The tool result's content carries the question text and the host's wording, never the user's words.
    for (const [line, uuid, words] of [[11, 'dialog-answer', 'Which interface should the export use?'],
      [11, 'dialog-answer', 'The user answered'], [15, 'dialog-answer-blocks', 'How often should the export run?'],
      [15, 'dialog-answer-blocks', 'The user answered']]) {
      invalid(cite(line, uuid, words), unmatched)
    }
    invalid(cite(13, 'command-output', 'Stream, in input order'), unmatched)
    invalid(cite(7, 'tool-turn', 'ok'), unmatched)
    invalid(cite(16, 'early-answer', 'An answer before its question'), unmatched)
    for (const question of ['Which interface should the export use?', 'Stream', 'Rows leave one at a time.', 'Batch Rows leave together.']) {
      expect([question, cite(11, 'dialog-answer', 'Stream, in input order', question).exit]).toEqual([question, 0])
    }
    expect(cite(15, 'dialog-answer-blocks', 'Nightly', 'How often should the export run? Nightly Once after midnight.').exit).toBe(0)
    invalid(cite(15, 'dialog-answer-blocks', 'Nightly', 'Which interface should the export use?'),
      'export-request.answers: not found in the assistant messages the cited words reply to')
    invalid(cite(11, 'dialog-answer', 'Stream, in input order', 'Interface'), 'export-request.answers: not found')
  })

  test('a message queued by the user while the session worked counts as user words, a queued command of any other origin never', () => {
    const cite = (line, uuid, words, answers) => changed(s => {
      s.items[0].evidence = [{ file: 'session.jsonl', line, uuid }]
      s.items[0].user_words = words
      if (answers !== undefined) s.items[0].answers = answers
    })
    expect(cite(20, 'queued-human', 'Skip the empty rows.').exit).toBe(0)
    invalid(cite(20, 'queued-human', 'queued reminder'), 'export-request.user_words: not found in any resolved user message')
    invalid(cite(20, 'queued-task', 'Skip the empty rows.'), 'export-request.evidence entry 1: transcript reference failed: expected a queued message with the cited uuid')
    invalid(cite(21, 'queued-task', 'Skip the empty rows.'), 'transcript reference failed: a queued command of origin "task-notification" is not the user\'s words')
    invalid(cite(22, 'queued-no-origin', 'Skip the empty rows.'), 'transcript reference failed: a queued command of origin null is not the user\'s words')
    invalid(cite(23, 'other-attachment', 'Skip the empty rows.'), 'transcript reference failed: expected a user record with the cited uuid')
    // The assistant records after the previous user turn and before the queued message are the ones it replies to.
    expect(cite(20, 'queued-human', 'Skip the empty rows.', 'Should the export skip empty rows?').exit).toBe(0)
    invalid(cite(20, 'queued-human', 'Skip the empty rows.', 'Two shapes: (a) stream the rows'),
      'export-request.answers: not found in the assistant messages the cited words reply to')
  })

  test('a spec names its private record, which must exist and hold every user_words after collapsing whitespace', () => {
    invalid(changed(s => { delete s.record }), 'spec.record: missing field')
    invalid(changed(s => { s.record = ' ' }), 'spec.record: expected a non-empty string')
    const absent = join(scratch, 'absent-record.md')
    invalid(changed(s => { s.record = absent }), `spec.record: does not name an existing file: ${absent}`)
    invalid(changed(s => { s.record = scratch }), `spec.record: does not name an existing file: ${scratch}`)
    const thin = join(scratch, 'thin-record.md')
    writeFileSync(thin, '# Record\n\n> Stream the rows.\n')
    const lacking = changed(s => { s.record = thin })
    invalid(lacking, 'export-request.user_words: not found in the private record')
    expect(lacking.err.trim().split('\n')).toHaveLength(1)
    const wrapped = join(scratch, 'wrapped-record.md')
    writeFileSync(wrapped, '# Record\n\n> Export the\n  selected   rows.\n')
    expect(changed(s => { s.record = wrapped }).exit).toBe(0)
    // Every transcript item is checked, not only the first one that matches.
    invalid(changed(s => {
      s.record = wrapped
      s.items.push({ ...structuredClone(s.items[0]), id: 'stream-request', evidence: [{ file: 'session.jsonl', line: 9, uuid: 'answer' }], user_words: 'Stream the rows.' })
    }), 'stream-request.user_words: not found in the private record')
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
    expect(changed(s => { s.items[1].quote = 'Retain  the\ninput order across\t every exported row.' }).exit).toBe(0)
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
    const trackedRules = 'tests/fixtures/spec-provenance/rules.txt'
    const committed = Bun.spawnSync(['git', 'show', `${head}:${trackedRules}`], { cwd: root }).stdout.toString()
    const original = readFileSync(join(root, trackedRules), 'utf8')
    writeFileSync(join(root, trackedRules), committed.replace('Retain the input order', 'Keep the input order'))
    try {
      expect(changed(s => { s.items[1].rule.file = trackedRules }, ['--base', head]).exit).toBe(0)
      invalid(changed(s => { s.items[1].rule.file = trackedRules }), 'quote does not match')
      invalid(changed(s => { s.items[1].rule.file = trackedRules; s.items[1].quote = 'Keep the input order' }, ['--base', head]), 'quote does not match')
    } finally { writeFileSync(join(root, trackedRules), original) }
    // An untracked file has no committed state, so --base reads it from disk.
    const untracked = join(scratch, 'untracked-rule.txt')
    writeFileSync(untracked, 'Retain the input order across every exported row.\n')
    expect(changed(s => { s.items[1].rule = { file: untracked, line: 1 } }, ['--base', head]).exit).toBe(0)
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

  test('rendering groups items by kind under the summary and omits provenance', async () => {
    const path = join(scratch, 'generated.md')
    expect(fixture('valid', ['--render', path]).exit).toBe(0)
    const rendered = await Bun.file(path).text()
    expect(rendered).toBe('# example-export\n\n' +
      'A synthetic unit that exports selected rows.\n\nIt exercises every kind and every source.\n\n' +
      '## Requirements\n\n**export-request**: Export the selected rows.\n\n' +
      '## Boundaries\n\n**export-only**: The unit covers export of selected rows.\n\n' +
      '## Rejected alternatives\n\n**batch-unavailable**: Use the batch interface.\n' +
      'Reason: The installed example reports that interface as unavailable.\n\n' +
      '## Acceptance criteria\n\n1. **row-order**: Exported rows retain their input order.\n' +
      '2. **stream-result**: Export uses the stream interface in place of the unavailable batch interface.\n')
    for (const privateValue of ['session.jsonl', 'request-string', 'user_words', 'evidence', 'batch unavailable', 'rules.txt', 'parents', 'printf', 'record']) {
      expect(rendered).not.toContain(privateValue)
    }
    const partial = join(scratch, 'partial.md')
    const result = changed(s => {
      s.items = s.items.slice(0, 2)
      s.items[1].content = 'Exported rows retain\ntheir input order.\n'
    }, ['--render', partial])
    expect(result.exit).toBe(0)
    expect(await Bun.file(partial).text()).toBe('# example-export\n\n' +
      'A synthetic unit that exports selected rows.\n\nIt exercises every kind and every source.\n\n' +
      '## Requirements\n\n**export-request**: Export the selected rows.\n\n' +
      '## Acceptance criteria\n\n1. **row-order**: Exported rows retain\n   their input order.\n')
  })

  test('a stale or unreadable document fails the render check, which writes nothing', async () => {
    const path = join(scratch, 'checked.md')
    expect(fixture('valid', ['--render', path]).exit).toBe(0)
    expect(fixture('valid', ['--check-render', path]).exit).toBe(0)
    writeFileSync(path, 'stale\n')
    invalid(fixture('valid', ['--check-render', path]), 'generated document differs')
    expect(await Bun.file(path).text()).toBe('stale\n')
    invalid(fixture('several', ['--render', path]), 'unknown kind')
    expect(await Bun.file(path).text()).toBe('stale\n')
    const missing = join(scratch, 'missing.md')
    invalid(fixture('valid', ['--check-render', missing]), 'generated document is unreadable')
    expect(await Bun.file(missing).exists()).toBe(false)
    invalid(fixture('valid', ['--render', join(scratch, 'missing/parent.md')]), 'ENOENT')
    invalid(fixture('valid', ['--render', path, '--check-render', path]), 'Usage')
  })

  test('the summary leaves stdout to the caller when a document is rendered or checked', () => {
    const path = join(scratch, 'streams.md')
    for (const option of ['--render', '--check-render']) {
      const plain = fixture('valid', [option, path])
      expect(plain.exit).toBe(0)
      expect(plain.out).toBe('')
      for (const value of ['kind=', 'source=', 'criteria=', 'sha256=', 'nonBlankLines=41']) expect(plain.err).toContain(value)
      const json = fixture('valid', [option, path, '--json'])
      expect(json.exit).toBe(0)
      expect(json.err).toBe('')
      expect(JSON.parse(json.out).criteria).toEqual([{ ordinal: 1, id: 'row-order' }, { ordinal: 2, id: 'stream-result' }])
    }
  })

  test('unavailable YAML support names the same runtime minimum as the README', async () => {
    const preload = join(scratch, 'without-yaml.js')
    writeFileSync(preload, 'Bun.YAML = undefined\n')
    const result = Bun.spawnSync([process.execPath, '--preload', preload, tool], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('Bun 1.2.21 or newer is required: Bun.YAML is unavailable')
    expect(await Bun.file(join(root, 'README.md')).text()).toContain('Bun 1.2.21 or newer')
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
    for (const options of [[join(fixtures, 'valid.yaml')], ['--base', 'HEAD'], ['--render', join(scratch, 'list.md')], ['--check-render', path]]) {
      invalid(checkList(path, options), 'Usage')
    }
    const bare = Bun.spawnSync([process.execPath, tool, '--fix-list', path], { cwd: root })
    expect([bare.exitCode, bare.stderr.toString().includes('Usage')]).toEqual([1, true])
  })
})
