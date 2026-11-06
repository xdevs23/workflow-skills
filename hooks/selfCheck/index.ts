import type { On } from 'claude-code'

import { EVERY_EVENT } from '../register'
import {
  startScheduleOnUserMessage,
  submitWithSelfCheck,
  waitForDueTimeAfterLoad,
  waitForDueTimeAfterSwitch,
  waitForDueTimeAfterTurn,
} from './idleSelfCheck'

/**
 * Registers the hooks that tell the main conversation to check the work delivered by it while the
 * user is away.
 */
export function registerSelfCheck(on: On): void {
  on('session.start', EVERY_EVENT, waitForDueTimeAfterLoad)
  on('classic.SessionStart', EVERY_EVENT, waitForDueTimeAfterSwitch)
  on('prompt.submit', EVERY_EVENT, startScheduleOnUserMessage)
  on('prompt.submit', EVERY_EVENT, submitWithSelfCheck)
  on('turn.complete', EVERY_EVENT, waitForDueTimeAfterTurn)
}
