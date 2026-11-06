/**
 * The matcher of a hook that runs on every event of its kind. The engine refuses a second hook
 * without a matcher on one event of a plugin, and a matcher that names no field matches every
 * event, so each feature registers such a hook with this matcher.
 */
export const EVERY_EVENT: Readonly<Record<never, never>> = {}

export type EveryEvent = typeof EVERY_EVENT
