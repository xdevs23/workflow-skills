import type { EngineInterface } from 'claude-code'

import { readEntryHeading } from './goals/todoEntry'
import type { EntryNumber } from './todoEntry'

const ENTRY_HEADING_MARKS = /^#{3,} /u

export async function hasEntryInTodoFile(
  $: EngineInterface,
  project: string,
  entry: EntryNumber,
): Promise<boolean> {
  const path = `${project}/TODO.md`

  return (
    (await $.fs.exists(path)) &&
    (await $.fs.read(path))
      .split('\n')
      .filter(line => ENTRY_HEADING_MARKS.test(line))
      .some(line => readEntryHeading(line.replace(ENTRY_HEADING_MARKS, ''))?.number === entry)
  )
}
