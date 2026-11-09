import type { Matcher, SeenToolCall, ToolCall } from './matcher'
import { regExpLiteralOf } from './regExpLiteral'

/** Patterns over the path of a file, each of which matches on its own. */
export type FilePatterns = {
  /** Patterns of file names, where `*` stands for any run of characters, such as `*.kt`. */
  names?: readonly string[]
  /** Names of folders the file lies in at any depth below the project root, such as `locales`. */
  folders?: readonly string[]
}

/** Matches a call that writes a file whose path fits one of `patterns`. */
export function writesFile({ names = [], folders = [] }: FilePatterns): Matcher {
  const nameExpressions = names.map(nameExpressionOf)

  return seen => {
    const written = writtenFileOf(seen)

    return (
      written !== undefined &&
      (nameExpressions.some(expression => expression.test(written.name)) ||
        written.folders.some(folder => folders.includes(folder)))
    )
  }
}

/**
 * The name of the file written by the call of `seen`, and the folders it lies in below the project
 * root. A file outside the root lies in no folder, so a folder above the project, such as one named
 * `tests`, does not match.
 */
function writtenFileOf({
  call,
  projectRoot,
}: SeenToolCall): { name: string; folders: readonly string[] } | undefined {
  const path = writtenPathOf(call)
  if (path === undefined) {
    return undefined
  }
  const inProject = `${projectRoot}/`
  const folders = path.startsWith(inProject) ? path.slice(inProject.length).split('/') : []

  return { name: path.slice(path.lastIndexOf('/') + 1), folders: folders.slice(0, -1) }
}

/** The path of the file written by `call`, for a call to a tool that writes one. */
function writtenPathOf({ tool, input: { file_path } }: ToolCall): string | undefined {
  switch (tool) {
    case 'Edit':
    case 'Write':
      return typeof file_path === 'string' ? file_path : undefined
    default:
      return undefined
  }
}

/** The expression of a file name pattern, whose `*` stands for any run of characters. */
function nameExpressionOf(pattern: string): RegExp {
  return new RegExp(`^${pattern.split('*').map(regExpLiteralOf).join('.*')}$`, 'u')
}
