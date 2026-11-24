import type { EngineInterface } from 'claude-code'

import { showFailure } from '../failureToast'
import { RoastRecovery, recoveryOf } from './roastFailure'
import type { RoastFailure } from './roastFailure'

/** The texts of one kind of roast for a failure that left it unwritten. */
export type RoastNotWrittenTexts = {
  readonly describeNotWritten: (failure: RoastFailure) => string
  readonly describeNotWrittenToast: (failure: RoastFailure) => string
}

/**
 * Shows `failure` in a toast where only a person can clear it. A failure that a new model call can
 * get past goes to the debug log alone.
 */
export function showRoastFailure(
  $: EngineInterface,
  failure: RoastFailure,
  texts: RoastNotWrittenTexts,
): void {
  switch (recoveryOf(failure)) {
    case RoastRecovery.AskAgain:
      $.ui.log(texts.describeNotWritten(failure), { to: 'debug' })
      break
    case RoastRecovery.NeedsPerson:
      showFailure($, texts.describeNotWrittenToast(failure))
      break
  }
}
