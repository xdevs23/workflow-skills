import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { test } from './testDeclaration'
import {
  PROJECT_ROOT,
  SECOND_SESSION,
  SUBAGENT,
  denyMissingFile,
  notesOfToolResult,
  readFile,
  startSession,
  startTurn,
  switchSession,
} from './testSupport'
import type { Session } from './testSupport'

const TODO_PATH = `${PROJECT_ROOT}/TODO.md`

/** A read of TODO.md that waits until `released` resolves. `began` is called when it begins. */
type HeldRead = { began: () => void; released: Promise<void> }

/**
 * The faked TODO.md of the project, with its text, undefined while the file is missing. It also
 * records how often the plugin read the file, the lines that the next shell command appends to it,
 * the rejection of every read while the file cannot be read, and the next read to hold back.
 */
type TodoFake = {
  text: string | undefined
  mtimeMs: number
  reads: number
  linesOfShell: readonly string[]
  readFailure: string | undefined
  heldRead: HeldRead | undefined
}

/**
 * Fakes the stat and the read of TODO.md with `todo` as the file system returns them, and fakes a
 * shell command that appends the lines of `todo` to it.
 */
function fakeTodo(on: On, todo: TodoFake): void {
  // Registered before the session starts, so it runs before the file system faked by the session.
  on('fs.stat', { path: TODO_PATH }, () =>
    todo.text === undefined
      ? denyMissingFile(TODO_PATH)
      : { value: { kind: 'file', size: todo.text.length, mtimeMs: todo.mtimeMs, isLink: false } },
  )
  on('fs.read', { path: TODO_PATH }, async () => {
    const { text, readFailure, heldRead } = todo
    if (readFailure !== undefined) {
      return { deny: readFailure }
    }
    if (text === undefined) {
      return denyMissingFile(TODO_PATH)
    }
    todo.reads += 1
    todo.heldRead = undefined
    heldRead?.began()
    await heldRead?.released

    return { value: text }
  })
  on('tool.call', { tool: 'Bash' }, () => {
    writeTodo(todo, [todo.text ?? '', ...todo.linesOfShell].join('\n'))

    return { result: '' }
  })
}

/** Writes `text` to TODO.md, or deletes the file for undefined. */
function writeTodo(todo: TodoFake, text: string | undefined): void {
  todo.text = text
  todo.mtimeMs += 1
}

/** Holds back the next read of TODO.md. Returns when the read began, and how to release it. */
function holdNextRead(todo: TodoFake): { began: Promise<void>; release: () => void } {
  let release = () => {}
  const released = new Promise<void>(resolve => {
    release = resolve
  })
  const began = new Promise<void>(resolve => {
    todo.heldRead = { began: resolve, released }
  })

  return { began, release }
}

/**
 * Appends `lines` to TODO.md through a shell command, and returns the notes on the result returned
 * by the command.
 */
async function appendByShell(
  $: Engine,
  todo: TodoFake,
  lines: readonly string[],
): Promise<readonly string[]> {
  todo.linesOfShell = lines

  return (await $.tool.call({ tool: 'Bash', command: 'cat >> TODO.md' })).context ?? []
}

/** Starts a session with `text` as TODO.md, and the first turn of its main conversation. */
async function startWithTodo(
  $: Engine,
  on: On,
  text: string | undefined,
): Promise<{ todo: TodoFake; session: Session }> {
  const todo: TodoFake = {
    text,
    mtimeMs: 1,
    reads: 0,
    linesOfShell: [],
    readFailure: undefined,
    heldRead: undefined,
  }
  fakeTodo(on, todo)
  const session = await startSession($, on)
  await startTurn($)

  return { todo, session }
}

