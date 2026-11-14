import type { DoneMark } from '../../types'
import { isRecord } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import { UnreadablePost, unreadableField } from '../unreadablePost'
import { GoalPaneActionKind } from './goalPaneMessages'
import type { GoalPaneAction } from './goalPaneMessages'
import { isPriority } from './priority'

/** Reads the action posted by the surface module of the Goals pane, which arrives unchecked. */
export function readGoalPaneAction(action: unknown): GoalPaneAction | UnreadablePost {
  if (!isRecord(action)) {
    return new UnreadablePost('an action is not an object')
  }
  const { goal, text, editedFrom, reason, priority, dependsOn } = action
  const kind = Object.values(GoalPaneActionKind).find(each => each === action.kind)
  if (kind === undefined) {
    return unreadableField('kind')
  }
  if (!isPositiveInteger(goal)) {
    return unreadableField('goal')
  }
  switch (kind) {
    case GoalPaneActionKind.Add:
      return typeof text === 'string' ? { kind, goal, text } : unreadableField('text')
    case GoalPaneActionKind.Edit:
      if (typeof text !== 'string') {
        return unreadableField('text')
      }

      return typeof editedFrom === 'string'
        ? { kind, goal, text, editedFrom }
        : unreadableField('editedFrom')
    case GoalPaneActionKind.Clear:
    case GoalPaneActionKind.Nudge:
      return { kind, goal }
    case GoalPaneActionKind.Unmark: {
      const shown = readDoneMark(action.shown)
      if (shown === undefined) {
        return unreadableField('shown')
      }
      if (reason === undefined) {
        return { kind, goal, shown }
      }

      return typeof reason === 'string'
        ? { kind, goal, shown, reason }
        : unreadableField('reason')
    }
    case GoalPaneActionKind.Prioritize:
      if (priority === undefined) {
        return { kind, goal }
      }

      return isPriority(priority) ? { kind, goal, priority } : unreadableField('priority')
    case GoalPaneActionKind.Depend:
      if (dependsOn === undefined) {
        return { kind, goal }
      }

      return isPositiveInteger(dependsOn) ? { kind, goal, dependsOn } : unreadableField('dependsOn')
  }
}

/** The done mark in `mark`, or undefined when `mark` is not one. */
function readDoneMark(mark: unknown): DoneMark | undefined {
  if (!isRecord(mark)) {
    return undefined
  }
  const { evidence, markedAt } = mark

  return typeof evidence === 'string' && typeof markedAt === 'number'
    ? { evidence, markedAt }
    : undefined
}
