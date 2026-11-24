import type { EngineInterface } from 'claude-code'

import { claudeConfigFolderOf } from './claudeConfigFolder'
import { describeFailedProjectLookup, lookUpProjectOf } from './projectLookup'
import type { FailedProjectLookup, ProjectLookupEngine } from './projectLookup'

// Claude Code stores the transcripts of the sessions run in a folder under projects/ in its
// configuration folder, named after the path of that folder with every character other than an
// ASCII letter or digit replaced by `-`. A name longer than 200 characters is cut to 200 and
// followed by `-` and the absolute value of a 32-bit hash of the path in base 36. The name is not
// documented by Claude Code. Checked on 2026-11-24 in the code of Claude Code 2.1.325, and on a
// machine where /home/me/Projects/app became -home-me-Projects-app.
const PROJECTS_FOLDER = 'projects'
const NOT_ASCII_LETTER_OR_DIGIT = /[^A-Za-z0-9]/gu
const FOLDER_NAME_MAX_LENGTH = 200
const HASH_BASE = 36

const PLUGIN_FOLDER = 'workflow-skills'

/** The records folder of a project as error texts show it, for any configuration folder. */
export const RECORDS_FOLDER_TEXT =
  `${PROJECTS_FOLDER}/<folder of the project>/${PLUGIN_FOLDER}/ in the configuration folder of ` +
  'Claude Code'

export type RecordsFolderEngine = ProjectLookupEngine & Pick<EngineInterface, 'env' | 'session'>

export enum RecordsFolderFailureKind {
  NoConfigFolder = 'no-config-folder',
}

/** Why the records folder of the running session is not known. */
export type RecordsFolderNotFound =
  | { kind: RecordsFolderFailureKind.NoConfigFolder }
  | FailedProjectLookup

/** The project that a session belongs to, and the folder that contains its records. */
export type RecordsPlace = { project: string; folder: string }

type FoundRecordsPlace = { isFound: true } & RecordsPlace

export type RecordsPlaceLookup =
  | FoundRecordsPlace
  | { isFound: false; failure: RecordsFolderNotFound }

/**
 * The place found for a project root, kept for the life of the module, so the records of one
 * session never move to another folder while it runs.
 */
let placeOfRoot: { root: string; place: FoundRecordsPlace } | undefined

/**
 * The project of the running session, and the folder of its records beside the transcripts of the
 * project. The project is the folder of the repository, so every worktree of a repository shares
 * the folder.
 */
export async function recordsPlaceOf($: RecordsFolderEngine): Promise<RecordsPlaceLookup> {
  const root = await $.session.root()
  if (placeOfRoot?.root === root) {
    return placeOfRoot.place
  }
  const place = await findRecordsPlace($, root)
  if (place.isFound) {
    placeOfRoot = { root, place }
  }

  return place
}

export function describeRecordsFolderNotFound(failure: RecordsFolderNotFound): string {
  return failure.kind === RecordsFolderFailureKind.NoConfigFolder
    ? 'Neither CLAUDE_CONFIG_DIR nor HOME is set, so the configuration folder of Claude Code, ' +
        'which contains the records, is not known. Set one of them, then try again.'
    : describeFailedProjectLookup(failure)
}

async function findRecordsPlace($: RecordsFolderEngine, root: string): Promise<RecordsPlaceLookup> {
  const [configFolder, project] = await Promise.all([
    claudeConfigFolderOf($),
    lookUpProjectOf($, root),
  ])
  if (configFolder === undefined) {
    return { isFound: false, failure: { kind: RecordsFolderFailureKind.NoConfigFolder } }
  }
  if (typeof project !== 'string') {
    return { isFound: false, failure: project }
  }

  return {
    isFound: true,
    project,
    folder: `${configFolder}/${PROJECTS_FOLDER}/${folderNameOf(project)}/${PLUGIN_FOLDER}`,
  }
}

/** The name of the folder that Claude Code gives the transcripts of sessions run in `path`. */
function folderNameOf(path: string): string {
  const name = path.replace(NOT_ASCII_LETTER_OR_DIGIT, '-')
  if (name.length <= FOLDER_NAME_MAX_LENGTH) {
    return name
  }

  return `${name.slice(0, FOLDER_NAME_MAX_LENGTH)}-${Math.abs(hashOf(path)).toString(HASH_BASE)}`
}

/** The 32-bit hash of the UTF-16 code units of `text` by which Claude Code names long folders. */
function hashOf(text: string): number {
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }

  return hash
}
