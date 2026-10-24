import type { EngineInterface } from 'claude-code'

import { markdownLines } from './markdown-lines.ts'

// The states of an entry, as section 4 of the skill workflow-skills:todo-md defines them.
export const TodoState = {
  Recorded: 'RECORDED',
  NeedsDecision: 'NEEDS DECISION',
  Ready: 'READY',
  Todo: 'TODO',
  Queued: 'QUEUED',
  InProgress: 'IN PROGRESS',
  Built: 'BUILT',
  Pushed: 'PUSHED',
  Shipped: 'SHIPPED',
  Verified: 'VERIFIED',
  Parked: 'PARKED',
} as const
export type TodoState = (typeof TodoState)[keyof typeof TodoState]
const STATES: readonly TodoState[] = Object.values(TodoState)

export type TodoEntry = {
  heading: string
  id: string
  // Null for a heading without a state marker or with a marker the skill does not define.
  state: TodoState | null
  // The lines below the heading up to the next heading of a section or an entry, blank lines left
  // uncounted.
  lines: number
}

// The title of an entry heading in the shape defined by the skill workflow-skills:todo-md,
// `### #<id> - <title> - <STATE>`, with `####` and a dotted id for a sub-unit.
const ENTRY_TITLE = /^(#\d+(?:\.\d+)*) - /
const ENTRY_DEPTHS: readonly number[] = [3, 4]
// A heading this deep or less ends the entry above it.
const ENDING_DEPTH = 4
const SEPARATOR = ' - '

let root: Promise<string> | undefined
// The project root as the session first reported it, so every part reads the same TODO.md.
function projectRoot($: EngineInterface): Promise<string> {
  root ??= $.session.root()
  return root
}

async function todoPath($: EngineInterface): Promise<string> {
  return `${await projectRoot($)}/TODO.md`
}

export async function isTodoFile($: EngineInterface, path: string): Promise<boolean> {
  return path === (await todoPath($))
}

// The text of TODO.md in the project root, or null without one.
export async function todoOf($: EngineInterface): Promise<string | null> {
  const path = await todoPath($)

  return (await $.fs.exists(path)) ? $.fs.read(path) : null
}

const stateOf = (title: string): TodoState | null => {
  const marker = title.slice(title.lastIndexOf(SEPARATOR) + SEPARATOR.length)

  return STATES.find(state => state === marker) ?? null
}

// The entries of TODO.md in the order of the file.
export function entriesOf(todo: string): TodoEntry[] {
  const entries: TodoEntry[] = []
  let current: TodoEntry | null = null
  for (const { text, heading } of markdownLines(todo)) {
    const id =
      heading !== null && ENTRY_DEPTHS.includes(heading.depth)
        ? ENTRY_TITLE.exec(heading.title)?.[1]
        : undefined
    if (heading === null || heading.depth > ENDING_DEPTH) {
      if (current !== null && text !== '') current.lines += 1
    } else if (id === undefined) {
      current = null
    } else {
      current = { heading: text, id, state: stateOf(heading.title), lines: 0 }
      entries.push(current)
    }
  }

  return entries
}
