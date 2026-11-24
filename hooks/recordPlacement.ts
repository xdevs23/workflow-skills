import { recordFileNameOf, recordFilePathOf } from './recordFiles'
import { KEY_SEPARATOR, RecordKind, SESSION_SCOPE, recordKeyOf, recordPrefixOf } from './recordKeys'

/**
 * Who owns a record: one session, the only writer of the file used by that session, or the
 * project, whose every session may replace or delete the file of the record.
 */
export enum RecordOwner {
  Session = 'session',
  Project = 'project',
}

/**
 * The owner of the records of a kind. The key of a record owned by a session has the parts of
 * `scope` after the kind, and the session after them.
 */
type Ownership =
  | { owner: RecordOwner.Session; scope: readonly string[] }
  | { owner: RecordOwner.Project }

const SESSION_AFTER_KIND: Ownership = { owner: RecordOwner.Session, scope: [] }
const SESSION_AFTER_SESSION_SCOPE: Ownership = {
  owner: RecordOwner.Session,
  scope: [SESSION_SCOPE],
}
const OWNED_BY_PROJECT: Ownership = { owner: RecordOwner.Project }

const OWNERSHIP_OF_KINDS: Record<RecordKind, Ownership> = {
  [RecordKind.Request]: SESSION_AFTER_KIND,
  [RecordKind.Reply]: SESSION_AFTER_KIND,
  [RecordKind.Withdrawal]: SESSION_AFTER_KIND,
  [RecordKind.Delivery]: SESSION_AFTER_KIND,
  [RecordKind.Goal]: SESSION_AFTER_SESSION_SCOPE,
  [RecordKind.Reminder]: SESSION_AFTER_SESSION_SCOPE,
  [RecordKind.Session]: SESSION_AFTER_KIND,
  [RecordKind.IdleRoast]: SESSION_AFTER_KIND,
  [RecordKind.Idea]: OWNED_BY_PROJECT,
  [RecordKind.ProjectAutonomy]: OWNED_BY_PROJECT,
  [RecordKind.GoalAutonomy]: SESSION_AFTER_KIND,
  [RecordKind.AutonomyRevocation]: OWNED_BY_PROJECT,
}

const KINDS_OWNED_BY_PROJECT = Object.values(RecordKind).filter(
  kind => OWNERSHIP_OF_KINDS[kind].owner === RecordOwner.Project,
)

const SESSIONS_FOLDER = 'sessions'
const PROJECT_FOLDER = 'project'

/** The file for a record in the records folder for a project, with the owner of the record. */
export type FileOfRecord =
  | { owner: RecordOwner.Session; sessionId: string; path: string }
  | { owner: RecordOwner.Project; path: string }

/**
 * The file for the record under `key` in the records folder `folder`, or undefined for a key of no
 * kind, or for a key without the session that owns it.
 */
export function fileOfRecord(folder: string, key: string): FileOfRecord | undefined {
  const kind = kindOfKey(key)
  if (kind === undefined) {
    return undefined
  }
  const ownership = OWNERSHIP_OF_KINDS[kind]
  switch (ownership.owner) {
    case RecordOwner.Session: {
      const sessionId = sessionNamedIn(key.split(KEY_SEPARATOR), ownership.scope)

      return sessionId === undefined
        ? undefined
        : { owner: ownership.owner, sessionId, path: sessionFilePathOf(folder, sessionId) }
    }
    case RecordOwner.Project:
      return {
        owner: ownership.owner,
        path: recordFilePathOf(folderOfKind(folder, kind), key.slice(recordPrefixOf(kind).length)),
      }
  }
}

function kindOfKey(key: string): RecordKind | undefined {
  return Object.values(RecordKind).find(kind => key.startsWith(recordPrefixOf(kind)))
}

/** The session in the parts `parts` of a key, after the kind and the parts of `scope`. */
function sessionNamedIn(parts: readonly string[], scope: readonly string[]): string | undefined {
  const [, ...afterKind] = parts
  const sessionId = afterKind[scope.length]
  const isInScope = scope.every((part, index) => afterKind[index] === part)

  return isInScope && sessionId !== undefined && sessionId !== '' ? sessionId : undefined
}

function sessionFilePathOf(folder: string, sessionId: string): string {
  return recordFilePathOf(`${folder}/${SESSIONS_FOLDER}`, sessionId)
}

function folderOfKind(folder: string, kind: RecordKind): string {
  return `${folder}/${PROJECT_FOLDER}/${kind}`
}

/**
 * A record file read for the keys that start with a prefix, with the key under which its text
 * reads when the file is not a record file: the key of its record, or the prefix where it names
 * the session of the file. A session file read for keys of every session has no such key.
 */
export type FileInRead = { path: string; keyWhenUnreadable: string | undefined }

/**
 * Where the records under a prefix are: one file, or every record file of a folder, each read as
 * `fileAt` gives for its path.
 */
export type PlaceInRead =
  | { isFolder: false; file: FileInRead }
  | { isFolder: true; folder: string; fileAt: (path: string) => FileInRead }

/**
 * The places in the records folder `folder` that can contain a key starting with `prefix`: the
 * file used by the session that the complete parts of the prefix name, or the folder of the
 * session files, the folder of the kind, or every folder.
 */
export function placesUnder(folder: string, prefix: string): PlaceInRead[] {
  const kind = kindOfKey(prefix)
  if (kind === undefined) {
    return [
      sessionFilesIn(folder),
      ...KINDS_OWNED_BY_PROJECT.map(each => filesOfKind(folder, each)),
    ]
  }
  const ownership = OWNERSHIP_OF_KINDS[kind]
  if (ownership.owner === RecordOwner.Project) {
    return [filesOfKind(folder, kind)]
  }
  const completeParts = prefix.split(KEY_SEPARATOR).slice(0, -1)
  const sessionId = sessionNamedIn(completeParts, ownership.scope)

  return sessionId === undefined
    ? [sessionFilesIn(folder)]
    : [
        {
          isFolder: false,
          file: { path: sessionFilePathOf(folder, sessionId), keyWhenUnreadable: prefix },
        },
      ]
}

function sessionFilesIn(folder: string): PlaceInRead {
  return {
    isFolder: true,
    folder: `${folder}/${SESSIONS_FOLDER}`,
    fileAt: path => ({ path, keyWhenUnreadable: undefined }),
  }
}

function filesOfKind(folder: string, kind: RecordKind): PlaceInRead {
  return {
    isFolder: true,
    folder: folderOfKind(folder, kind),
    fileAt: path => ({ path, keyWhenUnreadable: recordKeyOf(kind, recordFileNameOf(path)) }),
  }
}

/** The keys of `keys` by the path of their file. */
export function filesOfKeys(folder: string, keys: readonly string[]): Map<string, string[]> {
  const files = new Map<string, string[]>()
  for (const key of keys) {
    const path = filePathOfKey(folder, key)
    files.set(path, [...(files.get(path) ?? []), key])
  }

  return files
}

/** The path of the file of the record under `key`. Fails for a key of no kind of record. */
export function filePathOfKey(folder: string, key: string): string {
  const file = fileOfRecord(folder, key)
  if (file === undefined) {
    throw new UnplacedKeyError(key)
  }

  return file.path
}

/** A key that matches no kind of record, or that lacks the session that owns it. */
class UnplacedKeyError extends Error {
  constructor(key: string) {
    super(
      `The key ${key} matches no kind of record of this plugin, so the plugin has no file for it`,
    )
  }
}
