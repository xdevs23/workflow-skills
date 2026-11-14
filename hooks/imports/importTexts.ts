import { describeFailedStoreCall } from '../pluginStore'
import type { FailedStoreCall } from '../pluginStore'
import { IMPORT_NAMES } from './importNames'
import type { ImportKind } from './importPaneMessages'
import { describeSession } from './importPaneTexts'
import type { NamedSession } from './importPaneTexts'

// The texts of the imports shown to the user at the prompt.

export function describeNotRegistered(command: string, reason: string): string {
  return (
    `/${command} could not be registered, so it cannot import from earlier sessions: ${reason}. ` +
    'The debug log has this too.'
  )
}

export function describeSessionsNotListed(failed: FailedStoreCall): string {
  return `The sessions of this project could not be listed. ${describeFailedStoreCall(failed)}`
}

export function describeSessionRecordsNotDeleted(failed: FailedStoreCall): string {
  return (
    'The folder and the first prompt of this session, which has no goals or reminders, could not ' +
    `be deleted from the store. ${describeFailedStoreCall(failed)}`
  )
}

export function describeStartNotRead(key: string): string {
  return (
    `The start record under the key ${key} is not in the shape this plugin writes, so its ` +
    'session is listed under Folder unknown.'
  )
}

/** The text for `session`, named with ids cut to `idLength`, left out of the list for `reason`. */
export function describeSessionNotRead(
  session: NamedSession,
  idLength: number,
  reason: string,
): string {
  return (
    `The goals and reminders of ${describeSession(session, idLength)} could not be read, so it ` +
    `is not listed. ${reason}`
  )
}

/** The text for an import that failed for `reason`, after which an import of the rest is safe. */
export function describeNotImported(kind: ImportKind, reason: string): string {
  const { one, several } = IMPORT_NAMES[kind].noun

  return (
    `Not every ticked ${one} was imported. ${reason} An import of the same ${several} stores ` +
    'only the ones not stored yet.'
  )
}

export function describeNothingImported(kind: ImportKind): string {
  return (
    `No ${IMPORT_NAMES[kind].noun.one} was imported: each ticked one is in this session ` +
    'already, or is gone from the session it came from.'
  )
}
