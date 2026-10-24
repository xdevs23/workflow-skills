import type { EngineInterface, Register } from 'claude-code'

import { failureOf } from './failure.ts'
import { isRecord } from './json.ts'
import { skillName, skillRules } from './rules.ts'
import { entriesOf, isTodoFile, todoOf, TodoState } from './todo-file.ts'
import type { TodoEntry } from './todo-file.ts'

const TODO_SKILL = 'todo-md'

// The work being built and the work ready to be built at any time.
const OPEN_STATES: readonly TodoState[] = [TodoState.InProgress, TodoState.Queued, TodoState.Todo]

export const ENTRY_LINE_LIMIT = 20

const isOpen = (entry: TodoEntry): boolean =>
  entry.state !== null && OPEN_STATES.includes(entry.state)

export const longEntries = (todo: string): TodoEntry[] =>
  entriesOf(todo).filter(entry => entry.lines > ENTRY_LINE_LIMIT)

async function startContext($: EngineInterface): Promise<string> {
  const rules = await skillRules($, TODO_SKILL)
  const todo = await todoOf($)
  const open = todo === null ? [] : entriesOf(todo).filter(isOpen)

  return [
    ...rules.map(({ source, text }) => `The rules of ${source}:\n${text.trimEnd()}`),
    ...(open.length === 0
      ? []
      : [`Open work in TODO.md:\n${open.map(entry => entry.heading).join('\n')}`]),
  ].join('\n\n')
}

// One line, since the transcript draws a log line without line breaks.
function longEntriesNote($: EngineInterface, entries: readonly TodoEntry[]): string {
  return [
    ...entries.map(
      entry =>
        `TODO.md: entry ${entry.id} has ${entry.lines} lines, more than ${ENTRY_LINE_LIMIT}.`,
    ),
    `Shorten each of these entries by the rules of ${skillName($, TODO_SKILL)}.`,
  ].join(' ')
}

const changedFile = (input: unknown): string | null =>
  isRecord(input) && typeof input.file_path === 'string' ? input.file_path : null

export const register: Register = on => {
  // Every source starts a context without the rules and the open work.
  on(
    'classic.SessionStart',
    { source: ['startup', 'resume', 'clear', 'compact', 'fork'] },
    async ($, e, next) => {
      const below = await next(e)

      return {
        ...below,
        additionalContext: [...(below.additionalContext ?? []), await startContext($)],
      }
    },
  ).catch(($, e, next) => {
    $.ui.log(failureOf('The TODO.md reminder', next.error))
    return next(e)
  })

  on('classic.PostToolUse', { tool_name: ['Edit', 'Write'] }, async ($, e, next) => {
    const below = await next(e)
    const path = changedFile(e.tool_input)
    if (path === null || !(await isTodoFile($, path))) return below
    const todo = await todoOf($)
    const long = todo === null ? [] : longEntries(todo)
    if (long.length === 0) return below
    const note = longEntriesNote($, long)
    $.ui.log(note)

    return { ...below, additionalContext: [...(below.additionalContext ?? []), note] }
  }).catch(($, e, next) => {
    $.ui.log(failureOf('The TODO.md reminder', next.error))
    return next(e)
  })
}
