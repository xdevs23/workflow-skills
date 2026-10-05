import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
const transcripts = join(fixLists, 'transcripts')
const validPath = join(fixLists, 'list.yaml')
const reviewListPath = join(fixLists, 'review-list.yaml')
const validList = Bun.YAML.parse(await Bun.file(validPath).text())
const checkList = (path, options = [], cwd = root) => {
  const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', transcripts, ...options], { cwd })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const changedList = (edit, options = []) => {
  const list = structuredClone(validList)
  edit(list)
  return checkList(written(list), options)
}
const makeList = (run, options = [], cwd = root) => {
  const result = Bun.spawnSync([process.execPath, tool, '--make-fix-list', run, '--transcripts', transcripts, ...options], { cwd })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const journalOf = path => Bun.file(join(transcripts, path)).text().then(body => body.trim().split('\n').map(line => JSON.parse(line)))
const journal = await journalOf('session-a/subagents/workflows/wf_parent-run/journal.jsonl')
const resultOf = (records, key) => records.find(record => record.type === 'result' && record.key === key).result
const parentVerify = resultOf(journal, 'parent-verify-2')
const parentSpecPath = 'tests/fixtures/fix-list/parent.yaml'
const parentSpecSha = createHash('sha256').update(new Uint8Array(await Bun.file(join(root, parentSpecPath)).arrayBuffer())).digest('hex')
const validEntries = [
  { source: 'impl:0', finding: resultOf(journal, 'parent-impl').specFindings[0] },
  ...parentVerify.decisions.map((decision, index) => ({ source: `verify:${index}`, decision })),
  { source: 'issue:0', issue: parentVerify.issues[0] },
  { source: 'roaster:0', finding: resultOf(journal, 'parent-roast').findings[0] },
]
const sourcesOf = list => list.entries.map(entry => entry.source)
const measured = { codeAdded: 21, repositories: [{ path: '.', base: 'a'.repeat(40), candidate: 'b'.repeat(40) }] }
// The proof of the fixture list checked in the repository root without a base list.
const listProof = (fields = {}) =>
  fingerprint({ fixList: validPath, transcripts, spec: parentSpecPath, entries: validEntries, base: null, partialBase: false, tree: here, ...fields })
// A copy of the fixture transcripts in which edit changes the records of the fix run's journal.
const fixRunJournal = 'session-c/subagents/workflows/wf_fix-run/journal.jsonl'
const editedTranscripts = (edit, journal = fixRunJournal) => {
  const copy = join(scratch, `${serial++}-transcripts`)
  cpSync(transcripts, copy, { recursive: true })
  const path = join(copy, journal)
  const records = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  edit(records)
  writeFileSync(path, records.map(record => JSON.stringify(record)).join('\n') + '\n')
  return copy
}
const makeIn = (sessions, run, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, '--make-fix-list', run, '--transcripts', sessions, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}

describe('fix list validation', () => {
  test('a valid fix list passes with the proof of its values, its spec, and its entries on request, in both output forms', async () => {
    const proof = listProof()
    const bytes = await Bun.file(validPath).arrayBuffer()
    const summary = { run: 'wf_parent-run', spec: parentSpecPath, specSha256: parentSpecSha, specLines: 1,
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), proof, fixList: validPath }
    const brief = checkList(validPath, ['--json'])
    expect([brief.exit, brief.err]).toEqual([0, ''])
    expect(JSON.parse(brief.out)).toEqual(summary)
    const full = checkList(validPath, ['--json', '--entries'])
    expect([full.exit, full.err]).toEqual([0, ''])
    expect(JSON.parse(full.out)).toEqual({ entries: validEntries, ...summary })
    const plain = checkList(validPath)
    expect([plain.exit, plain.err]).toEqual([0, ''])
    expect(plain.out).toStartWith(`entries=6 run=wf_parent-run spec=${parentSpecPath} sha256=${summary.sha256} proof=${proof} fixList=`)
    invalid(checkList(validPath, ['--entries']), 'Usage')
  })

  test('the generated fix list of a main run holds every spec finding, every decision and issue of the verifier, cleanup and approvals its fixer left open included, and every roast finding', () => {
    const made = makeList('wf_parent-run')
    expect([made.exit, made.err]).toEqual([0, ''])
    expect(parentVerify.decisions.map(d => d.action)).toEqual(['approve-fix', 'needs-decision', 'cleanup'])
    expect(Bun.YAML.parse(made.out)).toEqual({ run: 'wf_parent-run', spec: parentSpecPath, entries: validEntries })
    const checked = checkList(written(made.out), ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    invalid(makeList('wf_missing-run'), 'run wf_missing-run has no journal under the transcript directory')
    invalid(makeList('wf_other-run'), 'run wf_other-run did not finish: impl returned no result, so resume the run')
    invalid(makeList('../wf_parent-run'), 'expected a run id')
  })

  test('the fix list of a fix run carries on its spec and every entry its fixer left open, beside its roast and diff findings', async () => {
    const records = await journalOf('session-c/subagents/workflows/wf_fix-run/journal.jsonl')
    const answered = new Map(resultOf(records, 'fix-fix').dispositions.map(d => [d.key, d.disposition]))
    expect(validList.entries.map(e => answered.get(e.source))).toEqual(['question', 'fixed', 'blocked', 'rejected', 'blocked', 'fixed'])
    expect(resultOf(records, 'fix-diff').mappings.map(m => m.source)).toEqual(['verify:0'])
    const made = makeList('wf_fix-run')
    expect([made.exit, made.err]).toEqual([0, ''])
    expect(Bun.YAML.parse(made.out)).toEqual({ run: 'wf_fix-run', spec: parentSpecPath, entries: [
      { source: 'entry:2', entry: validList.entries[2] },
      { source: 'entry:4', entry: validList.entries[4] },
      { source: 'entry:5', entry: validList.entries[5] },
      { source: 'roaster:0', finding: resultOf(records, 'fix-roast').findings[0] },
      { source: 'diff:0', finding: resultOf(records, 'fix-diff').findings[0] }] })
    const checked = checkList(written(made.out), ['--json'])
    expect([checked.exit, checked.err, JSON.parse(checked.out).specSha256, JSON.parse(checked.out).specLines]).toEqual([0, '', parentSpecSha, 1])
    const copy = join(scratch, 'fix-run-copy')
    mkdirSync(join(copy, 'tests/fixtures/fix-list'), { recursive: true })
    writeFileSync(join(copy, 'tests/fixtures/fix-list/list.yaml'), 'run: changed\n')
    invalid(makeList('wf_fix-run', [], copy), "the fix list tests/fixtures/fix-list/list.yaml changed since the run's check read it")
  })

  test('a fix run whose check printed no spec lines still gives its fix list, but no size breach', () => {
    const older = editedTranscripts(records => {
      for (const record of records.filter(record => record.type === 'result' && record.key === 'fix-fix')) {
        const { specLines, ...printed } = JSON.parse(record.result.specCheck.stdout)
        record.result.specCheck.stdout = JSON.stringify(printed)
      }
    })
    const made = makeIn(older, 'wf_fix-run')
    expect([made.exit, made.err]).toEqual([0, ''])
    expect(sourcesOf(Bun.YAML.parse(made.out))).toEqual(['entry:2', 'entry:4', 'entry:5', 'roaster:0', 'diff:0'])
    const sized = makeIn(older, 'wf_fix-run', ['--size', JSON.stringify(measured)])
    expect([sized.exit, sized.err]).toEqual([1, '--size: the parent run counted no spec lines to measure a size breach against\n'])
  })

  test('a run whose check exited non-zero gives no fix list, whatever its check printed', () => {
    const failedFix = editedTranscripts(records => { resultOf(records, 'fix-fix').specCheck.exitCode = 1 })
    invalid(makeIn(failedFix, 'wf_fix-run'), 'the spec check of the run printed no passing result')
    const failedImpl = editedTranscripts(records => { resultOf(records, 'parent-impl').specCheck.exitCode = 1 },
      'session-a/subagents/workflows/wf_parent-run/journal.jsonl')
    invalid(makeIn(failedImpl, 'wf_parent-run'), 'the spec check of the run printed no passing result')
  })

  test('a fix run closes entries only through results it accepted, so a refused or aborted result closes none', () => {
    const resultOf = (records, key) => records.find(record => record.type === 'result' && record.key === key).result
    const open = sessions => {
      const made = makeIn(sessions, 'wf_fix-run')
      expect([made.exit, made.err]).toEqual([0, ''])
      return sourcesOf(Bun.YAML.parse(made.out))
    }
    const every = [...validList.entries.map((entry, index) => `entry:${index}`), 'roaster:0', 'diff:0']
    for (const [name, edit] of [
      ['a fixer result whose tree is not clean', records => { resultOf(records, 'fix-fix').repositories[0].clean = false }],
      ['a fixer result that leaves an entry unanswered', records => { resultOf(records, 'fix-fix').dispositions.pop() }],
      ['a fixer result that started from another commit', records => { resultOf(records, 'fix-fix').repositories[0].startSha = 'c'.repeat(40) }],
      ['an aborted fixer result', records => { resultOf(records, 'fix-fix').abort = { trigger: 'sense-check', reason: 'The entry extends a removed mechanism.' } }],
      ['a fixer result without a fix list check of its own, as in a run of an earlier version', records => {
        const fixer = resultOf(records, 'fix-fix'), { stdout } = fixer.specCheck
        delete fixer.specCheck
        records.unshift({ type: 'started', key: 'fix-gate', label: 'gate' },
          { type: 'result', key: 'fix-gate', result: { exitCode: 0, stdout, stderr: '', proof: JSON.parse(stdout).proof } })
      }],
      ['a check output of an earlier tool without the base list', records => {
        const { specCheck } = resultOf(records, 'fix-fix')
        const { base, ...printed } = JSON.parse(specCheck.stdout)
        specCheck.stdout = JSON.stringify(printed)
      }],
    ]) expect([name, open(editedTranscripts(edit))]).toEqual([name, every])
    // A diff result the run refused maps nothing, while the accepted fixer's rejection and question still close their entries.
    const unmapped = editedTranscripts(records => { resultOf(records, 'fix-diff').mappings[0].receipts = [] })
    expect(open(unmapped)).toEqual(['entry:1', 'entry:2', 'entry:4', 'entry:5', 'roaster:0', 'diff:0'])
  })

  test('the fix list of a review pass of an earlier version, which ran a launch check, carries the spec it printed', async () => {
    const records = await journalOf('session-c/subagents/workflows/wf_review-run/journal.jsonl')
    const made = makeList('wf_review-run')
    expect([made.exit, made.err]).toEqual([0, ''])
    expect(Bun.YAML.parse(made.out)).toEqual({ run: 'wf_review-run', spec: parentSpecPath, entries: [
      { source: 'review:correctness:0', finding: resultOf(records, 'review-correctness').findings[0] },
      { source: 'review:code-smell:0', finding: resultOf(records, 'review-code-smell').findings[0] }] })
    const checked = checkList(written(made.out), ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    invalid(checkList(written({ ...Bun.YAML.parse(made.out), entries: [{ source: 'review:quality:0', finding: {} }] })),
      'review:quality:0: the parent run returned no item to fix under this source')
  })

  test('the fix list of a review pass holds the findings of every review seat and names no spec', async () => {
    const records = await journalOf('session-c/subagents/workflows/wf_review-pass/journal.jsonl')
    const made = makeList('wf_review-pass')
    expect([made.exit, made.err]).toEqual([0, ''])
    const list = Bun.YAML.parse(made.out)
    expect(list).toEqual({ run: 'wf_review-pass', spec: null, entries: [
      { source: 'review:correctness:0', finding: resultOf(records, 'pass-correctness').findings[0] },
      { source: 'review:rules:0', finding: resultOf(records, 'pass-rules').findings[0] }] })
    expect(list).toEqual(Bun.YAML.parse(await Bun.file(reviewListPath).text()))
    const checked = checkList(reviewListPath, ['--json'])
    expect([checked.exit, checked.err]).toEqual([0, ''])
    const bytes = await Bun.file(reviewListPath).arrayBuffer()
    expect(JSON.parse(checked.out)).toEqual({ run: 'wf_review-pass', spec: null,
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      proof: listProof({ fixList: reviewListPath, spec: null, entries: list.entries }), fixList: reviewListPath })
    invalid(checkList(written({ ...list, spec: parentSpecPath })), 'fix list.spec: expected null, because the parent run checked no spec')
    invalid(makeList('wf_review-pass', ['--size', JSON.stringify(measured)]), '--size: the parent run counted no spec lines to measure a size breach against')
  })

  test('the fix list of a fix run on a list without a spec names no spec either', () => {
    const made = makeList('wf_review-fix')
    expect([made.exit, made.err]).toEqual([0, ''])
    const reviewList = Bun.YAML.parse(readFileSync(reviewListPath, 'utf8'))
    expect(Bun.YAML.parse(made.out)).toEqual({ run: 'wf_review-fix', spec: null, entries: [{ source: 'entry:1', entry: reviewList.entries[1] }] })
    const checked = checkList(written(made.out), ['--json'])
    expect([checked.exit, checked.err, JSON.parse(checked.out).spec]).toEqual([0, '', null])
  })

  test('a measured size breach joins the generated list beside the spec lines the parent run counted', () => {
    const made = makeList('wf_parent-run', ['--size', JSON.stringify(measured)])
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
    ]) invalid(makeList('wf_parent-run', ['--size', size]), message)
  })

  test.each([
    ['an unknown run', l => { l.run = 'wf_missing-run' }, 'verify:1: run wf_missing-run has no journal under the transcript directory'],
    ['a stage the parent run lacks', l => { l.run = 'wf_review-run' }, 'verify:1: the parent run returned no item to fix under this source'],
    ['an index out of range', l => { l.entries[2].source = 'verify:3' }, 'verify:3: the parent run returned no item to fix under this source'],
    ['a deleted entry', l => { l.entries.splice(2, 1) }, 'verify:1: missing, and the parent run returned it to be fixed'],
    ['an added entry', l => { l.entries.push({ source: 'verify:7', decision: parentVerify.decisions[0] }) }, 'verify:7: the parent run returned no item to fix under this source'],
    ['an edited decision', l => { l.entries[2].decision.correction = 'Return the error to the caller.' }, 'verify:1.decision: differs from the parent run\'s journal'],
    ['an edited finding', l => { l.entries[5].finding.claim = 'The handle leaks.' }, 'roaster:0.finding: differs from the parent run\'s journal'],
    ['a reordered list', l => { l.entries.reverse() }, 'roaster:0: out of order: the parent run returned impl:0 in this place'],
    ['a decision under a roaster source', l => { l.entries[5] = { source: 'roaster:0', decision: l.entries[5].finding } }, 'roaster:0.decision: unknown key'],
  ])('%s fails with a violation naming the entry', (name, edit, message) => {
    const result = changedList(edit)
    invalid(result, message)
    expect(result.err).not.toContain('proof')
  })

  test('a run-wide failure names every entry', () => {
    const result = changedList(l => { l.run = 'wf_missing-run' })
    for (const source of sourcesOf(validList)) invalid(result, `: ${source}: run wf_missing-run`)
    expect(result.err.trim().split('\n')).toHaveLength(validList.entries.length)
  })

  test('a retried stage resolves against its last result only', () => {
    const first = resultOf(journal, 'parent-verify-1').decisions[0]
    invalid(changedList(l => { l.entries[1].decision = first }), 'verify:0.decision: differs from the parent run\'s journal')
    expect(checkList(validPath).exit).toBe(0)
  })

  test('the spec is the one the parent run checked, unchanged', () => {
    invalid(changedList(l => { l.spec = 'tests/fixtures/spec/valid.yaml' }), 'fix list.spec: expected the spec the parent run checked, tests/fixtures/fix-list/parent.yaml')
    invalid(changedList(l => { l.spec = null }), 'fix list.spec: expected the spec the parent run checked, tests/fixtures/fix-list/parent.yaml')
    const copy = join(scratch, 'parent-copy')
    mkdirSync(join(copy, 'tests/fixtures/fix-list'), { recursive: true })
    writeFileSync(join(copy, parentSpecPath), 'unit: changed\n')
    const result = checkList(validPath, [], copy)
    expect([result.exit, result.err.includes('fix list.spec: changed since the parent run checked it')]).toEqual([1, true])
  })

  test.each([
    ['an unknown list key', l => { l.extra = true }, 'fix list.extra: unknown key'],
    ['a findings key', l => { l.findings = ['correctness:1'] }, 'fix list.findings: unknown key'],
    ['the keys of a spec', l => { l.unit = 'example' }, 'fix list.unit: unknown key'],
    ['a missing run', l => { delete l.run }, 'fix list.run: missing field'],
    ['a missing spec', l => { delete l.spec }, 'fix list.spec: missing field'],
    ['missing entries', l => { delete l.entries }, 'fix list.entries: missing field'],
    ['a run id with a path in it', l => { l.run = '../wf_parent-run' }, 'fix list.run: expected a run id'],
    ['empty entries', l => { l.entries = [] }, 'entries: expected a non-empty list'],
    ['an entry with a correction', l => { l.entries[5].correction = 'Close the handle.' }, 'roaster:0.correction: unknown key'],
    ['an entry with pointers', l => { l.entries[5].attach = [] }, 'roaster:0.attach: unknown key'],
    ['a reviewer source', l => { l.entries[5].source = 'correctness:1' },
      'entry 6.source: expected impl:<index>, verify:<index>, issue:<index>, roaster:<index>, diff:<index>, review:<seat>:<index>, entry:<index>, size: "correctness:1"'],
    ['a duplicate source', l => { l.entries.push(structuredClone(l.entries[1])) }, 'verify:0: duplicate source verify:0'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changedList(edit), message))

  test('a spec is no fix list, and a fix list is no spec', () => {
    invalid(checkList(join(fixtures, 'valid.yaml')), 'fix list.unit: unknown key')
    invalid(run(validPath), 'spec.run: unknown key')
  })

  test('the fix list of a main run leaves out an approved correction its fixer fixed or disproved', () => {
    const run = 'wf_fixed-run', sessions = join(scratch, 'fixed-transcripts')
    const at = join(sessions, 'session/subagents/workflows', run)
    mkdirSync(at, { recursive: true })
    const fixer = dispositions => JSON.stringify({ type: 'started', label: 'fix', key: 'parent-fix' }) + '\n' +
      JSON.stringify({ type: 'result', key: 'parent-fix', result: { dispositions } }) + '\n'
    const sources = dispositions => {
      writeFileSync(join(at, 'journal.jsonl'), journal.map(record => JSON.stringify(record)).join('\n') + '\n' + fixer(dispositions))
      const result = Bun.spawnSync([process.execPath, tool, '--make-fix-list', run, '--transcripts', sessions], { cwd: root })
      expect([result.exitCode, result.stderr.toString()]).toEqual([0, ''])
      return Bun.YAML.parse(result.stdout.toString()).entries.map(entry => entry.source)
    }
    const all = validEntries.map(entry => entry.source)
    for (const disposition of ['fixed', 'rejected']) {
      expect(sources([{ key: 'fix:0', disposition }])).toEqual(all.filter(source => source !== 'verify:0'))
    }
    expect(sources([{ key: 'fix:0', disposition: 'blocked' }])).toEqual(all)
    expect(sources([])).toEqual(all)
  })

  test('an unreadable fix list or a malformed journal line fails', () => {
    invalid(checkList(join(scratch, 'absent-list.yaml')), 'fix list: unreadable or malformed YAML')
    const sessions = join(scratch, 'broken-transcripts')
    mkdirSync(join(sessions, 'session/subagents/workflows/wf_broken'), { recursive: true })
    writeFileSync(join(sessions, 'session/subagents/workflows/wf_broken/journal.jsonl'), '{"type":"launched"}\nnot json\n')
    const path = written({ ...validList, entries: [validList.entries[5]], run: 'wf_broken' })
    const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', sessions], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('roaster:0: journal line 2 is not JSON')
  })

  test.each([
    ['a changed decision', v => { v.entries[1].decision.correction = 'Log the error and continue.' }],
    ['a correction beside the finding', v => { v.entries[5].correction = 'Close the file handle.' }],
    ['another spec', v => { v.spec = 'tests/fixtures/spec/valid.yaml' }],
    ['a missing entry', v => { v.entries.pop() }],
    ['reordered entries', v => { v.entries.reverse() }],
    ['an entry the list does not hold', v => { v.entries.push({ ...v.entries[1], source: 'verify:7' }) }],
    ['another fix list', v => { v.fixList = join(scratch, 'other-list.yaml') }],
    ['a base list', v => { v.base = [{ path: '.', sha: 'a'.repeat(40) }] }],
    ['another tree', v => { v.tree = scratch }],
  ])('launch values with %s give another proof than the list', (name, edit) => {
    const values = { fixList: validPath, transcripts, spec: parentSpecPath, entries: structuredClone(validEntries), base: null, partialBase: false, tree: here }
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

  test('a spec argument beside --fix-list, --partial-base without --base, and a spec option beside --make-fix-list are usage errors, and --size belongs to --make-fix-list alone', () => {
    for (const options of [[join(fixtures, 'valid.yaml')], ['--partial-base'], ['--size', JSON.stringify(measured)]]) {
      invalid(checkList(validPath, options), 'Usage')
    }
    invalid(run(join(fixtures, 'valid.yaml'), ['--size', JSON.stringify(measured)]), 'Usage')
    const bare = Bun.spawnSync([process.execPath, tool, '--fix-list', validPath], { cwd: root })
    expect([bare.exitCode, bare.stderr.toString().includes('Usage')]).toEqual([1, true])
    for (const options of [['--json'], ['--fix-list', validPath], ['--entries'], [join(fixtures, 'valid.yaml')], ['--proof', listProof()]]) {
      const made = makeList('wf_parent-run', options)
      expect([options.join(' '), made.exit, made.err.includes('Usage')]).toEqual([options.join(' '), 1, true])
    }
  })
})
