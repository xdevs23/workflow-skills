import { RecordKind, keyPartAfter, recordPrefixOf } from '../pluginStore'

/** The kinds of board. A board for a project would be one more kind. */
export enum ScopeKind {
  Session = 'session',
}

/** Which board a call reads and changes: the board of the session or other scope with the id. */
export type BoardScope = { kind: ScopeKind; id: string }

export function sessionScope(sessionId: string): BoardScope {
  return { kind: ScopeKind.Session, id: sessionId }
}

/**
 * The start of the key of every record of the board of `scope`. A session id contains no `:`, so
 * the start of the keys of one board is never the start of the keys of another.
 */
export function boardPrefixOf(scope: BoardScope): string {
  return recordPrefixOf(RecordKind.Goal, scope.kind, scope.id)
}

/** The id of the session whose board has the record under `key`, when it is such a record. */
export function sessionOfBoardKey(key: string): string | undefined {
  return keyPartAfter(recordPrefixOf(RecordKind.Goal, ScopeKind.Session), key)
}
