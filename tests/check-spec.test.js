import { afterAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
      proof: expect.stringMatching(/^[0-9a-f]{32}$/),
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

  test('the valid example quotes the user and the assistant, and the assistant a text block, a dialog call and a Write call', () => {
    expect(new Set(valid.entries.map(entry => entry.author))).toEqual(new Set(['user', 'assistant']))
    for (const uuid of ['offer', 'dialog-call', 'plan-write']) expect(valid.entries.some(entry => entry.uuid === uuid && entry.author === 'assistant')).toBe(true)
  })

  test('a passing run prints a fresh 32-character hexadecimal proof in both output forms, a failing run none', () => {
    const proofs = [fixture('valid', ['--json']), fixture('valid', ['--json'])].map(result => JSON.parse(result.out).proof)
    expect(proofs[0]).toMatch(/^[0-9a-f]{32}$/)
    expect(proofs[1]).toMatch(/^[0-9a-f]{32}$/)
    expect(proofs[0]).not.toBe(proofs[1])
    expect(fixture('valid').out).toMatch(/ proof=[0-9a-f]{32} /)
    const failing = fixture('several', ['--json'])
    expect(failing.exit).not.toBe(0)
    expect(failing.out).toBe('')
    expect(failing.err).not.toContain('proof')
    expect(failing.err).not.toContain('spec=')
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
    const prefix = 'tests/fixtures/spec-provenance/several.yaml: '
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

  test('an entry that repeats an earlier one is refused, also when only its whitespace differs', () => {
    invalid(changed(s => { s.entries.push({ ...s.entries[8] }) }), 'entry 10: repeats entry 9')
    invalid(changed(s => { s.entries.splice(3, 0, { ...s.entries[2], text: 'Stream  the\nrows.' }) }), 'entry 4: repeats entry 3')
  })

  test('a second name of one session file shares its line order', () => {
    const link = join(scratch, 'linked-session.jsonl')
    symlinkSync(join(fixtures, 'session.jsonl'), link)
    const answer = { file: link, line: 9, uuid: 'answer', author: 'user', text: 'Stream the rows.' }
    invalid(changed(s => { s.entries.push(answer) }), `entry 10.line: goes back to line 9 of ${link} after line 46`)
    const approval = changed(s => { s.entries.push({ ...answer, line: 46, uuid: 'plan-approval', text: 'build it.' }) })
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
    const inTree = (list, ...options) => {
      const result = Bun.spawnSync([process.execPath, tool, join(fixtures, 'valid.yaml'), '--transcripts', fixtures,
        '--base', JSON.stringify(list), ...options], { cwd: tree })
      return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
    }
    const complete = [{ path: 'api', sha: api }, { path: 'web', sha: web }]
    expect(inTree(complete)).toMatchObject({ exit: 0, err: '' })
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
    invalid(fixture('valid', ['--expect', '{}']), 'Usage')
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
const validList = Bun.YAML.parse(await Bun.file(validPath).text())
const checkList = (path, options = []) => {
  const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', transcripts, ...options], { cwd: root })
  return { exit: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() }
}
const changedList = (edit, options = []) => {
  const list = structuredClone(validList)
  edit(list)
  return checkList(written(list), options)
}
// The findings of the parent run's journal that the valid list names, as the journal holds them.
const journalFindings = [
  { source: 'correctness:1', finding: { file: 'src/example.js', claim: 'The specified error is\n  swallowed by the catch block.',
    severity: 'must-fix', lane: 'fixer-actionable', receipts: [{ file: 'src/example.js', line: 12, quote: 'catch (error) {}' }] } },
  { source: 'roaster:0', finding: { file: 'src/reader.js', claim: 'The file handle stays open when the read fails.',
    severity: 'must-fix', lane: 'fixer-actionable', receipts: [{ file: 'src/reader.js', line: 20, quote: 'open(path)' }] } },
]

describe('fix list validation', () => {
  test('a valid fix list passes with a fresh proof and each finding as the journal holds it, in both output forms', async () => {
    const [first, second] = [checkList(validPath, ['--json']), checkList(validPath, ['--json'])]
    expect([first.exit, first.err]).toEqual([0, ''])
    const bytes = await Bun.file(validPath).arrayBuffer()
    expect(JSON.parse(first.out)).toEqual({
      findings: journalFindings, run: 'wf_parent-run',
      sha256: createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),
      proof: expect.stringMatching(/^[0-9a-f]{32}$/), fixList: validPath,
    })
    expect(JSON.parse(first.out).proof).not.toBe(JSON.parse(second.out).proof)
    const plain = checkList(validPath)
    expect([plain.exit, plain.err]).toEqual([0, ''])
    expect(plain.out).toMatch(/^findings=2 run=wf_parent-run sha256=[0-9a-f]{64} proof=[0-9a-f]{32} fixList=/)
  })

  test.each([
    ['an unknown run', l => { l.run = 'wf_missing-run' }, 'correctness:1: run wf_missing-run has no journal under the transcript directory'],
    ['an unknown reader', l => { l.findings[0] = 'naming:0' }, 'naming:0: the parent run has no stage labelled review:naming'],
    ['an index out of range', l => { l.findings[0] = 'correctness:2' }, 'correctness:2: index 2 is outside the 2 findings of review:correctness'],
    ['a stage without a findings list', l => { l.findings[0] = 'quality:0' }, 'quality:0: the last review:quality stage returned no findings list'],
  ])('%s fails with a violation naming the source', (name, edit, message) => {
    const result = changedList(edit)
    invalid(result, message)
    expect(result.err).not.toContain('proof')
  })

  test('a run-wide failure names every source', () => {
    const result = changedList(l => { l.run = 'wf_missing-run' })
    for (const source of ['correctness:1', 'roaster:0']) invalid(result, `: ${source}: run wf_missing-run`)
    expect(result.err.trim().split('\n')).toHaveLength(2)
  })

  test('a journal element that is no mapping fails, whether it is null or a list', () => {
    const sessions = join(scratch, 'element-transcripts')
    mkdirSync(join(sessions, 'session/subagents/workflows/wf_elements'), { recursive: true })
    writeFileSync(join(sessions, 'session/subagents/workflows/wf_elements/journal.jsonl'), [
      { type: 'started', key: 'elements', label: 'review:correctness' },
      { type: 'result', key: 'elements', result: { findings: [null, ['The specified error is swallowed.']] } },
    ].map(record => JSON.stringify(record)).join('\n') + '\n')
    const path = written({ run: 'wf_elements', findings: ['correctness:0', 'correctness:1'] })
    const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', sessions, '--json'], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout.toString()).toBe('')
    for (const [source, index] of [['correctness:0', 0], ['correctness:1', 1]]) {
      expect(result.stderr.toString()).toContain(`${source}: the element at index ${index} of review:correctness is not a mapping`)
    }
  })

  test('a retried stage resolves against its last result only', () => {
    const result = changedList(l => { l.findings = ['correctness:0'] }, ['--json'])
    expect([result.exit, result.err]).toEqual([0, ''])
    expect(JSON.parse(result.out).findings[0].finding.claim).toBe('The input is not trimmed.')
  })

  test.each([
    ['an unknown list key', l => { l.extra = true }, 'fix list.extra: unknown key'],
    ['a parentSpec key', l => { l.parentSpec = join(fixLists, 'parent.yaml') }, 'fix list.parentSpec: unknown key'],
    ['an entries key', l => { l.entries = [] }, 'fix list.entries: unknown key'],
    ['a missing run', l => { delete l.run }, 'fix list.run: missing field'],
    ['a missing findings list', l => { delete l.findings }, 'fix list.findings: missing field'],
    ['a run id with a path in it', l => { l.run = '../wf_parent-run' }, 'fix list.run: expected a run id'],
    ['empty findings', l => { l.findings = [] }, 'findings: expected a non-empty list'],
    ['a finding with a correction', l => { l.findings[1] = { source: 'roaster:0', correction: 'Close the handle.' } }, 'finding 2: expected a source ID <seat>:<index>'],
    ['a malformed source', l => { l.findings[0] = 'correctness-1' }, 'finding 1: expected a source ID <seat>:<index>: "correctness-1"'],
    ['a duplicate source', l => { l.findings[1] = 'correctness:1' }, 'correctness:1: duplicate source correctness:1'],
  ])('%s fails shape validation', (name, edit, message) => invalid(changedList(edit), message))

  test('an unreadable fix list or a malformed journal line fails', () => {
    invalid(checkList(join(scratch, 'absent-list.yaml')), 'fix list: unreadable or malformed YAML')
    const sessions = join(scratch, 'broken-transcripts')
    mkdirSync(join(sessions, 'session/subagents/workflows/wf_broken'), { recursive: true })
    writeFileSync(join(sessions, 'session/subagents/workflows/wf_broken/journal.jsonl'), '{"type":"launched"}\nnot json\n')
    const path = written({ ...validList, run: 'wf_broken' })
    const result = Bun.spawnSync([process.execPath, tool, '--fix-list', path, '--transcripts', sessions], { cwd: root })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr.toString()).toContain('correctness:1: journal line 2 is not JSON')
  })

  describe('launch values', () => {
    const launch = (edit = () => {}) => {
      const values = { findings: structuredClone(journalFindings) }
      edit(values)
      return ['--expect', JSON.stringify(values)]
    }

    test('launch values equal to the findings the journal holds pass with a proof', () => {
      const result = checkList(validPath, ['--json', ...launch()])
      expect([result.exit, result.err]).toEqual([0, ''])
      expect(JSON.parse(result.out).proof).toMatch(/^[0-9a-f]{32}$/)
    })

    test.each([
      ['a changed claim', v => { v.findings[0].finding.claim = 'Log the error and continue.' }, 'correctness:1: differs from the launch values'],
      ['a correction beside the finding', v => { v.findings[1].correction = 'Close the file handle.' }, 'roaster:0: differs from the launch values'],
      ['a missing finding', v => { v.findings.pop() }, 'roaster:0: missing from the launch values'],
      ['a finding the list does not name', v => { v.findings.push({ ...v.findings[0], source: 'correctness:0' }) }, 'launch values.findings: correctness:0 is not a finding of the fix list'],
    ])('%s fails with a violation naming the source', (name, edit, message) => {
      const result = checkList(validPath, launch(edit))
      invalid(result, message)
      expect(result.err).not.toContain('proof')
    })

    test('malformed launch values fail', () => {
      invalid(checkList(validPath, ['--expect', '{"findings": [']), 'launch values: malformed JSON')
      invalid(checkList(validPath, ['--expect', '[]']), 'launch values: expected a mapping')
      invalid(checkList(validPath, ['--expect', JSON.stringify({ findings: journalFindings, parentSpec: '/a/spec.yaml' })]), 'launch values.parentSpec: unknown key')
    })
  })

  test('a spec argument or a spec option beside --fix-list is a usage error', () => {
    for (const options of [[join(fixtures, 'valid.yaml')], ['--base', 'HEAD']]) {
      invalid(checkList(validPath, options), 'Usage')
    }
    const bare = Bun.spawnSync([process.execPath, tool, '--fix-list', validPath], { cwd: root })
    expect([bare.exitCode, bare.stderr.toString().includes('Usage')]).toEqual([1, true])
  })
})
