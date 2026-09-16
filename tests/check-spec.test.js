import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
      nonBlankLines: 37,
    })
    const plain = fixture('valid')
    expect(plain.exit).toBe(0)
    expect(plain.out.trim().split('\n')).toHaveLength(1)
    for (const value of ['kind=', 'source=', 'criteria=', 'sha256=', 'nonBlankLines=37']) expect(plain.out).toContain(value)
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
    const messages = result.err.trim().split('\n').map(line => line.slice(line.indexOf(': items[') + 2))
    expect(messages).toEqual([
      'items[1].parents: parent id does not exist: missing',
      'items[1].parents: parent chain never reaches a transcript, rule or observation item',
      'items[2].extra: unknown key', 'items[2].kind: unknown kind',
      'items[2].content: expected a non-empty string',
      'items[3].observation.exit: missing field', 'items[3].observation.output: missing field',
      'items[3].observation.date: missing field',
    ])
  })

  test.each([
    ['unknown root key', s => { s.extra = true }, 'spec.extra: unknown key'],
    ['empty unit', s => { s.unit = ' ' }, 'spec.unit: expected a non-empty string'],
    ['wrong unit type', s => { s.unit = 3 }, 'spec.unit: expected a non-empty string'],
    ['empty items', s => { s.items = [] }, 'items: expected a non-empty list'],
    ['wrong items type', s => { s.items = {} }, 'items: expected a non-empty list'],
    ['wrong item type', s => { s.items[0] = null }, 'items[1]: expected a mapping'],
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

  test.each([
    [1, 'wrong-uuid', 'expected a user record'], [3, 'assistant-record', 'expected a user record'],
    [4, 'missing-uuid', 'expected a user record'], [5, 'malformed', 'transcript reference failed'],
    [9, 'missing-line', 'line is outside'], [0, 'zero-line', 'expected a positive integer'],
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

  test('a grounded cycle still fails, while a shared-parent acyclic derivation passes', () => {
    invalid(changed(s => { s.items[4].parents = ['export-only', 'export-request'] }), 'cycle among parents')
    expect(changed(s => { s.items[4].parents = ['stream-result', 'export-request'] }).exit).toBe(0)
  })

  test('observation commands are data and never execute', async () => {
    const marker = join(scratch, 'must-not-exist')
    expect(changed(s => { s.items[3].observation.command = `touch ${JSON.stringify(marker)}` }).exit).toBe(0)
    expect(await Bun.file(marker).exists()).toBe(false)
  })

  test('rendering includes technical content and omits provenance, and stale documents fail without a write', async () => {
    const path = join(scratch, 'generated.md')
    expect(fixture('valid', ['--render', path]).exit).toBe(0)
    const rendered = await Bun.file(path).text()
    expect(rendered).toBe('# example-export\n\n' +
      '## Requirement: export-request\n\nExport the selected rows.\n\n' +
      '## Criterion 1: row-order\n\nExported rows retain their input order.\n\n' +
      '## Criterion 2: stream-result\n\nExport uses the stream interface in place of the unavailable batch interface.\n\n' +
      '## Rejected alternative: batch-unavailable\n\nUse the batch interface.\n\n' +
      'Reason: The installed example reports that interface as unavailable.\n\n' +
      '## Boundary: export-only\n\nThe unit covers export of selected rows.\n')
    for (const privateValue of ['session.jsonl', 'request-string', 'user_words', 'evidence', 'batch unavailable', 'rules.txt']) {
      expect(rendered).not.toContain(privateValue)
    }
    expect(fixture('valid', ['--check-render', path]).exit).toBe(0)
    writeFileSync(path, 'stale\n')
    invalid(fixture('valid', ['--check-render', path]), 'generated document differs')
    expect(await Bun.file(path).text()).toBe('stale\n')
    invalid(fixture('several', ['--render', path]), 'unknown kind')
    expect(await Bun.file(path).text()).toBe('stale\n')
    expect(fixture('valid', ['--render', path]).exit).toBe(0)
    invalid(fixture('valid', ['--check-render', join(scratch, 'missing.md')]), 'generated document is unreadable')
    invalid(fixture('valid', ['--render', join(scratch, 'missing/parent.md')]), 'ENOENT')
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
