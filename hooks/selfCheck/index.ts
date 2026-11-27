import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import {
  startScheduleOnUserMessage,
  waitForDueTimeAfterLoad,
  waitForDueTimeAfterSwitch,
} from './idleSelfCheck'

/**
 * Registers the hooks that have a fork roast the work delivered by the main conversation while the
 * user is away.
 */
export function registerSelfCheck(on: On): void {
  on('session.start', EVERY_EVENT, waitForDueTimeAfterLoad)
  on('classic.SessionStart', EVERY_EVENT, waitForDueTimeAfterSwitch)
  on('prompt.submit', EVERY_EVENT, startScheduleOnUserMessage)
}
