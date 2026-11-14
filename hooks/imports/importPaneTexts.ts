import { DAY_AND_TIME } from '../dayAndTime'
import { DEPENDENCY_LABEL } from '../goals/goalPaneTexts'
import { kindOf } from '../reminders/cadenceKind'
import { CADENCE_KINDS } from '../reminders/cadenceKinds'
import { OFF_LABEL, ON_LABEL } from '../reminders/reminderPaneTexts'
import { IMPORT_NAMES } from './importNames'
import { ImportKind, SHOWN_RANK_OF_KIND } from './importPaneMessages'
import type { PaneSession, ReminderRow } from './importPaneMessages'

// The texts of the import panes, drawn by their surface module and by the hooks module.

export const SESSIONS_HEADING = 'Sessions of this project, newest first'
export const FOLDER_UNKNOWN = 'Folder unknown'
export const BACK_LABEL = 'Back'
export const TICKED_MARK = '[x]'
export const UNTICKED_MARK = '[ ]'

/** A session named in a text: by the time it started, or by the start of its id without one. */
export type NamedSession = { sessionId: string; startedAt?: number }

/** A new goal, by its number, whose source goal depended on the goal numbered `dependedOn`. */
export type LostDependency = { goal: number; dependedOn: number }

/** `count` goals or reminders, such as "1 goal" or "3 reminders". */
function describeCount(kind: ImportKind, count: number): string {
  const { one, several } = IMPORT_NAMES[kind].noun

  return `${count} ${count === 1 ? one : several}`
}

export function describeNotListed(kind: ImportKind): string {
  return `Run /${IMPORT_NAMES[kind].command} again to list the earlier sessions of this project.`
}

export function describeNothingToImport(kind: ImportKind): string {
  return `No earlier session of this project has ${IMPORT_NAMES[kind].noun.several} to import.`
}

/**
 * The length of the shortest start of the ids `sessionIds` that tells each of them apart from the
 * others, so a session without a start record is named by as few characters as the list needs.
 */
export function uniqueIdLengthOf(sessionIds: readonly string[]): number {
  const longest = Math.max(0, ...sessionIds.map(id => id.length))
  for (let length = 1; length < longest; length += 1) {
    if (new Set(sessionIds.map(id => id.slice(0, length))).size === sessionIds.length) {
      return length
    }
  }

  return longest
}

/** When `session` started, or the start of its id cut to `idLength`, such as "session 6d1c". */
function sessionNameOf({ sessionId, startedAt }: NamedSession, idLength: number): string {
  return startedAt === undefined
    ? `session ${sessionId.slice(0, idLength)}`
    : DAY_AND_TIME.format(startedAt)
}

/** The session in a sentence: "the session of Nov 13, 23:41", or "session 6d1c". */
export function describeSession(session: NamedSession, idLength: number): string {
  const name = sessionNameOf(session, idLength)

  return session.startedAt === undefined ? name : `the session of ${name}`
}

/** The line of a listed session: its name, and how many goals and reminders it has to import. */
export function describeSessionLine(session: PaneSession<unknown>, idLength: number): string {
  const counts = Object.values(ImportKind)
    .sort((one, other) => SHOWN_RANK_OF_KIND[one] - SHOWN_RANK_OF_KIND[other])
    .filter(kind => session.counts[kind] > 0)
    .map(kind => describeCount(kind, session.counts[kind]))

  return [sessionNameOf(session, idLength), ...counts].join('  ')
}

export function describePickedSession(session: NamedSession, idLength: number): string {
  return `From ${describeSession(session, idLength)}`
}

export function describeImportLabel(kind: ImportKind, count: number): string {
  return `Import ${describeCount(kind, count)}`
}

export function describeImporting(kind: ImportKind, count: number): string {
  return `Importing ${describeCount(kind, count)}…`
}

/** The badges before the text of a reminder: its cadence, of a kind known, and its switch. */
export function describeReminderBadges({ cadence, isEnabled }: ReminderRow): string[] {
  const described = kindOf(CADENCE_KINDS, cadence.kind)?.describe(cadence.values)

  return [...(described === undefined ? [] : [described]), isEnabled ? ON_LABEL : OFF_LABEL]
}

/**
 * The lines under the goals or reminders imported, such as "Imported 3 goals from the session of
 * Nov 13, 23:41", and a line for each new goal whose dependency was not carried over.
 */
export function describeImportNote({
  kind,
  count,
  from,
  idLength,
  lostDependencies,
}: {
  kind: ImportKind
  count: number
  from: NamedSession
  idLength: number
  lostDependencies: readonly LostDependency[]
}): string {
  return [
    `Imported ${describeCount(kind, count)} from ${describeSession(from, idLength)}`,
    ...lostDependencies.map(
      ({ goal, dependedOn }) =>
        `Goal ${goal} lost its ${DEPENDENCY_LABEL}: goal ${dependedOn} of that session was not ` +
        'ticked.',
    ),
  ].join('\n')
}
