import type { EngineInterface, On } from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import { SWITCHING_SOURCES } from '../sessionSources'
import { runAfterMainTurn } from '../timedWork'
import { hintRoastAfterIdleWait } from './hintRoast'
import { idleRoastAfterIdleWait } from './idleRoast'
import {
  IdleWaitCancel,
  cancelIdleWait,
  recordRequestSent,
  resumeIdleWait,
  startIdleWait,
} from './idleWait'
import type { IdleWaitWorks } from './idleWait'

/**
 * Registers the hooks of the wait after which the roast on hints and the idle roast run: each model
 * request of the main conversation sets when it counts from, the end of a turn of the main
 * conversation starts it, the start of a turn of the main conversation and a switch to another
 * session cancel it, and the start of the session after a reload of the plugin waits for the time
 * left of it.
 */
export function registerIdleWait(on: On): void {
  on('turn.step', EVERY_EVENT, recordRequestSent)
  on('session.start', EVERY_EVENT, async ($, e, next) => {
    await resumeIdleWait($, roastsAfterIdleWait($))

    return next(e)
  })
  on('turn.start', EVERY_EVENT, async ($, e, next) => {
    if (isMainConversation(e)) {
      await cancelIdleWait($, IdleWaitCancel.TurnStarted, roastsAfterIdleWait($))
    }

    return next(e)
  })
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, async ($, e, next) => {
    await cancelIdleWait($, IdleWaitCancel.SessionSwitched, roastsAfterIdleWait($))

    return next(e)
  })
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    runAfterMainTurn(e, next, () => startIdleWait($, roastsAfterIdleWait($))),
  )
}

// The engine passes `$` only to a function named at the call, so each roast after the wait is
// named here. The roast on hints runs first, and the idle roast only where the roast on hints sent
// nothing.
export function roastsAfterIdleWait($: EngineInterface): IdleWaitWorks {
  return [hintRoastAfterIdleWait($), idleRoastAfterIdleWait($)]
}