describe('the note on a clause after ", and" in a sentence added to TODO.md', () => {
  test('quotes the sentence with the clause from a line appended by a shell command', async (
    $,
    on,
  ) => {
    const { todo } = await startWithTodo($, on, '# TODO')

    const notes = await appendByShell($, todo, [
      'Ship the export. Add the dark theme, and send a mail after each export.',
    ])

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('> Add the dark theme, and send a mail after each export.')
    expect(notes[0]).not.toContain('Ship the export.')
  })

  test('leaves out a clause after ", and" in quoted text, in code and in a word', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO')

    const notes = await appendByShell($, todo, [
      'The user said "add it, and ship it".',
      'Run `make, and test` first.',
      '```',
      'build, and deploy',
      '```',
      'Keep it, android first.',
    ])

    expect(notes).toEqual([])
  })

  // A sentence split before the quotation was masked left a lone quote mark in each half.
  test('leaves out a quotation with a full stop beside a sentence with the clause', async (
    $,
    on,
  ) => {
    const { todo } = await startWithTodo($, on, '# TODO')

    const notes = await appendByShell($, todo, ['Do it, and test. He said "stop. Add it, and go."'])

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('> Do it, and test.')
    expect(notes[0]).not.toContain('Add it')
  })

  test('leaves out a line that TODO.md held at the start of the turn', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO')
    await notesOfToolResult($)
    writeTodo(todo, '# TODO\nAdd the dark theme, and send a mail.')
    await startTurn($)

    expect(await notesOfToolResult($)).toEqual([])
  })

  // A changed line used to count as new as a whole, with every sentence on it.
  test('quotes only the sentence added to a line that TODO.md held', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO\nShip it, and test it.')

    writeTodo(todo, '# TODO\nShip it, and test it. Add the theme, and a mail.')
    const notes = await notesOfToolResult($)

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('> Add the theme, and a mail.')
    expect(notes[0]).not.toContain('Ship it')
  })

  test('notes each added sentence once', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO')

    expect(await appendByShell($, todo, ['Add the theme, and a mail.'])).toHaveLength(1)
    expect(await notesOfToolResult($)).toEqual([])
  })

  // The call that read the older file used to store it over the newer copy, so the next call saw
  // the newer file as a change again.
  test('notes a sentence once when parallel tool calls finish in reverse order', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO')
    writeTodo(todo, '# TODO\nAdd the theme, and a mail.')
    const held = holdNextRead(todo)
    const first = notesOfToolResult($)
    await held.began

    writeTodo(todo, '# TODO\nAdd the theme, and a mail.\nShip it, and test it.')
    const second = await notesOfToolResult($)
    held.release()

    expect([...second, ...(await first)]).toHaveLength(1)
    expect(await notesOfToolResult($)).toEqual([])
  })

  test('leaves a change by a subagent to the next tool call of the main conversation', async (
    $,
    on,
  ) => {
    const { todo } = await startWithTodo($, on, '# TODO')
    writeTodo(todo, '# TODO\nAdd the theme, and a mail.')

    expect(await notesOfToolResult($, SUBAGENT)).toEqual([])
    expect(await notesOfToolResult($)).toHaveLength(1)
  })

  test('reads TODO.md again only after its size or modification time changed', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO')
    await notesOfToolResult($)
    expect(todo.reads).toBe(1)

    todo.mtimeMs += 1
    await notesOfToolResult($)
    expect(todo.reads).toBe(2)
  })

  test('quotes the clause from a TODO.md created during the turn', async ($, on) => {
    const { todo } = await startWithTodo($, on, undefined)
    expect(await notesOfToolResult($)).toEqual([])

    const notes = await appendByShell($, todo, ['Add the theme, and a mail.'])

    expect(notes).toHaveLength(1)
    expect(notes[0]).toContain('> Add the theme, and a mail.')
  })

  test('quotes the clause from a TODO.md deleted and created again', async ($, on) => {
    const { todo } = await startWithTodo($, on, '# TODO\nShip it, and test it.')
    writeTodo(todo, undefined)
    expect(await notesOfToolResult($)).toEqual([])

    writeTodo(todo, '# TODO\nShip it, and test it.')

    expect(await notesOfToolResult($)).toHaveLength(1)
  })

  // A rejection other than a missing file used to throw out of the hook on every tool call.
  test('returns the tool result while TODO.md cannot be read, and notes once it can', async (
    $,
    on,
  ) => {
    const { todo, session } = await startWithTodo($, on, '# TODO')
    todo.readFailure = `EACCES: permission denied, open '${TODO_PATH}'`
    writeTodo(todo, '# TODO\nAdd the theme, and a mail.')

    const unread = await readFile($)

    expect(unread.result).toBe('the file')
    expect(unread.context ?? []).toEqual([])
    expect(session.logs.some(line => line.includes('EACCES'))).toBe(true)
    todo.readFailure = undefined
    expect(await notesOfToolResult($)).toHaveLength(1)
  })

  test('notes nothing on the first tool call after a switch to another session', async (
    $,
    on,
  ) => {
    const { todo, session } = await startWithTodo($, on, '# TODO')
    await switchSession($, session, { id: SECOND_SESSION, reason: 'resume' })
    writeTodo(todo, '# TODO\nAdd the theme, and a mail.')

    expect(await notesOfToolResult($)).toEqual([])
  })
})
