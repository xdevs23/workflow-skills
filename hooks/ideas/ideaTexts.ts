import { nameGoal } from '../goals/goalPaneTexts'
import { describeEntry } from '../goals/todoEntry'
import type { HookSubject } from '../hookFailure'
import { AND_LIST } from '../listFormat'
import { describeUnreadableRecord } from '../storeFailures'
import type { EntryNumber } from '../todoEntry'
import { IdeaLinkKind } from './ideaLink'
import type { EntryOrGoalLink, FormerLink, IdeaLink, ProjectLink } from './ideaLink'
import { GET_IDEAS_TOOL, RECORD_IDEA_TOOL, UNLINK_IDEAS_TOOL } from './ideaNames'
import type { Idea, ReadIdeas, RelinkedIdeas } from './ideaStore'

/** How recorded words mark the place of an image or a file attached by the user. */
export const ATTACHMENT_NOTATION = '[attachment: …]'

export const RECORD_IDEA_DESCRIPTION = [
  'Records words of the user for an entry in TODO.md or for an open goal, given by its number, in',
  'this project, so they outlast compactions and restarts. Give the entry or the goal, not both.',
  'Record on your own, and only the words of the user that contribute to the design for the entry',
  'or the goal.',
  'Write the user words verbatim without paraphrasing.',
  `Write an image or a file attached by the user as ${ATTACHMENT_NOTATION} at its place in the`,
  'message, since the words contain text only: what the image shows, or the path of the file.',
  'Never write in it what the user asks or decides.',
  `${GET_IDEAS_TOOL} lists them.`,
].join(' ')

export const GET_IDEAS_DESCRIPTION = [
  `Lists the words of the user recorded with ${RECORD_IDEA_TOOL} in this project for the entry`,
  'and for every entry above it, such as #161 and #161.5 for #161.5.2, and for the open goals',
  'those entries are attached to, or for the open goal, and every project idea: words unlinked',
  'from a finished entry or a cleared goal, which count for the whole project. Give the entry or',
  'the goal, not both. Lists oldest first, each with its entry, goal or what the project idea was',
  'for, and its date.',
].join(' ')

export const UNLINK_IDEAS_DESCRIPTION = [
  `Unlinks the words of the user recorded with ${RECORD_IDEA_TOOL} in this project for the entry`,
  'and for every entry under it, such as #161.5.2 for #161.5. They stay as project ideas, each',
  `with the entry it was for, and ${GET_IDEAS_TOOL} lists them with every entry and goal. Call it`,
  'once the entry is finished, before you delete the entry from TODO.md, so each idea keeps the',
  'title of its entry.',
].join(' ')

/** The recorded words of the user, as written in the texts about a failed hook of an idea tool. */
export const IDEAS_SUBJECT: HookSubject = {
  name: 'recorded words of the user',
  checkBeforeRetry:
    `List the words of the user for the entry or the goal with ${GET_IDEAS_TOOL} before you try ` +
    'again.',
}

const RECORDED_ON = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function describeRecorded(link: EntryOrGoalLink): string {
  return `${RECORD_IDEA_TOOL} stored the words for ${describeIdeaLink(link)}.`
}

export function describeIdeas(target: EntryOrGoalLink, read: ReadIdeas): string {
  const ideaLines =
    read.ideas.length === 0
      ? [
          `${RECORD_IDEA_TOOL} has not stored words of the user that ${GET_IDEAS_TOOL} lists for ` +
            `${describeIdeaLink(target)}.`,
        ]
      : read.ideas.map(describeIdea)

  return [...ideaLines, ...read.unreadableKeys.map(describeUnreadableRecord)].join('\n\n')
}

export function describeUnlinked(entry: EntryNumber, unlinked: RelinkedIdeas<ProjectLink>): string {
  const count = unlinked.links.length
  const outcome =
    count === 0
      ? `${UNLINK_IDEAS_TOOL} did not find words of the user recorded for ${entry} or for an ` +
        `entry under it in this project. Check that ${entry} is the number of the entry you meant.`
      : `${UNLINK_IDEAS_TOOL} unlinked ${count} ${count === 1 ? 'idea' : 'ideas'} recorded for ` +
        `${entry} and for the entries under it. They stay as project ideas.`
  const untitled = [...new Set(unlinked.links.flatMap(link => untitledEntryOf(link.wasFor)))]
  const untitledLines =
    untitled.length === 0
      ? []
      : [
          `TODO.md does not list ${AND_LIST.format(untitled)}, so the project ideas unlinked ` +
            'from them name only the number of their entry.',
        ]

  const unreadableLines = unlinked.unreadableKeys.map(describeUnreadableRecord)

  return [outcome, ...untitledLines, ...unreadableLines].join('\n\n')
}

export function describeIdeaLink(link: IdeaLink): string {
  switch (link.kind) {
    case IdeaLinkKind.Entry:
      return link.entry
    case IdeaLinkKind.Goal:
      return `${nameGoal(link.goal.number)} - ${link.goal.text}`
    case IdeaLinkKind.Project:
      return `Project, was for ${describeFormerLink(link.wasFor)}`
  }
}

function describeFormerLink(wasFor: FormerLink): string {
  if (wasFor.kind === IdeaLinkKind.Goal || wasFor.title === undefined) {
    return describeIdeaLink(wasFor)
  }

  return describeEntry({ number: wasFor.entry, title: wasFor.title })
}

function untitledEntryOf(wasFor: FormerLink): EntryNumber[] {
  return wasFor.kind === IdeaLinkKind.Entry && wasFor.title === undefined ? [wasFor.entry] : []
}

function describeIdea(idea: Idea): string {
  return `${labelIdea(idea)}: ${idea.words}`
}

/** What `idea` is linked to, and the date it was recorded on, such as "#161.5 (Nov 21, 2026)". */
export function labelIdea(idea: Idea): string {
  return `${describeIdeaLink(idea.link)} (${RECORDED_ON.format(idea.recordedAt)})`
}
