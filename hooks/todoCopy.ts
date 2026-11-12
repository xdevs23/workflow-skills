import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { TodoCopy, TodoFile } from '../types'
import { isErrorWithText } from './errorMessage'
import { ofSession, updateOfSession } from './sessionBoundState'

const todoCopy = atom({ plugin: 'workflow-skills', key: 'todoCopy' } as const, null)

/** The engine rejects a read or a stat of a missing file with this errno. */
const MISSING_FILE = 'ENOENT'

/**
 * The text of TODO.md before and after a change. The text before is empty when the previous copy
 * had no file.
 */
export type TodoChange = { before: string; after: string }

/** The copy of TODO.md of a session, or null for none, and the file stored over it. */
type TodoReplacement = { replaced: TodoCopy | null; file: TodoFile | null }

/** Stores TODO.md of the project as the copy of the session `sessionId`, unless it is unchanged. */
export async function copyTodo($: EngineInterface, sessionId: string): Promise<void> {
  await replaceTodoCopy($, sessionId)
}

/**
 * Stores TODO.md of the project as the copy of the session `sessionId`, and returns how the file
 * changed since the previous copy. Returns nothing while the file is unchanged or missing, and for
 * a session without a previous copy.
 */
export async function takeTodoChange(
  $: EngineInterface,
  sessionId: string,
): Promise<TodoChange | undefined> {
  const replacement = await replaceTodoCopy($, sessionId)
  if (replacement === undefined || replacement.replaced === null || replacement.file === null) {
    return undefined
  }

  return { before: replacement.replaced.file?.text ?? '', after: replacement.file.text }
}

/**
 * Stores TODO.md of the project over the copy of the session `sessionId` when its size or
 * modification time changed. Returns nothing when the file is unchanged, and when a parallel tool
 * call stored another file over the copy first, so only one tool call gets a change.
 */
async function replaceTodoCopy(
  $: EngineInterface,
  sessionId: string,
): Promise<TodoReplacement | undefined> {
  const copy = ofSession(await read($, todoCopy), sessionId)
  const file = await readTodoFile($, copy?.file ?? null)
  if (copy !== null && isSameFile(file, copy.file)) {
    return undefined
  }

  return (await storeOverCopy($, sessionId, copy, file)) ? { replaced: copy, file } : undefined
}

/**
 * Stores `file` as the copy of TODO.md of the session `sessionId` while that copy is still
 * `compared`, and tells whether it did. A tool call that finishes after a parallel one may have
 * read an older file.
 */
async function storeOverCopy(
  $: EngineInterface,
  sessionId: string,
  compared: TodoCopy | null,
  file: TodoFile | null,
): Promise<boolean> {
  let isStored = false
  await updateOfSession<TodoCopy>(
    $,
    sessionId,
    own => {
      isStored = isSameCopy(own, compared)

      return isStored ? { sessionId, file } : own
    },
    changeInState => update($, todoCopy, changeInState),
  )

  return isStored
}

/** Whether `a` and `b` contain the same file, or are both absent. */
function isSameCopy(a: TodoCopy | null, b: TodoCopy | null): boolean {
  return a === null || b === null ? a === b : isSameFile(a.file, b.file)
}

/** The size and modification time of TODO.md, which tell whether it changed. */
type TodoStat = Pick<TodoFile, 'size' | 'mtimeMs'>

/** Whether `a` and `b` have the same size and modification time, or are both missing. */
function isSameFile(a: TodoStat | null, b: TodoStat | null): boolean {
  return a?.size === b?.size && a?.mtimeMs === b?.mtimeMs
}

/**
 * TODO.md of the project read from disk, or `kept` while its size and modification time still
 * equal those of `kept`. Null while the project has no TODO.md.
 */
async function readTodoFile($: EngineInterface, kept: TodoFile | null): Promise<TodoFile | null> {
  const path = `${await $.session.root()}/TODO.md`
  try {
    const stat = await $.fs.stat(path)
    if (kept !== null && isSameFile(kept, stat)) {
      return kept
    }

    return { size: stat.size, mtimeMs: stat.mtimeMs, text: await $.fs.read(path) }
  } catch (error) {
    if (isErrorWithText(error, MISSING_FILE)) {
      return null
    }
    throw error
  }
}
