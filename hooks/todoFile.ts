import type { EngineInterface } from 'claude-code'

import { readEntryHeading } from './goals/todoEntry'
import type { TodoEntry } from './goals/todoEntry'
import { EntryState } from './todoEntry'
import type { EntryNumber } from './todoEntry'

const ENTRY_HEADING_MARKS = /^#{3,} /u

export async function readEntriesInTodoFile(
  $: EngineInterface,
  project: string,
): Promise<TodoEntry[]> {
  const path = `${project}/TODO.md`
  if (!(await $.fs.exists(path))) {
    return []
  }

  return (await $.fs.read(path))
    .split('\n')
    .filter(line => ENTRY_HEADING_MARKS.test(line))
    .map(line => removeEntryState(line.replace(ENTRY_HEADING_MARKS, '')))
    .flatMap(heading => readEntryHeading(heading) ?? [])
}

export async function hasEntryInTodoFile(
  $: EngineInterface,
  project: string,
  entry: EntryNumber,
): Promise<boolean> {
  return (await readEntriesInTodoFile($, project)).some(todo => todo.number === entry)
}

function removeEntryState(heading: string): string {
  const marker = Object.values(EntryState)
    .map(state => ` - ${state}`)
    .find(each => heading.endsWith(each))

  return marker === undefined ? heading : heading.slice(0, -marker.length)
}
