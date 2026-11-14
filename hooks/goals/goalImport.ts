import type { Board, Goal } from '../../types'
import { Outcome, addGoal, openGoalsByIdOf, openGoalsOf } from './board'
import { dependedGoalOf } from './dependency'
import { priorityOf } from './priority'
import { settingOf } from './setting'

/**
 * A goal added from an open goal of another session, and the number of the goal of that session
 * depended on by the source goal, when the dependency was not carried over.
 */
export type ImportedGoal = { goal: Goal; lostDependency?: number }

/**
 * The open goals of `source` with the ids `pickedIds`, in their order on `source`, added to
 * `target` at `importedAt` as addGoal adds a goal. Each new goal has the text and the priority of
 * the source goal, and the id given to it by `newIds`, which has the new id of every open goal of
 * `source`, so a goal imported once is found on `target` and not imported again. A new goal
 * depends on the new goal made from the goal depended on by the source goal, when that goal is
 * imported with it or was imported before. Done marks and TODO entries are not imported.
 */
export function importedGoalsOf(
  source: Board,
  { pickedIds, newIds }: { pickedIds: ReadonlySet<string>; newIds: ReadonlyMap<string, string> },
  target: Board,
  importedAt: number,
): ImportedGoal[] {
  const open = openGoalsByIdOf(source)
  const onTarget = new Set(target.goals.map(goal => goal.id))
  const picked = openGoalsOf(source).flatMap(goal => {
    const id = newIds.get(goal.id)

    return pickedIds.has(goal.id) && id !== undefined ? [{ goal, id }] : []
  })
  const carried = new Set([...onTarget, ...picked.map(({ id }) => id)])
  const imported: ImportedGoal[] = []
  let board = target
  for (const { goal, id } of picked.filter(each => !onTarget.has(each.id))) {
    const added = addGoal(board, { id, text: goal.text }, importedAt)
    if (added.outcome !== Outcome.Changed) {
      continue
    }
    board = added.board
    const depended = dependedGoalOf(open, goal)
    const dependsOn = depended === undefined ? undefined : newIds.get(depended.id)
    const isCarried = dependsOn !== undefined && carried.has(dependsOn)
    const priority = priorityOf(goal)
    imported.push({
      goal: {
        ...added.goal,
        ...(priority === undefined ? {} : { prioritySetting: settingOf(priority, importedAt) }),
        ...(isCarried ? { dependencySetting: settingOf(dependsOn, importedAt) } : {}),
      },
      ...(depended === undefined || isCarried ? {} : { lostDependency: depended.number }),
    })
  }

  return imported
}
