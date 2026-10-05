import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fingerprint } from '../tools/fingerprint.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const fixtures = join(root, 'tests/fixtures/spec')
const tool = join(root, 'tools/check-spec.ts')
mkdirSync(join(root, '.cache'), { recursive: true })
const scratch = mkdtempSync(join(root, '.cache/check-spec-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
const valid = Bun.YAML.parse(await Bun.file(join(fixtures, 'valid.yaml')).text())
// The directory the tool runs in, as the tool reads it.
const here = realpathSync(root)
let serial = 0
const run = (file, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, file, '--transcripts', fixtures, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const fixture = (name, options = []) => run(join(fixtures, name + '.yaml'), options)
const written = spec => {
  const path = join(scratch, `${serial++}.yaml`)
  writeFileSync(path, typeof spec === 'string' ? spec : Bun.YAML.stringify(spec))
  return path
}
const changed = (edit, options = []) => {
  const spec = structuredClone(valid)
  edit(spec)
  return run(written(spec), options)
}
const invalid = (result, message) => {
  expect(result.exit).not.toBe(0)
  expect(result.out).toBe('')
  expect(result.err).toContain(message)
}
// A spec of one user entry whose text is the whole message of a session record written for it, so
// the width rule can be exercised on any text.
const said = (text, options = []) => {
  const session = join(scratch, `${serial++}-session.jsonl`)
  writeFileSync(session, JSON.stringify({ type: 'user', uuid: 'said', origin: { kind: 'human' }, message: { content: text } }) + '\n')
  return run(written({ unit: 'example', entries: [{ file: session, line: 1, uuid: 'said', author: 'user', text }] }), options)
}

describe('unit spec validation', () => {
  // A spec of one entry citing the given record, as the given author, with the given text. An
  // assistant entry is followed by the user's answer at the end of the session, so the spec holds
  // the user's words.
  const approval = { file: 'session.jsonl', line: 46, uuid: 'plan-approval', author: 'user', text: 'Yes, build it.' }
  const cite = (line, uuid, text, author = 'user') => run(written({ unit: 'example-export',
    entries: [{ file: 'session.jsonl', line, uuid, author, text }, ...(author === 'assistant' ? [approval] : [])] }))

  test('the valid example passes with its hash, its counts and an empty unbreakable list, in both output forms', async () => {
    const result = fixture('valid', ['--json'])
    expect(result.err).toBe('')
    expect(result.exit).toBe(0)
    const bytes = await Bun.file(join(fixtures, 'valid.yaml')).arrayBuffer()
    expect(JSON.parse(result.out)).toEqual({
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      nonBlankLines: 13,
      specLines: 9,
      unbreakable: [],
      proof: fingerprint({ spec: join(fixtures, 'valid.yaml'), transcripts: fixtures, base: null, partialBase: false, tree: here }),
      spec: join(fixtures, 'valid.yaml'),
    })
    const plain = fixture('valid')
    expect([plain.exit, plain.err]).toEqual([0, ''])
    expect(plain.out.trim().split('\n')).toHaveLength(1)
    for (const value of ['sha256=', 'nonBlankLines=13', 'specLines=9', 'unbreakable=[]', 'proof=', `spec=${join(fixtures, 'valid.yaml')}`]) {
      expect(plain.out).toContain(value)
    }
    for (const value of ['kind', 'criteria', 'counts']) expect(result.out).not.toContain(value)
  })

  test('a passing run prints the fingerprint of the values it checked as its proof in both output forms, a failing run none', () => {
    const proof = fingerprint({ spec: join(fixtures, 'valid.yaml'), transcripts: fixtures, base: null, partialBase: false, tree: here })
    expect([fixture('valid', ['--json']), fixture('valid', ['--json'])].map(result => JSON.parse(result.out).proof)).toEqual([proof, proof])
    expect(fixture('valid').out).toContain(` proof=${proof} `)
    const spelled = Bun.spawnSync([process.execPath, tool, join(fixtures, 'valid.yaml'), '--transcripts', fixtures + '/', '--json'], { cwd: root })
    expect(JSON.parse(spelled.stdout.toString()).proof)
      .toBe(fingerprint({ spec: join(fixtures, 'valid.yaml'), transcripts: fixtures + '/', base: null, partialBase: false, tree: here }))
    expect(JSON.parse(spelled.stdout.toString()).proof).not.toBe(proof)
    const failing = fixture('several', ['--json'])
    expect(failing.exit).not.toBe(0)
    expect(failing.out).toBe('')
    expect(failing.err).not.toContain('proof')
    expect(failing.err).not.toContain('spec=')
  })

  test('a passed proof that the checked values do not give fails the check before it prints anything', () => {
    const proof = fingerprint({ spec: join(fixtures, 'valid.yaml'), transcripts: fixtures, base: null, partialBase: false, tree: here })
    expect(JSON.parse(fixture('valid', ['--json', '--proof', proof]).out).proof).toBe(proof)
    const other = fingerprint({ spec: join(fixtures, 'other.yaml'), transcripts: fixtures, base: null, partialBase: false, tree: here })
    invalid(fixture('valid', ['--json', '--proof', other]), `the checked values give the proof ${proof}, and the run launched with the proof ${other}`)
  })

  test('a spec without an entry of author user fails, whatever its assistant entries quote', () => {
    const message = "entries: no entry has author user: a spec needs the user's words"
    invalid(changed(s => { s.entries = s.entries.filter(entry => entry.author === 'assistant') }), message)
    expect(changed(s => { s.entries = s.entries.filter(entry => entry.author === 'user') }).exit).toBe(0)
  })

  test('a spec holds exactly unit and entries, and an entry exactly file, line, uuid, author and text', () => {
    for (const key of ['summary', 'record', 'items']) {
      invalid(changed(s => { s[key] = key === 'items' ? [] : 'An earlier shape.' }), `spec.${key}: unknown key`)
    }
    for (const key of ['id', 'answers', 'approves', 'context', 'kind']) {
      invalid(changed(s => { s.entries[2][key] = 'x' }), `entry 3.${key}: unknown key`)
    }
  })

  test.each([
    ['a missing unit', s => { delete s.unit }, 'spec.unit: missing field'],
    ['an empty unit', s => { s.unit = ' ' }, 'spec.unit: expected a non-empty string'],
    ['a unit of another type', s => { s.unit = 3 }, 'spec.unit: expected a non-empty string'],
    ['missing entries', s => { delete s.entries }, 'spec.entries: missing field'],
    ['empty entries', s => { s.entries = [] }, 'entries: expected a non-empty list'],
    ['entries of another type', s => { s.entries = {} }, 'entries: expected a non-empty list'],
    ['an entry that is no mapping', s => { s.entries[1] = 'Which one?' }, 'entry 2: expected a mapping'],
    ['a missing author', s => { delete s.entries[0].author }, 'entry 1.author: missing field'],
    ['an unknown author', s => { s.entries[0].author = 'reviewer' }, 'entry 1.author: expected user or assistant'],
    ['a missing text', s => { delete s.entries[0].text }, 'entry 1.text: missing field'],
    ['an empty text', s => { s.entries[0].text = ' ' }, 'entry 1.text: expected a non-empty string'],
    ['an empty uuid', s => { s.entries[0].uuid = '' }, 'entry 1.uuid: expected a non-empty string'],
    ['an empty file', s => { s.entries[0].file = '' }, 'entry 1.file: expected a non-empty string'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changed(edit), message))

  test.each([
    ['shape', 'entry 1.note: unknown key'], ['transcript', 'entry 1: transcript reference failed: expected a user record with the cited uuid'],
    ['malformed', 'unreadable or malformed YAML'], ['absent', 'unreadable or malformed YAML'],
  ])('%s fixture reports its violation class', (name, message) => invalid(fixture(name), message))

  test('all violations are reported in entry order, the spec-wide ones first', () => {
    const result = fixture('several')
    const prefix = 'tests/fixtures/spec/several.yaml: '
    const messages = result.err.trim().split('\n').map(line => line.slice(line.indexOf(prefix) + prefix.length))
    expect(messages).toEqual([
      'spec.summary: unknown key',
      "entries: no entry has author user: a spec needs the user's words",
      'entry 1: transcript reference failed: expected an assistant record with the cited uuid',
      'entry 2.author: expected user or assistant',
      'entry 2.line: goes back to line 1 of session.jsonl after line 9',
      'entry 3.author: missing field',
      'entry 3.text: expected a non-empty string',
      'entry 3.line: goes back to line 8 of session.jsonl after line 9',
    ])
  })

  test('entries of one session file never go back in line order, while two entries may quote one line', () => {
    invalid(changed(s => { [s.entries[1], s.entries[2]] = [s.entries[2], s.entries[1]] }), 'entry 3.line: goes back to line 8 of session.jsonl after line 9')
    const twice = changed(s => {
      s.entries.splice(1, 0, { file: 'session.jsonl', line: 8, uuid: 'offer', author: 'assistant', text: 'Which one?' })
    })
    expect([twice.exit, twice.err]).toEqual([0, ''])
    // Entries of another session file keep their own order.
    const other = join(scratch, 'other-session.jsonl')
    writeFileSync(other, JSON.stringify({ type: 'user', uuid: 'later', origin: { kind: 'human' }, message: { content: 'Add a header.' } }) + '\n')
    const mixed = changed(s => { s.entries.splice(3, 0, { file: other, line: 1, uuid: 'later', author: 'user', text: 'Add a header.' }) })
    expect([mixed.exit, mixed.err]).toEqual([0, ''])
  })

  test('a second name of one session file shares its line order', () => {
    const link = join(scratch, 'linked-session.jsonl')
    symlinkSync(join(fixtures, 'session.jsonl'), link)
    const answer = { file: link, line: 9, uuid: 'answer', author: 'user', text: 'Stream the rows.' }
    invalid(changed(s => { s.entries.push(answer) }), `entry 10.line: goes back to line 9 of ${link} after line 46`)
    const approval = changed(s => { s.entries.push({ ...answer, line: 46, uuid: 'plan-approval', text: 'Yes, build it.' }) })
    expect([approval.exit, approval.err]).toEqual([0, ''])
  })

  test.each([
    [1, 'wrong-uuid', 'expected a user record'], [3, 'assistant-record', 'expected a user record'],
    [4, 'missing-uuid', 'expected a user record'], [5, 'malformed', 'transcript reference failed'],
    [99, 'missing-line', 'line is outside'], [0, 'zero-line', 'expected a positive integer'],
    [1.5, 'fractional', 'expected a positive integer'], ['1', 'string-line', 'expected a positive integer'],
  ])('transcript line %s and uuid %s must resolve', (line, uuid, message) => {
    invalid(cite(line, uuid, 'Export the selected rows.'), message)
  })

  test('a session file that does not exist fails the entry that cites it', () => {
    invalid(changed(s => { s.entries[0].file = 'missing.jsonl' }), 'entry 1: transcript reference failed')
  })

  describe('a user entry', () => {
    const unfound = 'entry 1.text: not found in the cited user message'
    const failed = 'entry 1: transcript reference failed: '

    test('matches string and text-block messages, excluding reminders and non-text blocks', () => {
      expect(cite(1, 'request-string', 'Export the selected rows.').exit).toBe(0)
      expect(cite(2, 'request-blocks', 'Export the   selected\trows.').exit).toBe(0)
      for (const text of ['private reminder text', 'second reminder', 'ignored image text', 'no matching words']) {
        invalid(cite(2, 'request-blocks', text), unfound)
      }
    })

    test('quotes a substring of a message', () => {
      expect(cite(1, 'request-string', 'selected rows').exit).toBe(0)
      invalid(cite(1, 'request-string', 'Export every row.'), unfound)
    })

    test('matches only the structured answers of the question dialog, and a result of any other tool never counts', () => {
      expect(cite(11, 'dialog-answer', 'Stream, in input order').exit).toBe(0)
      expect(cite(15, 'dialog-answer-blocks', 'Nightly, after the backup').exit).toBe(0)
      // The tool result's content carries the question text and the host's wording, never the user's words.
      for (const [line, uuid, text] of [[11, 'dialog-answer', 'Which interface should the export use?'],
        [11, 'dialog-answer', 'The user answered'], [15, 'dialog-answer-blocks', 'How often should the export run?']]) {
        invalid(cite(line, uuid, text), unfound)
      }
      invalid(cite(13, 'command-output', 'Stream, in input order'), unfound)
      invalid(cite(7, 'tool-turn', 'ok'), unfound)
      invalid(cite(16, 'early-answer', 'An answer before its question'), unfound)
    })

    test('a note typed on a dialog answer counts, and the host placeholder and an option preview never do', () => {
      expect(cite(34, 'note-answer', 'Keep the ids, drop the audit columns').exit).toBe(0)
      invalid(cite(34, 'note-answer', '(notes only)'), unfound)
      // Without a note on its question, an answer that reads `(notes only)` is the user's own text.
      expect(cite(42, 'typed-placeholder', '(notes only)').exit).toBe(0)
      invalid(cite(36, 'preview-answer', '1,Ada'), unfound)
      expect(cite(36, 'preview-answer', 'Quote every field').exit).toBe(0)
      invalid(cite(37, 'early-note', 'A note before its question'), unfound)
      invalid(cite(39, 'meta-note', 'A note in a meta record'), failed + 'an injected meta record is not the user\'s words')
      invalid(cite(40, 'notification-note', 'A note in a notification'), failed + 'a user record of origin "task-notification" is not the user\'s words')
    })

    test('a message queued by the user while the session worked counts, a queued command of any other origin never', () => {
      expect(cite(20, 'queued-human', 'Skip the empty rows.').exit).toBe(0)
      invalid(cite(20, 'queued-human', 'queued reminder'), unfound)
      invalid(cite(20, 'queued-task', 'Skip the empty rows.'), failed + 'expected a queued message with the cited uuid')
      invalid(cite(21, 'queued-task', 'Skip the empty rows.'), failed + 'a queued command of origin "task-notification" is not the user\'s words')
      invalid(cite(22, 'queued-no-origin', 'Skip the empty rows.'), failed + 'a queued command of origin null is not the user\'s words')
      // A queued message that carries an image beside its text has a block array as its prompt.
      expect(cite(43, 'queued-image', 'Keep the header row.').exit).toBe(0)
      invalid(cite(43, 'queued-image', 'iVBORw0KGgo'), unfound)
      invalid(cite(23, 'other-attachment', 'Skip the empty rows.'), failed + 'expected a user record with the cited uuid')
    })

    test('comes only from a message the user wrote', () => {
      invalid(cite(26, 'notification', 'Approved, go ahead.'), failed + 'a user record of origin "task-notification" is not the user\'s words')
      invalid(cite(27, 'meta', 'Approved, go ahead.'), failed + 'an injected meta record is not the user\'s words')
      invalid(cite(28, 'command-stdout', 'Approved, go ahead.'), failed + 'a user record of origin null is not the user\'s words')
      invalid(cite(31, 'meta-answer', 'January, then every month'), failed + 'an injected meta record is not the user\'s words')
      invalid(cite(32, 'notification-answer', 'January, then every month'), failed + 'a user record of origin "task-notification" is not the user\'s words')
      expect(cite(29, 'approval', 'Approved, go ahead.').exit).toBe(0)
    })
  })

  describe('an assistant entry', () => {
    const unfound = 'entry 1.text: not found in the cited assistant message'
    const assistant = (line, uuid, text) => cite(line, uuid, text, 'assistant')

    test('quotes a text block, the question text of a dialog call or the content of a Write call', () => {
      expect(assistant(8, 'offer', 'Two shapes: (a) stream the rows')).toMatchObject({ exit: 0, err: '' })
      expect(assistant(3, 'assistant-record', 'Export the selected rows.')).toMatchObject({ exit: 0, err: '' })
      for (const text of ['Which interface should the export use?', 'Rows leave one at a time.', 'Batch']) {
        expect([text, assistant(10, 'dialog-call', text).exit]).toEqual([text, 0])
      }
      expect(assistant(44, 'plan-write', 'Group the rows by month and total each month.')).toMatchObject({ exit: 0, err: '' })
      expect(assistant(44, 'plan-write', 'The plan is written.')).toMatchObject({ exit: 0, err: '' })
    })

    test('never quotes the input of another tool or a text the record does not hold', () => {
      invalid(assistant(45, 'plan-command', 'Total each quarter.'), unfound)
      invalid(assistant(12, 'command-call', 'Stream, in input order'), unfound)
      invalid(assistant(44, 'plan-write', 'plan.html'), unfound)
      invalid(assistant(8, 'offer', 'Three shapes.'), unfound)
    })

    test('cites an assistant record, never a message of the user', () => {
      invalid(assistant(9, 'answer', 'Stream the rows.'), 'entry 1: transcript reference failed: expected an assistant record with the cited uuid')
      invalid(assistant(20, 'queued-human', 'Skip the empty rows.'), 'expected an assistant record with the cited uuid')
    })
  })

  test('--base takes one entry per repository of the tree and checks the list against the tree', () => {
    // A tree root that is no repository and holds two, as a repo-tool task tree does.
    const tree = join(scratch, `${serial++}-tree`)
    const git = (repository, ...command) => {
      const result = Bun.spawnSync(['git', '-C', join(tree, repository), ...command], { stdout: 'pipe', stderr: 'pipe' })
      expect([command[0], result.exitCode]).toEqual([command[0], 0])
      return result.stdout.toString().trim()
    }
    const repository = path => {
      mkdirSync(join(tree, path), { recursive: true })
      git(path, 'init', '--quiet', '--initial-branch=main')
      // Each repository holds its own name, so the two commits differ.
      writeFileSync(join(tree, path, 'notes.txt'), path + '\n')
      git(path, 'add', '--', 'notes.txt')
      git(path, 'commit', '--quiet', '-m', 'fixture: record the notes')
      return git(path, 'rev-parse', '--verify', 'HEAD^{commit}')
    }
    const api = repository('api')
    const web = repository('web')
    const checkIn = (directory, list, ...options) => {
      const result = Bun.spawnSync([process.execPath, tool, join(fixtures, 'valid.yaml'), '--transcripts', fixtures,
        '--base', JSON.stringify(list), ...options], { cwd: directory })
      return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
    }
    const inTree = (list, ...options) => checkIn(tree, list, ...options)
    const complete = [{ path: 'api', sha: api }, { path: 'web', sha: web }]
    expect(inTree(complete)).toMatchObject({ exit: 0, err: '' })
    const proofOf = (list, ...options) => JSON.parse(inTree(list, '--json', ...options).out).proof
    const spec = join(fixtures, 'valid.yaml')
    expect(proofOf(complete)).toBe(fingerprint({ spec, transcripts: fixtures, base: complete, partialBase: false, tree: realpathSync(tree) }))
    expect(proofOf(complete.slice(0, 1), '--partial-base'))
      .toBe(fingerprint({ spec, transcripts: fixtures, base: complete.slice(0, 1), partialBase: true, tree: realpathSync(tree) }))
    // Another checkout of the same repositories passes the same list with the proof of its own tree.
    const copy = join(scratch, `${serial++}-copy`)
    for (const path of ['api', 'web']) {
      expect(Bun.spawnSync(['git', 'clone', '--quiet', join(tree, path), join(copy, path)]).exitCode).toBe(0)
    }
    const copied = checkIn(copy, complete, '--json')
    expect([copied.exit, copied.err]).toEqual([0, ''])
    expect(JSON.parse(copied.out).proof).toBe(fingerprint({ spec, transcripts: fixtures, base: complete, partialBase: false, tree: realpathSync(copy) }))
    expect(JSON.parse(copied.out).proof).not.toBe(proofOf(complete))
    invalid(inTree(complete.slice(0, 1)), '--base leaves out the git repositories at web')
    invalid(inTree([{ path: 'api', sha: web }, complete[1]]), `--base commit ${web} is not in the repository at api`)
    invalid(inTree([...complete, { path: '.', sha: api }]), '--base path . is not the top level of a git repository')
    invalid(inTree([{ path: 'api/../web', sha: web }]), '--base names a path of another form')
    invalid(inTree([complete[0], complete[0]]), '--base names the path api twice')
    invalid(inTree([{ path: 'api', sha: api.slice(0, 12) }]), '--base carries no full commit ID for api')
    invalid(inTree([]), '--base expects a non-empty JSON list')
    // A partial list names only the repositories a unit changes and skips the search for the others,
    // while every listed repository and commit is still checked.
    expect(inTree(complete.slice(0, 1), '--partial-base')).toMatchObject({ exit: 0, err: '' })
    invalid(inTree([{ path: 'api', sha: web }], '--partial-base'), `--base commit ${web} is not in the repository at api`)
    invalid(inTree([...complete, { path: '.', sha: api }], '--partial-base'), '--base path . is not the top level of a git repository')
    const bare = Bun.spawnSync([process.execPath, tool, join(fixtures, 'valid.yaml'), '--transcripts', fixtures, '--partial-base'], { cwd: tree })
    expect(bare.exitCode).not.toBe(0)
    expect(bare.stderr.toString()).toContain('Usage:')
  })

  test('the tool knows no private record, design document or launch values in spec mode: those options are refused', async () => {
    for (const option of ['--record', '--render', '--check-render']) {
      const path = join(scratch, `refused${option}.md`)
      invalid(fixture('valid', [option, path]), `Unknown option '${option}'`)
      expect(await Bun.file(path).exists()).toBe(false)
      const list = Bun.spawnSync([process.execPath, tool, '--fix-list', join(root, 'tests/fixtures/fix-list/list.yaml'),
        '--transcripts', fixtures, option, path], { cwd: root })
      expect([list.exitCode, list.stderr.toString().includes(`Unknown option '${option}'`)]).toEqual([1, true])
    }
    invalid(fixture('valid', ['--entries']), 'Usage')
    invalid(fixture('valid', ['--expect', '{}']), "Unknown option '--expect'")
  })

  test('specLines counts the non-blank lines of the entries\' text, and nothing else', () => {
    const count = edit => JSON.parse(changed(edit, ['--json']).out).specLines
    expect(count(() => {})).toBe(9)
    // The file, line, uuid and author of an entry and the unit are not text and add nothing.
    expect(count(s => { s.unit = 'example-export\n\nwith a longer name' })).toBe(9)
    // A text of two paragraphs counts both of their lines, and the blank line between them none.
    expect(JSON.parse(said('One line.\n\nAnother line.', ['--json']).out).specLines).toBe(2)
    expect(changed(() => {}).out).toContain(' specLines=9 ')
  })

  describe('the width rule on an entry\'s text', () => {
    // Words of four letters, so n of them joined by spaces are 5n - 1 characters wide.
    const words = n => Array(n).fill('word').join(' ')
    const failsWith = (text, message) => invalid(said(text), `entry 1.text: ${message}`)
    const url = 'https://example.com/' + 'a'.repeat(110)

    test('a correctly wrapped paragraph, bullet list, nested list, ordered list and code block pass', () => {
      const text = [words(24), words(3) + '.', '',
        '- ' + words(23), '  ' + words(23), '  end.', '  - ' + words(23), '    tail.', '- second', '',
        '1. ' + words(23), '   end.', '2. two', '',
        '```js', 'const short = 1', '', 'const next = 2', '```', ''].join('\n')
      const result = said(text, ['--json'])
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
      expect(said('Intro:\n- ' + words(2) + '\n- ' + words(2)).exit).toBe(0)
    })

    test('a paragraph in a block quote is held to the fill rule like any other', () => {
      failsWith('> ' + words(3) + '\n> ' + words(3) + '.', 'line 1 is not full: the first word of line 2 fits on it')
      expect(said('> ' + words(23) + '\n> ' + words(3) + '.').exit).toBe(0)
    })

    test('a list item whose first line is empty holds the text below it to the fill rule', () => {
      failsWith('-\n  ' + words(3) + '\n  ' + words(3) + '.', 'line 2 is not full: the first word of line 3 fits on it')
      expect(said('-\n  ' + words(23) + '\n  end.').exit).toBe(0)
    })

    test('quoted words wrap like any other text: only their words and punctuation are held verbatim', () => {
      // The message is one long line, and the entry wraps it at the width.
      const session = join(scratch, 'wrapped-session.jsonl')
      writeFileSync(session, JSON.stringify({ type: 'user', uuid: 'long', origin: { kind: 'human' }, message: { content: words(30) } }) + '\n')
      const entry = text => written({ unit: 'example', entries: [{ file: session, line: 1, uuid: 'long', author: 'user', text }] })
      expect(run(entry(words(24) + '\n' + words(6)))).toMatchObject({ exit: 0, err: '' })
      invalid(run(entry(words(30))), 'entry 1.text: line 1 is 149 characters, over 120')
    })

    test('a code line over 120 characters fails, and short code lines are never held to the fill rule', () => {
      failsWith('```\n' + words(25) + '\n```', 'line 2 is 124 characters, over 120')
      expect(said('```\nshort\nlines\n```').exit).toBe(0)
      // A row of spaces is measured whole, and holds no word that could excuse it.
      failsWith('```\n' + ' '.repeat(121) + '\n```', 'line 2 is 121 characters, over 120')
    })

    test('a line holding one word that does not fit passes and is named in the summary', () => {
      const text = 'See\n' + url + '\nfor details.'
      const json = said(text, ['--json'])
      expect(json.exit).toBe(0)
      expect(JSON.parse(json.out).unbreakable).toEqual([{ field: 'entry 1.text', line: 2 }])
      expect(said('- ' + url).exit).toBe(0)
      expect(said(text).out).toContain(' unbreakable=[{"field":"entry 1.text","line":2}] ')
      // A long word beside other words is no exception: the line breaks before the word.
      failsWith('See ' + url, 'line 1 is 134 characters, over 120')
      // A word that fits within the width is no exception, however far it is indented.
      failsWith('- ' + ' '.repeat(10) + 'x'.repeat(110), 'line 1 is 122 characters, over 120')
    })

    test('a folded scalar is checked as the lines it folds into', async () => {
      const session = join(scratch, 'folded-session.jsonl')
      writeFileSync(session, JSON.stringify({ type: 'user', uuid: 'long', origin: { kind: 'human' }, message: { content: words(40) } }) + '\n')
      const folded = rows => run(written(['unit: example', 'entries:', `  - file: ${session}`, '    line: 1', '    uuid: long',
        '    author: user', '    text: >', ...rows.map(row => '      ' + row), ''].join('\n')))
      expect(folded(['word word', 'word'])).toMatchObject({ exit: 0, err: '' })
      invalid(folded([words(20), words(20)]), 'entry 1.text: line 1 is 199 characters, over 120')
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

const fixLists = join(root, 'tests/fixtures/fix-list')
const validPath = join(fixLists, 'list.yaml')
const reviewListPath = join(fixLists, 'review-list.yaml')
const validList = Bun.YAML.parse(await Bun.file(validPath).text())
const parentResultPath = 'tests/fixtures/fix-list/results/parent-run.json'
const reviewResultPath = 'tests/fixtures/fix-list/results/review-pass.json'
const parentOutput = await Bun.file(join(root, parentResultPath)).json()
const validEntries = parentOutput.result.toFix
const checkList = (path, options = [], cwd = root) => {
  const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, ...options], { cwd })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const changedList = (edit, options = []) => {
  const list = structuredClone(validList)
  edit(list)
  return checkList(written(list), options)
}
const makeList = (file, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, '--make-fix-list', file, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const writeEditedParentResult = edit => {
  const output = structuredClone(parentOutput)
  edit(output.result)
  const path = join(scratch, `${serial++}-result.json`)
  writeFileSync(path, JSON.stringify(output))
  return path
}
const parentSpecPath = 'tests/fixtures/fix-list/parent.yaml'
const parentSpecSha = createHash('sha256').update(new Uint8Array(await Bun.file(join(root, parentSpecPath)).arrayBuffer())).digest('hex')
const sourcesOf = list => list.entries.map(entry => entry.source)
const measured = { codeAdded: 21, repositories: [{ path: '.', base: 'a'.repeat(40), candidate: 'b'.repeat(40) }] }
// The proof of the fixture list checked in the repository root without a base list.
const listProof = (fields = {}) =>
  fingerprint({ fixList: validPath, spec: parentSpecPath, entries: validEntries, artifacts: [], base: null, partialBase: false, tree: here, ...fields })

describe('fix list validation', () => {
  test('a valid fix list passes with the proof of its values, its spec, and its entries on request, in both output forms', async () => {
    const proof = listProof()
    const bytes = await Bun.file(validPath).arrayBuffer()
    const summary = { result: parentResultPath, spec: parentSpecPath, specSha256: parentSpecSha, specLines: 1, artifacts: [],
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), proof, fixList: validPath }
    const brief = checkList(validPath, ['--json'])
    expect([brief.exit, brief.err]).toEqual([0, ''])
    expect(JSON.parse(brief.out)).toEqual(summary)
    const full = checkList(validPath, ['--json', '--entries'])
    expect([full.exit, full.err]).toEqual([0, ''])
    expect(JSON.parse(full.out)).toEqual({ entries: validEntries, ...summary })
    const plain = checkList(validPath)
    expect([plain.exit, plain.err]).toEqual([0, ''])
    expect(plain.out).toStartWith(`entries=6 result=${parentResultPath} spec=${parentSpecPath} sha256=${summary.sha256} proof=${proof} fixList=`)
    invalid(checkList(validPath, ['--entries']), 'Usage')
  })

  test('the generated fix list names the saved result by its absolute path and holds the spec and every item the run returned to be fixed, in its order', () => {
    const made = makeList(parentResultPath)
    expect([made.exit, made.err]).toEqual([0, ''])
    expect(Bun.YAML.parse(made.out)).toEqual({ result: join(root, parentResultPath), spec: parentSpecPath, entries: validEntries })
    expect(sourcesOf(Bun.YAML.parse(made.out))).toEqual(['impl:0', 'verify:0', 'verify:1', 'verify:2', 'issue:0', 'roaster:0'])
    const checked = checkList(written(made.out), ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
  })

  test('the fix list of a fix run carries on the spec and holds the entries its fixer left open beside its roast and diff findings', () => {
    const items = [{ source: 'entry:2', entry: validList.entries[2] }, { source: 'roaster:0', finding: validEntries[5].finding },
      { source: 'diff:0', finding: { ...validEntries[5].finding, severity: 'CRITICAL', claim: 'The change also renames a helper.' } }]
    const made = makeList(writeEditedParentResult(result => { result.toFix = items }))
    expect([made.exit, made.err]).toEqual([0, ''])
    const list = Bun.YAML.parse(made.out)
    expect([list.spec, list.entries]).toEqual([parentSpecPath, items])
    const checked = checkList(written(list), ['--json'])
    expect([checked.exit, checked.err, JSON.parse(checked.out).specSha256, JSON.parse(checked.out).specLines]).toEqual([0, '', parentSpecSha, 1])
  })

  test('a run in which a stage failed gives no fix list and fails the check of its list, whatever its exit', () => {
    const message = 'FAIL-FAST: roast returned no complete result after 3 attempts: roaster unavailable'
    const stageFailure = { kind: 'stage-failure', severity: 'CRITICAL', item: { label: 'roast', message } }
    const refusal = `a stage of the run failed, and an incomplete run gets no fix list: roast: ${message}`
    for (const exit of ['failed', 'root-resolution', 'aborted']) {
      const saved = writeEditedParentResult(result => { result.exit = exit; result.remaining = [stageFailure] })
      invalid(makeList(saved), refusal)
      invalid(checkList(written({ ...validList, result: saved })), `impl:0: ${refusal}`)
    }
    invalid(makeList(writeEditedParentResult(result => { delete result.remaining })), 'the run result holds no remaining list')
  })

  test('a run in which a stage raised a hard flag gives no fix list and fails the check of its list, whatever its exit', () => {
    const reason = 'The correction patches a mechanism the user\'s words describe as removed.'
    const flag = { kind: 'abort', severity: 'CRITICAL', item: { label: 'fix', abort: { trigger: 'sense-check', reason } } }
    const refusal = `a stage of the run raised a hard flag, and only a new run that receives the user's answer continues the unit: fix: ${reason}`
    for (const exit of ['aborted', 'root-resolution']) {
      const saved = writeEditedParentResult(result => { result.exit = exit; result.remaining = [flag] })
      invalid(makeList(saved), refusal)
      invalid(checkList(written({ ...validList, result: saved })), `impl:0: ${refusal}`)
    }
  })

  test('the implementer artifacts of the parent run are printed by the check of its list and covered by its proof', () => {
    const artifacts = [{ path: '/tree/.cache/visual/captures/impl-before', what: 'the screen at the base commit' }]
    const saved = writeEditedParentResult(result => { result.artifacts = artifacts })
    const checked = checkList(written({ ...validList, result: saved }), ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    const printed = JSON.parse(checked.out)
    expect(printed.artifacts).toEqual(artifacts)
    expect(printed.proof).not.toBe(fingerprint({ fixList: printed.fixList, spec: parentSpecPath, entries: validEntries, artifacts: [],
      base: null, partialBase: false, tree: here }))
    expect(printed.proof).toBe(fingerprint({ fixList: printed.fixList, spec: parentSpecPath, entries: validEntries, artifacts,
      base: null, partialBase: false, tree: here }))
    invalid(makeList(writeEditedParentResult(result => { delete result.artifacts })), 'the run result holds no artifacts list')
    for (const strange of [{ path: '/tree/capture' }, { ...artifacts[0], kind: 'capture' }, { path: 7, what: 'a capture' }, 'capture']) {
      invalid(makeList(writeEditedParentResult(result => { result.artifacts = [...artifacts, strange] })), 'the run result holds artifact 2 in another form')
    }
  })

  test('a file without a run result and a result of an earlier version give no fix list', () => {
    invalid(makeList(writeEditedParentResult(result => { delete result.toFix })), 'the run result holds no toFix list, as a run of an earlier version of the scripts')
    invalid(makeList(writeEditedParentResult(result => { result.toFix = [] })), 'the run returned nothing to fix')
    const absent = join(scratch, 'absent-result.json')
    invalid(makeList(absent), `the run result ${absent} is unreadable or no JSON`)
    const unparsed = written('not json')
    invalid(makeList(unparsed), `the run result ${unparsed} is unreadable or no JSON`)
    const bare = join(scratch, `${serial++}-bare.json`)
    writeFileSync(bare, JSON.stringify({ summary: 'A workflow whose script returned nothing.' }))
    invalid(makeList(bare), `${bare} holds no run result`)
  })

  test('every item of a run result has a source of a known form and the one mapping it names, and its spec a path, a sha256 and a line count', () => {
    for (const [edit, message] of [
      [result => { result.toFix[1].source = 'correctness:1' }, 'the run result holds item 2 of toFix in another form'],
      [result => { result.toFix[1].correction = 'Close the handle.' }, 'the run result holds item 2 of toFix in another form'],
      [result => { result.toFix[0] = { source: 'impl:0', decision: result.toFix[0].finding } }, 'the run result holds item 1 of toFix in another form'],
      [result => { result.toFix[5].finding = 'The handle leaks.' }, 'the run result holds item 6 of toFix in another form'],
      [result => { result.toFix.push({ source: 'size', size: { specLines: 1, ...measured } }) }, 'the run result holds item 7 of toFix in another form'],
      [result => { delete result.spec.lines }, 'the run result names the spec its check passed on in another form'],
      [result => { result.spec.lines = -1 }, 'the run result names the spec its check passed on in another form'],
      [result => { result.spec.lines = 0 }, 'the run result names the spec its check passed on in another form'],
      [result => { result.spec.sha256 = 'abc' }, 'the run result names the spec its check passed on in another form'],
      [result => { result.spec.sha256 = result.spec.sha256.toUpperCase() }, 'the run result names the spec its check passed on in another form'],
      [result => { result.spec = parentSpecPath }, 'the run result names the spec its check passed on in another form'],
    ]) invalid(makeList(writeEditedParentResult(edit)), message)
  })

  test('a run result that holds a source twice gives no fix list and fails the check of its list', () => {
    const saved = writeEditedParentResult(result => { result.toFix.push(structuredClone(result.toFix[5])) })
    const refusal = 'the run result holds the source roaster:0 twice in toFix'
    invalid(makeList(saved), refusal)
    invalid(checkList(written({ ...validList, result: saved })), `roaster:0: ${refusal}`)
  })

  test('the fix list of a review pass holds the findings of every review seat and names no spec', async () => {
    const made = makeList(reviewResultPath)
    expect([made.exit, made.err]).toEqual([0, ''])
    const list = Bun.YAML.parse(made.out)
    const fixture = Bun.YAML.parse(await Bun.file(reviewListPath).text())
    expect(list).toEqual({ ...fixture, result: join(root, reviewResultPath) })
    expect([fixture.spec, sourcesOf(fixture)]).toEqual([null, ['review:correctness:0', 'review:rules:0']])
    const checked = checkList(reviewListPath, ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    const bytes = await Bun.file(reviewListPath).arrayBuffer()
    expect(JSON.parse(checked.out)).toEqual({ result: reviewResultPath, spec: null, artifacts: [],
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      proof: listProof({ fixList: reviewListPath, spec: null, entries: list.entries }), fixList: reviewListPath })
    invalid(checkList(written({ ...list, spec: parentSpecPath })), 'fix list.spec: expected null, because the parent run checked no spec')
    invalid(makeList(reviewResultPath, ['--size', JSON.stringify(measured)]), '--size: the parent run counted no spec lines to measure a size breach against')
  })

  test('the generated fix list finds its saved result from another directory, such as the worktree of a fix run', () => {
    const made = makeList(reviewResultPath)
    expect([made.exit, made.err]).toEqual([0, ''])
    const checked = checkList(written(made.out), [], scratch)
    expect([checked.exit, checked.err]).toEqual([0, ''])
  })

  test('a measured size breach joins the generated list beside the spec lines the parent run counted', () => {
    const made = makeList(parentResultPath, ['--size', JSON.stringify(measured)])
    expect([made.exit, made.err]).toEqual([0, ''])
    const list = Bun.YAML.parse(made.out)
    expect(list.entries.at(-1)).toEqual({ source: 'size', size: { specLines: 1, ...measured } })
    expect(sourcesOf(list)).toEqual([...validEntries.map(e => e.source), 'size'])
    expect(checkList(written(list)).exit).toBe(0)
    invalid(checkList(written({ ...list, entries: [list.entries.at(-1), ...list.entries.slice(0, -1)] })),
      'size: out of order: the parent run returned impl:0 in this place')
    invalid(checkList(written({ ...list, entries: list.entries.map(e => e.source === 'size' ? { ...e, size: { ...e.size, specLines: 2 } } : e) })),
      "size: specLines: expected 1, the spec lines the parent run's spec check counted")
    for (const [size, message] of [
      ['{', '--size expects a JSON mapping of codeAdded and repositories: '],
      ['[]', '--size expects a JSON mapping of codeAdded and repositories'],
      [JSON.stringify({ ...measured, codeAdded: -1 }), 'codeAdded: expected the count of implementation lines added'],
      [JSON.stringify({ ...measured, repositories: [{ path: '.', base: 'main', candidate: 'b'.repeat(40) }] }), 'repositories: expected a non-empty list'],
      [JSON.stringify({ ...measured, specLines: 3 }), "specLines: expected 1, the spec lines the parent run's spec check counted"],
      [JSON.stringify({ codeAdded: 21 }), 'repositories: missing field'],
    ]) invalid(makeList(parentResultPath, ['--size', size]), message)
  })

  test.each([
    ['an unknown result', l => { l.result = 'tests/fixtures/fix-list/results/missing.json' },
      'verify:1: the run result tests/fixtures/fix-list/results/missing.json is unreadable or no JSON'],
    ['the result of another run', l => { l.result = reviewResultPath }, 'verify:1: the parent run returned no item to fix under this source'],
    ['an index out of range', l => { l.entries[2].source = 'verify:3' }, 'verify:3: the parent run returned no item to fix under this source'],
    ['a deleted entry', l => { l.entries.splice(2, 1) }, 'verify:1: missing, and the parent run returned it to be fixed'],
    ['an added entry', l => { l.entries.push({ source: 'verify:7', decision: validEntries[1].decision }) }, 'verify:7: the parent run returned no item to fix under this source'],
    ['an edited decision', l => { l.entries[2].decision.correction = 'Return the error to the caller.' }, 'verify:1.decision: differs from the parent run\'s result'],
    ['an edited finding', l => { l.entries[5].finding.claim = 'The handle leaks.' }, 'roaster:0.finding: differs from the parent run\'s result'],
    ['a reordered list', l => { l.entries.reverse() }, 'roaster:0: out of order: the parent run returned impl:0 in this place'],
    ['a decision under a roaster source', l => { l.entries[5] = { source: 'roaster:0', decision: l.entries[5].finding } }, 'roaster:0.decision: unknown key'],
  ])('%s fails with a violation naming the entry', (name, edit, message) => {
    const result = changedList(edit)
    invalid(result, message)
    expect(result.err).not.toContain('proof')
  })

  test('a failure of the result names every entry', () => {
    const result = changedList(l => { l.result = 'tests/fixtures/fix-list/results/missing.json' })
    for (const source of sourcesOf(validList)) invalid(result, `: ${source}: the run result tests/fixtures/fix-list/results/missing.json`)
    expect(result.err.trim().split('\n')).toHaveLength(validList.entries.length)
  })

  test('the spec is the one the parent run checked, unchanged', () => {
    invalid(changedList(l => { l.spec = 'tests/fixtures/spec/valid.yaml' }), 'fix list.spec: expected the spec the parent run checked, tests/fixtures/fix-list/parent.yaml')
    invalid(changedList(l => { l.spec = null }), 'fix list.spec: expected the spec the parent run checked, tests/fixtures/fix-list/parent.yaml')
    const copy = join(scratch, 'parent-copy')
    cpSync(join(fixLists, 'results'), join(copy, 'tests/fixtures/fix-list/results'), { recursive: true })
    writeFileSync(join(copy, parentSpecPath), 'unit: changed\n')
    const result = checkList(validPath, [], copy)
    expect([result.exit, result.err.includes('fix list.spec: changed since the parent run checked it')]).toEqual([1, true])
  })

  test.each([
    ['an unknown list key', l => { l.extra = true }, 'fix list.extra: unknown key'],
    ['a findings key', l => { l.findings = ['correctness:1'] }, 'fix list.findings: unknown key'],
    ['the keys of a spec', l => { l.unit = 'example' }, 'fix list.unit: unknown key'],
    ['the run key of an earlier version', l => { l.run = 'wf_parent-run' }, 'fix list.run: unknown key'],
    ['a missing result', l => { delete l.result }, 'fix list.result: missing field'],
    ['a result that names no file', l => { l.result = 7 }, 'fix list.result: expected a non-empty string'],
    ['a missing spec', l => { delete l.spec }, 'fix list.spec: missing field'],
    ['missing entries', l => { delete l.entries }, 'fix list.entries: missing field'],
    ['empty entries', l => { l.entries = [] }, 'entries: expected a non-empty list'],
    ['an entry with a correction', l => { l.entries[5].correction = 'Close the handle.' }, 'roaster:0.correction: unknown key'],
    ['an entry with pointers', l => { l.entries[5].attach = [] }, 'roaster:0.attach: unknown key'],
    ['a reviewer source', l => { l.entries[5].source = 'correctness:1' },
      'entry 6.source: expected impl:<index>, verify:<index>, issue:<index>, roaster:<index>, diff:<index>, review:<seat>:<index>, entry:<index>, size: "correctness:1"'],
    ['a duplicate source', l => { l.entries.push(structuredClone(l.entries[1])) }, 'verify:0: duplicate source verify:0'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changedList(edit), message))

  test('a spec is no fix list, and a fix list is no spec', () => {
    invalid(checkList(join(fixtures, 'valid.yaml')), 'fix list.unit: unknown key')
    invalid(run(validPath), 'spec.result: unknown key')
  })

  test('an unreadable fix list or a parent result that is no JSON fails', () => {
    invalid(checkList(join(scratch, 'absent-list.yaml')), 'fix list: unreadable or malformed YAML')
    const unparsed = written('{"result": ')
    invalid(checkList(written({ ...validList, entries: [validList.entries[5]], result: unparsed })), `roaster:0: the run result ${unparsed} is unreadable or no JSON`)
  })

  test.each([
    ['a changed decision', v => { v.entries[1].decision.correction = 'Log the error and continue.' }],
    ['a correction beside the finding', v => { v.entries[5].correction = 'Close the file handle.' }],
    ['another spec', v => { v.spec = 'tests/fixtures/spec/valid.yaml' }],
    ['a missing entry', v => { v.entries.pop() }],
    ['reordered entries', v => { v.entries.reverse() }],
    ['an entry the list does not hold', v => { v.entries.push({ ...v.entries[1], source: 'verify:7' }) }],
    ['an artifact the parent run did not return', v => { v.artifacts.push({ path: '/tree/.cache/visual/after', what: 'the screen after the fix' }) }],
    ['another fix list', v => { v.fixList = join(scratch, 'other-list.yaml') }],
    ['a base list', v => { v.base = [{ path: '.', sha: 'a'.repeat(40) }] }],
    ['another tree', v => { v.tree = scratch }],
  ])('launch values with %s give another proof than the list', (name, edit) => {
    const values = { fixList: validPath, spec: parentSpecPath, entries: structuredClone(validEntries), artifacts: [], base: null, partialBase: false, tree: here }
    const printed = JSON.parse(checkList(validPath, ['--json']).out).proof
    expect(fingerprint(values)).toBe(printed)
    edit(values)
    expect(fingerprint(values)).not.toBe(printed)
  })

  test('--base beside --fix-list is checked against the tree, printed, and covered by the proof', () => {
    const head = Bun.spawnSync(['git', '-C', root, 'rev-parse', '--verify', 'HEAD^{commit}']).stdout.toString().trim()
    const base = [{ path: '.', sha: head }]
    const checked = checkList(validPath, ['--json', '--base', JSON.stringify(base)])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    expect(JSON.parse(checked.out)).toMatchObject({ base, proof: listProof({ base }) })
    expect(JSON.parse(checkList(validPath, ['--json', '--base', JSON.stringify(base), '--partial-base']).out).proof)
      .toBe(listProof({ base, partialBase: true }))
    expect(JSON.parse(checkList(validPath, ['--json']).out)).not.toHaveProperty('base')
    invalid(checkList(validPath, ['--base', JSON.stringify([{ path: '.', sha: 'f'.repeat(40) }])]), `--base commit ${'f'.repeat(40)} is not in the repository at .`)
    invalid(checkList(validPath, ['--base', JSON.stringify([...base, { path: 'tests', sha: head }])]), '--base path tests is not the top level of a git repository')
  })

  test('the launch values are no option of the tool any more, and only their proof is', () => {
    invalid(checkList(validPath, ['--expect', JSON.stringify({ spec: parentSpecPath, entries: validEntries })]), "Unknown option '--expect'")
    expect(JSON.parse(checkList(validPath, ['--json', '--proof', listProof()]).out).proof).toBe(listProof())
    const launched = listProof({ entries: validEntries.slice(1) })
    invalid(checkList(validPath, ['--json', '--proof', launched]), `the checked values give the proof ${listProof()}, and the run launched with the proof ${launched}`)
  })

  test('a spec argument or a transcript directory beside --fix-list, --partial-base without --base, and a spec option beside --make-fix-list are usage errors, and --size belongs to --make-fix-list alone', () => {
    for (const options of [[join(fixtures, 'valid.yaml')], ['--partial-base'], ['--size', JSON.stringify(measured)], ['--transcripts', fixtures]]) {
      invalid(checkList(validPath, options), 'Usage')
    }
    invalid(run(join(fixtures, 'valid.yaml'), ['--size', JSON.stringify(measured)]), 'Usage')
    for (const options of [['--json'], ['--fix-list', validPath], ['--entries'], [join(fixtures, 'valid.yaml')], ['--proof', listProof()], ['--transcripts', fixtures]]) {
      const made = makeList(parentResultPath, options)
      expect([options.join(' '), made.exit, made.err.includes('Usage')]).toEqual([options.join(' '), 1, true])
    }
  })
})
