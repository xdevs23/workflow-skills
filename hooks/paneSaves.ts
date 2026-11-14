import type { RenderSurface } from 'claude-code'

import type { PaneAnswer, PaneSave } from './paneModule'
import type { PaneRecord, PaneSite, StoredPane } from './paneWorker'

/**
 * A save of a pane run by the hooks module: the id given to it by the pane, the surface it was made
 * on, the id of the hook run that runs it, and its result, null while it runs. Once the pane leaves
 * a save with a result out of its queue, the pane has ended the save.
 */
export type RecordedSave<Result> = {
  actionId: string
  surface: RenderSurface
  runId: string
  result: Result | null
  isEndedByPane: boolean
}

/** The results of the saves made on `surface` that the pane did not end yet. */
export function answersOf<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  surface: RenderSurface,
): PaneAnswer<Result>[] {
  return record.saves.flatMap(save =>
    save.surface === surface && save.result !== null && !save.isEndedByPane
      ? [{ actionId: save.actionId, result: save.result }]
      : [],
  )
}

/** `record` with each save made on `surface` that has a result and is not in `waiting` ended. */
export function withSavesEnded<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  surface: RenderSurface,
  waiting: readonly PaneSave<Action>[],
): PaneRecord<Local, Action, Result> {
  const waitingIds = new Set(waiting.map(({ actionId }) => actionId))

  return {
    ...record,
    saves: record.saves.map(save =>
      save.surface === surface && save.result !== null && !waitingIds.has(save.actionId)
        ? { ...save, isEndedByPane: true }
        : save,
    ),
  }
}

/** Whether a hook run may run a save, by its record. */
enum SaveClaim {
  /** The save was not run, and the hook run now runs it. */
  Claimed = 'claimed',
  /** Another hook run runs the save. */
  Running = 'running',
  Answered = 'answered',
}

/**
 * Runs each save of `saves` that has not run, in order, and records its result, also the failed
 * result of a save that throws. Stops at a save that another hook run runs: the pane posts the
 * saves after it again once its result arrived. Returns whether it ran a save.
 */
export async function runSaves<View, Local, Action, Result>(
  site: PaneSite<View, Local, Action, Result>,
  surface: RenderSurface,
  saves: readonly PaneSave<Action>[],
): Promise<boolean> {
  const runId = crypto.randomUUID()
  let hasRun = false
  for (const { actionId, action } of saves) {
    switch (await claimSave(site.stored, { actionId, surface, runId })) {
      case SaveClaim.Running:
        return hasRun
      case SaveClaim.Answered:
        continue
      case SaveClaim.Claimed:
        break
    }
    hasRun = true
    let result = site.failed
    try {
      result = await site.save(action)
    } finally {
      await site.stored.update(record => withResult(record, actionId, result))
    }
  }

  return hasRun
}

/** Records the save `actionId` as run by `runId`, unless it has a record, and tells the claim. */
async function claimSave<Local, Action, Result>(
  stored: StoredPane<Local, Action, Result>,
  { actionId, surface, runId }: { actionId: string; surface: RenderSurface; runId: string },
): Promise<SaveClaim> {
  const record = await stored.update(current =>
    current.saves.some(save => save.actionId === actionId)
      ? current
      : {
          ...current,
          saves: [
            ...current.saves,
            { actionId, surface, runId, result: null, isEndedByPane: false },
          ],
        },
  )
  const claimed = record.saves.find(save => save.actionId === actionId)
  if (claimed === undefined || claimed.result !== null) {
    return SaveClaim.Answered
  }

  return claimed.runId === runId ? SaveClaim.Claimed : SaveClaim.Running
}

/**
 * `record` with `result` as the result of the save `actionId`, while it runs. A save recorded as
 * failed by the failure of its hook keeps that result.
 */
function withResult<Local, Action, Result>(
  record: PaneRecord<Local, Action, Result>,
  actionId: string,
  result: Result,
): PaneRecord<Local, Action, Result> {
  return {
    ...record,
    saves: record.saves.map(save =>
      save.actionId === actionId && save.result === null ? { ...save, result } : save,
    ),
  }
}
