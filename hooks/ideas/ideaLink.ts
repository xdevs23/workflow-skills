import type { Goal } from '../../types'
import { compareEntries, isEntryAtOrUnder } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'

export enum IdeaLinkKind {
  Entry = 'entry',
  Goal = 'goal',
  Project = 'project',
}

const PANE_RANKS: Record<IdeaLinkKind, number> = {
  [IdeaLinkKind.Entry]: 0,
  [IdeaLinkKind.Goal]: 1,
  [IdeaLinkKind.Project]: 2,
}

export type IdeaGoal = Pick<Goal, 'id' | 'number' | 'text'>

export type EntryLink = { kind: IdeaLinkKind.Entry; entry: EntryNumber }

export type GoalLink = { kind: IdeaLinkKind.Goal; goal: IdeaGoal }

export type FormerEntryLink = EntryLink & { title?: string }

export type FormerLink = FormerEntryLink | GoalLink

export type ProjectLink = { kind: IdeaLinkKind.Project; wasFor: FormerLink }

export type IdeaLink = EntryLink | GoalLink | ProjectLink

export type EntryOrGoalLink = EntryLink | GoalLink

export type IdeasScope = { link: EntryOrGoalLink; goalIds: ReadonlySet<string> }

export function goalLinkOf(goal: Goal): GoalLink {
  const { id, number, text } = goal

  return { kind: IdeaLinkKind.Goal, goal: { id, number, text } }
}

export function isProjectLink(link: IdeaLink): link is ProjectLink {
  return link.kind === IdeaLinkKind.Project
}

export function entryLinkAtOrUnder(link: IdeaLink, top: EntryNumber): EntryLink | undefined {
  return link.kind === IdeaLinkKind.Entry && isEntryAtOrUnder(link.entry, top) ? link : undefined
}

export function isReadWith(link: IdeaLink, scope: IdeasScope): boolean {
  const { link: target, goalIds } = scope
  switch (link.kind) {
    case IdeaLinkKind.Entry:
      return target.kind === IdeaLinkKind.Entry && isEntryAtOrUnder(target.entry, link.entry)
    case IdeaLinkKind.Goal:
      return goalIds.has(link.goal.id)
    case IdeaLinkKind.Project:
      return true
  }
}

export function compareLinks(one: IdeaLink, other: IdeaLink): number {
  if (one.kind === IdeaLinkKind.Entry && other.kind === IdeaLinkKind.Entry) {
    return compareEntries(one.entry, other.entry)
  }
  if (one.kind === IdeaLinkKind.Goal && other.kind === IdeaLinkKind.Goal) {
    return one.goal.number - other.goal.number
  }

  return PANE_RANKS[one.kind] - PANE_RANKS[other.kind]
}
