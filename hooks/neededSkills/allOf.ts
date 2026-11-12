import type { Matcher } from './matcher'

/** Matches a call that every one of `matchers` matches, such as a file name and a folder. */
export function allOf(...matchers: readonly Matcher[]): Matcher {
  return seen => matchers.every(matcher => matcher(seen))
}
