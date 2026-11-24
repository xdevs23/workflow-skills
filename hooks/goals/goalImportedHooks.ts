import type { EngineInterface } from 'claude-code'

import { messageOf } from '../errorMessage'
import { showFailure } from '../failureToast'
import type { ImportedGoal } from './goalImport'

export type GoalsImportedHook = {
  run: (imported: readonly ImportedGoal[]) => Promise<void>
  describeFailure: (message: string) => string
}

// Set at each session start and closing over its `$`, for the reason given beside the hooks in
// goalClearedHooks.
const goalsImportedHooks = new Map<string, GoalsImportedHook>()

export function setGoalsImportedHook(feature: string, hook: GoalsImportedHook): void {
  goalsImportedHooks.set(feature, hook)
}

export async function runGoalsImportedHooks(
  $: EngineInterface,
  imported: readonly ImportedGoal[],
): Promise<void> {
  await Promise.all(
    [...goalsImportedHooks.values()].map(hook =>
      hook.run(imported).catch((error: unknown) => {
        showFailure($, hook.describeFailure(messageOf(error)))
      }),
    ),
  )
}
