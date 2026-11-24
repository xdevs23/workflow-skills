import type { EngineInterface, MatchedHook, On } from 'claude-code'

import { deleteEngineStoreValue, readEngineStoreEntries, readEngineStoreKeys } from './engineStore'
import { showingStoreFailure } from './failureToast'
import { RecordOwner, fileOfRecord } from './recordPlacement'
import { StoreCall, callStore, describeFailedStoreCall } from './storeFailures'
import type { StoredEntry } from './pluginStore'
import type { FileOfRecord } from './recordPlacement'
import type { FailedStoreCall } from './storeFailures'
import { lookUpProjectOf } from './projectLookup'
import { projectIn } from './projectRecords'
import { moveProjectRecordsToSessions } from './projectRequestRecords'
import { addMissingRecords, createRecordFile, deleteRecordsFromFile } from './recordFiles'
import { recordsPlaceOf } from './recordsFolder'
import { CONTINUED_CONVERSATION_SOURCES } from './sessionSources'
import { HistoryOutcome, readStartsFromPromptHistory } from './sessions/promptHistory'
import type { PromptHistoryRead } from './sessions/promptHistory'
import { parseStart, startKeyOf } from './sessions/sessionRecord'
import type { SessionStart } from './sessions/sessionRecord'

/** The running session, where it started, and the records folder of its project. */
type RunningSession = { sessionId: string; root: string; project: string; folder: string }

const moveRecordsOfStartedProcess: MatchedHook<'session.start', { isInteractive: true }> = async (
  $,
  e,
  next,
) => {
  await moveStoreRecordsShowingFailure($)

  return next(e)
}

const moveRecordsOfResumedSession: MatchedHook<
  'classic.SessionStart',
  { source: typeof CONTINUED_CONVERSATION_SOURCES }
> = async ($, e, next) => {
  await moveStoreRecordsShowingFailure($)

  return next(e)
}

/**
 * Registers the move of the records for the project into the records folder for the project at the
 * start of a process with a person at the prompt, and at /resume.
 */
export function registerStoreMigration(on: On): void {
  on('session.start', { isInteractive: true }, moveRecordsOfStartedProcess)
  on(
    'classic.SessionStart',
    { source: CONTINUED_CONVERSATION_SOURCES },
    moveRecordsOfResumedSession,
  )
}

async function moveStoreRecordsShowingFailure($: EngineInterface): Promise<void> {
  const [sessionId, root, place] = await Promise.all([
    $.session.id(),
    $.session.root(),
    recordsPlaceOf($),
  ])
  if (!place.isFound) {
    return
  }
  const { project, folder } = place
  await showingStoreFailure(
    $,
    async () => {
      await moveProjectRecordsToSessions($)
      await moveRecordsOfProject($, { sessionId, root, project, folder })
    },
    describeRecordsNotMoved,
  )
}

/**
 * Moves from the store of the engine into the records folder for the project the records of the
 * running session, the records of each session that started in the project, and every record
 * owned by the project that names it as its project. The move leaves every other record in the
 * store of the engine, such as one of another project, one of a session whose start is not known,
 * or one of a feature the plugin no longer has.
 */
async function moveRecordsOfProject($: EngineInterface, running: RunningSession): Promise<void> {
  const placed = (await readEngineStoreKeys($)).flatMap(key => {
    const file = fileOfRecord(running.folder, key)

    return file === undefined ? [] : [{ key, file }]
  })
  const sessions = await findSessionsOfProject($, running, sessionsOwning(placed))
  const candidates = placed.filter(
    ({ file }) => file.owner === RecordOwner.Project || sessions.has(file.sessionId),
  )
  const fileOf = new Map(candidates.map(({ key, file }) => [key, file]))
  const entriesOfFile = new Map<string, { file: FileOfRecord; entries: StoredEntry[] }>()
  for (const entry of await readEngineStoreEntries($, [...fileOf.keys()])) {
    const file = fileOf.get(entry.key)
    const isOfProject =
      file?.owner === RecordOwner.Session || projectIn(entry.value) === running.project
    if (file !== undefined && isOfProject) {
      const moved = entriesOfFile.get(file.path)?.entries ?? []
      entriesOfFile.set(file.path, { file, entries: [...moved, entry] })
    }
  }
  for (const { file, entries } of entriesOfFile.values()) {
    await moveIntoFile($, running, file, entries)
  }
}

function sessionsOwning(placed: readonly { file: FileOfRecord }[]): string[] {
  const sessionIds = placed.flatMap(({ file }) =>
    file.owner === RecordOwner.Session ? [file.sessionId] : [],
  )

  return [...new Set(sessionIds)]
}

/**
 * The sessions among `sessionIds` that belong to the project of `running`: the running session, and
 * each session whose start, recorded by it or found in the prompt history of Claude Code, lies in
 * that project. A session whose start is not known does not belong to any project.
 */
