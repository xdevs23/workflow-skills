import type { EngineInterface } from 'claude-code'

import type { Goal } from '../../types'
import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'

/**
 * Work that another feature runs on a goal after the user cleared it, such as on the TODO entries
 * attached to it, with the toast text for a failure of that work.
 */
export type GoalClearedHook = {
  run: (goal: Goal) => Promise<void>
  describeFailure: (goal: Goal, message: string) => string
}

// The engine passes `$` only to a function declared at the top of a file or imported, so a feature
// sets a hook that closes over the `$` passed to its `session.start` hook. Each session start
// replaces the hook set by the session start before it, so a clear runs the hook of each feature
// once, with the `$` of the latest session.
const goalClearedHooks = new Map<string, GoalClearedHook>()

/** Sets `hook` as the hook of `feature` run after each goal the user clears. */
export function setGoalClearedHook(feature: string, hook: GoalClearedHook): void {
  goalClearedHooks.set(feature, hook)
}

/**
 * Runs the hook of each feature on `goal`, which the user cleared, and shows the failure of each
 * hook in a toast, since the clear is stored whatever the hooks do.
 */
export async function runGoalClearedHooks($: EngineInterface, goal: Goal): Promise<void> {
  await Promise.all(
    [...goalClearedHooks.values()].map(hook =>
      hook
        .run(goal)
        .catch((error: unknown) => showFailure($, hook.describeFailure(goal, messageOf(error)))),
    ),
  )
}
