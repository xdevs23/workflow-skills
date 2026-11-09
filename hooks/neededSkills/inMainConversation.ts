import { isMainConversation } from '../conversation'
import type { Matcher } from './matcher'

/** Matches a call of the main conversation that `matcher` matches, and no call of an agent. */
export function inMainConversation(matcher: Matcher): Matcher {
  return seen => isMainConversation(seen.call) && matcher(seen)
}