async function findSessionsOfProject(
  $: EngineInterface,
  running: RunningSession,
  sessionIds: readonly string[],
): Promise<Set<string>> {
  const others = sessionIds.filter(sessionId => sessionId !== running.sessionId)
  const startEntries = await readEngineStoreEntries($, others.map(startKeyOf))
  const storedStarts = new Map(startEntries.map(({ key, value }) => [key, value]))
  const recorded = others.map(sessionId => ({
    sessionId,
    start: parseStart(storedStarts.get(startKeyOf(sessionId))),
  }))
  const history = await readStartsFromPromptHistory(
    $,
    recorded.flatMap(({ sessionId, start }) => (start === undefined ? [sessionId] : [])),
  )
  if (history.outcome !== HistoryOutcome.Read) {
    $.ui.log(describeHistoryNotRead(history), { to: 'debug' })
  }
  const historyStarts: ReadonlyMap<string, SessionStart> =
    history.outcome === HistoryOutcome.Read ? history.starts : new Map()
  const rootOf = new Map(
    recorded.flatMap(({ sessionId, start }) => {
      const root = (start ?? historyStarts.get(sessionId))?.root

      return root === undefined ? [] : [[sessionId, root] as const]
    }),
  )
  const roots = [...new Set(rootOf.values())]
  const isInProject = await Promise.all(roots.map(root => isRootInProject($, running, root)))
  const rootsInProject = new Set(roots.filter((_, index) => isInProject[index]))

  return new Set([
    running.sessionId,
    ...[...rootOf].flatMap(([sessionId, root]) => (rootsInProject.has(root) ? [sessionId] : [])),
  ])
}

/**
 * Whether a session started in `root` belongs to the project of `running`: it started where the
 * running session did, in the project folder, or in a folder whose project git finds to be the
 * same, such as a worktree. A folder that is no longer there does not belong to any project,
 * since git cannot tell.
 */
async function isRootInProject(
  $: EngineInterface,
  running: RunningSession,
  root: string,
): Promise<boolean> {
  return (
    root === running.root ||
    root === running.project ||
    (await lookUpProjectOf($, root)) === running.project
  )
}

/**
 * Writes `entries`, the records of the store of the engine in their order there, into the file
 * `file`, and deletes each from that store once a file contains it. The running session adds the
 * records missing from its own file, and keeps the records it already has. A file owned by the
 * project, or by another session, is only created, since another process may write it: a record
 * already in a file owned by the project has moved before, and the records of another session
 * whose file is there move at that session's own start. A record whose deletion from the store
 * of the engine failed is taken out of the file again, so it never stays in both.
 */
async function moveIntoFile(
  $: EngineInterface,
  running: RunningSession,
  file: FileOfRecord,
  entries: readonly StoredEntry[],
): Promise<void> {
  const keys = entries.map(({ key }) => key)
  const { added, moved } = await callStore(StoreCall.Write, keys[0] ?? file.path, () =>
    writeMovedEntries($, running, file, entries),
  )
  const deleted = new Set<string>()
  try {
    for (const key of moved ? keys : []) {
      await deleteEngineStoreValue($, key)
      deleted.add(key)
    }
  } finally {
    const inBoth = added.filter(key => !deleted.has(key))
    if (inBoth.length > 0) {
      await callStore(StoreCall.Write, inBoth[0] ?? file.path, () =>
        deleteRecordsFromFile($, file.path, inBoth),
      )
    }
  }
}

/**
 * Writes `entries` into the file `file` as moveIntoFile describes, and returns the keys it added
 * and whether a file now contains every record of `entries`.
 */
async function writeMovedEntries(
  $: EngineInterface,
  running: RunningSession,
  file: FileOfRecord,
  entries: readonly StoredEntry[],
): Promise<{ added: string[]; moved: boolean }> {
  const keys = entries.map(({ key }) => key)
  if (file.owner === RecordOwner.Session && file.sessionId === running.sessionId) {
    return { added: await addMissingRecords($, file.path, entries), moved: true }
  }
  const isCreated = await createRecordFile($, file.path, entries)

  return { added: isCreated ? keys : [], moved: isCreated || file.owner === RecordOwner.Project }
}

function describeHistoryNotRead(
  read: Exclude<PromptHistoryRead, { outcome: HistoryOutcome.Read }>,
): string {
  const cause =
    read.outcome === HistoryOutcome.NoConfigFolder
      ? 'neither CLAUDE_CONFIG_DIR nor HOME is set'
      : `${read.path} could not be read: ${read.error}`

  return (
    `The prompt history of Claude Code could not be read, since ${cause}. The records of the ` +
    'sessions without a start record stay in the store of the engine until a later start.'
  )
}

function describeRecordsNotMoved(failed: FailedStoreCall): string {
  return (
    'The records that an earlier version of this plugin stored in its store file in ' +
    'plugins/store/ in the configuration folder of Claude Code could not all move into the ' +
    `records for this project. ${describeFailedStoreCall(failed)} A record leaves that file ` +
    'only once the records for its project contain it, so none was lost. The next session ' +
    'that starts in this project moves the rest.'
  )
}
