import type { Engine } from 'claude-code/testing'

import { storeEngineOf } from '../testSupport'
import type { Session } from '../testSupport'
import { sessionScope } from './boardScope'
import { saveClearedGoal, saveGoalDependency, saveNewGoal } from './boardStore'
import { LIST_GOALS_TOOL } from './goalNames'

// The board and the calls shared by the tests of the goal tools.

export const MIGRATION_GUIDE = 'Write the migration guide'
export const ROTATION_CRASH = 'Fix the crash on rotation'

export const SEE_OPEN_GOALS =
  `Call ${LIST_GOALS_TOOL} to see the open goals and the entries attached to them.`

/** Adds goals to the board of the session, as the user does, and clears the goals `cleared`. */
export async function addGoals(
  session: Session,
  goals: readonly string[],
  cleared: readonly number[] = [],
): Promise<void> {
  const store = storeEngineOf(session, session.clock, session.logs)
  const scope = sessionScope(session.id)
  for (const text of goals) {
    await saveNewGoal(store, scope, text, 100)
  }
  for (const number of cleared) {
    await saveClearedGoal(store, scope, number, 200)
  }
}

/** Makes goal `number` depend on goal `dependsOn`, as the user does in the Goals pane. */
export async function makeDependent(
  session: Session,
  number: number,
  dependsOn: number,
): Promise<void> {
  const store = storeEngineOf(session, session.clock, session.logs)
  await saveGoalDependency(store, sessionScope(session.id), number, dependsOn, 150)
}

export async function listGoals($: Engine, agentId?: string): Promise<string> {
  const listed = await $.tool.call({
    tool: LIST_GOALS_TOOL,
    ...(agentId === undefined ? {} : { agentId }),
  })

  return String(listed.deny ?? listed.result)
}
