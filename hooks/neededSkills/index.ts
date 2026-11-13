import type { On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import {
  forgetCompactedLoads,
  forgetEndedAgent,
  measureContext,
  recordCommandLoad,
  recordLoad,
} from './ledgerHooks'
import { PLUGIN_TOOLS, denyCheckedCallUntilLoaded, denyPluginToolUntilLoaded } from './refusal'

/**
 * Registers the hooks that record a ledger of the loads for each loop in the session, and the hooks
 * that deny a tool call until the loop that made the call loaded what the call needs.
 */
export function registerNeededSkills(on: On): void {
  on('turn.step', EVERY_EVENT, measureContext)
  on('tool.call', EVERY_EVENT, recordLoad)
  on('prompt.submit', EVERY_EVENT, recordCommandLoad)
  on('tool.call', PLUGIN_TOOLS, denyPluginToolUntilLoaded)
  on('tool.check', EVERY_EVENT, denyCheckedCallUntilLoaded)
  on('turn.complete', EVERY_EVENT, forgetEndedAgent)
  on('session.compact', EVERY_EVENT, forgetCompactedLoads)
}
