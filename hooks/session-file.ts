import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { SessionFolder } from '../types'
import { isJsonObject } from './json.ts'
import type { Json, JsonObject } from './json.ts'

// The kinds of the folder of a session, as the plugin types declare them.
export const FolderKind = {
  Unknown: 'unknown',
  NoTranscript: 'no-transcript',
  Known: 'known',
} as const satisfies Record<string, SessionFolder['kind']>

// The reasons the settings file of a session cannot be read as a JSON object.
export const FileProblem = { NotJson: 'not-json', NotObject: 'not-object' } as const
export type FileProblem = (typeof FileProblem)[keyof typeof FileProblem]

export const SectionKind = {
  Absent: 'absent',
  Valid: 'valid',
  Invalid: 'invalid',
  FileUnreadable: 'file-unreadable',
} as const

// The section of one key in the settings file of a session: absent, valid by the guard of the
// caller, invalid, or in a file that is not a JSON object.
type Section<T> =
  | { kind: typeof SectionKind.Absent }
  | { kind: typeof SectionKind.Valid; path: string; value: T }
  | { kind: typeof SectionKind.Invalid; path: string }
  | { kind: typeof SectionKind.FileUnreadable; path: string; problem: FileProblem }

export const WriteKind = { Written: 'written', FileUnreadable: 'file-unreadable' } as const

type SectionWrite =
  | { kind: typeof WriteKind.Written }
  | { kind: typeof WriteKind.FileUnreadable; path: string; problem: FileProblem }

// The file in the folder of a session that contains every setting of the plugin for that session.
const SETTINGS_FILE = 'workflow-skills.json'

const TRANSCRIPT_SUFFIX = '.jsonl'

const UNKNOWN: SessionFolder = { kind: FolderKind.Unknown }

const folder = atom({ plugin: 'workflow-skills', key: 'sessionFolder' } as const, UNKNOWN)

// The folder of a session has the name of its transcript without the suffix. A session without a
// local transcript has an empty path.
const folderOf = (transcriptPath: string): SessionFolder =>
  transcriptPath.endsWith(TRANSCRIPT_SUFFIX)
    ? { kind: FolderKind.Known, path: transcriptPath.slice(0, -TRANSCRIPT_SUFFIX.length) }
    : { kind: FolderKind.NoTranscript }

const pathOf = (session: SessionFolder): string | null =>
  session.kind === FolderKind.Known ? session.path : null

const fileOf = (folderPath: string): string => `${folderPath}/${SETTINGS_FILE}`

const fileText = (keys: JsonObject): string => `${JSON.stringify(keys, null, 2)}\n`

export function sessionFolder($: EngineInterface): Promise<SessionFolder> {
  return read($, folder)
}

// Records the folder of the session whose transcript path a classic event passes, and returns
// whether it is another folder than the one recorded: at the start of a session, after a /clear,
// at a resume and a fork, and at the first event a module loaded during a session receives.
export async function enterSession($: EngineInterface, transcriptPath: string): Promise<boolean> {
  const entered = folderOf(transcriptPath)
  const before = await read($, folder)
  if (entered.kind === before.kind && pathOf(entered) === pathOf(before)) return false
  await update($, folder, () => entered)

  return true
}

// Every key of the settings file, none for a missing file, or the reason the file is not a JSON
// object.
async function readKeys($: EngineInterface, path: string): Promise<JsonObject | FileProblem> {
  if (!(await $.fs.exists(path))) return {}
  let keys: unknown
  try {
    keys = JSON.parse(await $.fs.read(path))
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return FileProblem.NotJson
  }

  return isJsonObject(keys) ? keys : FileProblem.NotObject
}

// Reads the section of `key` in the settings file in `folderPath`.
export async function readSection<T extends Json>(
  $: EngineInterface,
  folderPath: string,
  key: string,
  isValid: (value: Json) => value is T,
): Promise<Section<T>> {
  const path = fileOf(folderPath)
  const keys = await readKeys($, path)
  if (typeof keys === 'string') return { kind: SectionKind.FileUnreadable, path, problem: keys }
  const value = keys[key]
  if (value === undefined) return { kind: SectionKind.Absent }

  return isValid(value)
    ? { kind: SectionKind.Valid, path, value }
    : { kind: SectionKind.Invalid, path }
}

// Writes the section of `key` in the settings file in `folderPath` and every other key of the file
// back unchanged. A file that is not a JSON object is left as it is.
export async function writeSection(
  $: EngineInterface,
  folderPath: string,
  key: string,
  value: Json,
): Promise<SectionWrite> {
  const path = fileOf(folderPath)
  const keys = await readKeys($, path)
  if (typeof keys === 'string') return { kind: WriteKind.FileUnreadable, path, problem: keys }
  await $.fs.write(path, fileText({ ...keys, [key]: value }))

  return { kind: WriteKind.Written }
}
