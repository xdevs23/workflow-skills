import type { EngineInterface, On, Timer } from 'claude-code'

import { isMainConversation } from '../conversation'
import { EVERY_EVENT } from '../everyEvent'
import { SWITCHING_SOURCES } from '../sessionSources'
import { MILLISECONDS_PER_SECOND } from '../timeUnits'
import { runAfterMainTurn, runDetached } from '../timedWork'
import { dropHintRoastsOfWait, holdHintRoastsForWait, roastHintsAfterWait } from './hintRoast'
import { roastIdleStretchDetached } from './idleRoast'
import { IDLE_WAIT_SECONDS } from './roastNames'
import { describeHintRoastLost } from './roastTexts'

// The timer of the wait of the running session, replaced by each start of the wait.
let waitTimer: Timer | undefined = undefined

/**
 * Registers the hooks of the wait of the running session, after which the roast on hints and the
 * idle roast run: the end of a turn of the main conversation starts it, and the start of a turn of
 * the main conversation and a switch to another session cancel it.
 */
export function registerIdleWait(on: On): void {
  on('turn.start', EVERY_EVENT, ($, e, next) => {
    if (isMainConversation(e)) {
      cancelIdleWait($)
    }

    return next(e)
  })
  on('classic.SessionStart', { source: SWITCHING_SOURCES }, ($, e, next) => {
    cancelIdleWait($)

    return next(e)
  })
  on('turn.complete', EVERY_EVENT, ($, e, next) =>
    runAfterMainTurn(e, next, async () => startIdleWait($)),
  )
}

function startIdleWait($: EngineInterface): void {
  holdHintRoastsForWait()
  restartIdleWait($)
}

/** Starts the wait again from now, and leaves the roasts on hints held for the wait. */
export function restartIdleWait($: EngineInterface): void {
  waitTimer?.cancel()
  const timer: Timer = $.clock.after(IDLE_WAIT_SECONDS * MILLISECONDS_PER_SECOND, () => {
    roastAfterWait($, () => waitTimer === timer)
  })
  waitTimer = timer
}

function cancelIdleWait($: EngineInterface): void {
  waitTimer?.cancel()
  waitTimer = undefined
  dropHintRoastsOfWait($)
}

/**
 * Runs the roast on hints once the wait ended, and then the idle roast while `isWaitOfSession` and
 * the roast on hints sent the session nothing. A failed roast on hints is shown as `runDetached`
 * shows it, and the idle roast does not run.
 */
function roastAfterWait($: EngineInterface, isWaitOfSession: () => boolean): void {
  runDetached(
    $,
    async () => {
      if (!(await roastHintsAfterWait($, isWaitOfSession)) && isWaitOfSession()) {
        roastIdleStretchDetached($, isWaitOfSession)
      }
    },
    describeHintRoastLost,
  )
}
