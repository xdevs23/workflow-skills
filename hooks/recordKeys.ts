/**
 * The kinds of record in the store used by the plugin. Every record is stored under the key
 * `<kind>:<owner>:<rest>`. The owner is the one writer of the record, such as a session, and the
 * rest is read by the module of the kind. The store does not offer compare-and-set, so no key is
 * written by two owners. The kinds of a request and of its reply use the keys `questions` and
 * `answers`, since stored records use these keys.
 */
export enum RecordKind {
  Request = 'questions',
  Reply = 'answers',
  Withdrawal = 'withdrawals',
  Delivery = 'deliveries',
  Goal = 'goals',
  Reminder = 'reminders',
  Session = 'sessions',
  IdleRoast = 'idle-roast',
  Idea = 'ideas',
  ProjectAutonomy = 'project-autonomy',
  GoalAutonomy = 'goal-autonomy',
  AutonomyRevocation = 'autonomy-revocations',
}

/** The kind of scope written before the session in the keys of goals and reminders. */
export const SESSION_SCOPE = 'session'

export const KEY_SEPARATOR = ':'

export function recordKeyOf(kind: RecordKind, ...parts: readonly string[]): string {
  return [kind, ...parts].join(KEY_SEPARATOR)
}

/** The start of every key of the kind `kind` that begins with `parts`. */
export function recordPrefixOf(kind: RecordKind, ...parts: readonly string[]): string {
  return `${recordKeyOf(kind, ...parts)}${KEY_SEPARATOR}`
}

/** The part of `key` that follows `prefix`, up to the next separator, when `key` starts with it. */
export function keyPartAfter(prefix: string, key: string): string | undefined {
  return key.startsWith(prefix) ? key.slice(prefix.length).split(KEY_SEPARATOR)[0] : undefined
}
