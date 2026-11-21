import type { HookSubject } from '../hookFailure'
import { describeUnreadableRecord } from '../pluginStore'
import type { EntryNumber } from '../todoEntry'
import { DELETE_IDEAS_TOOL, GET_IDEAS_TOOL, RECORD_IDEA_TOOL } from './ideaNames'
import type { Idea, ReadIdeas } from './ideaStore'

export const RECORD_IDEA_DESCRIPTION = [
  'Records words of the user for an entry in TODO.md in this project, so they outlast',
  'compactions and restarts. Record on your own, and only the words of the user that contribute',
  'to the design for the entry.',
  'Write the user words verbatim without paraphrasing.',
  `${GET_IDEAS_TOOL} lists them.`,
].join(' ')

export const GET_IDEAS_DESCRIPTION = [
  `Lists the words of the user recorded with ${RECORD_IDEA_TOOL} in this project for the entry`,
  'and for every entry above it, such as #161 and #161.5 for #161.5.2, oldest first, each with',
  'its entry and date.',
].join(' ')

export const DELETE_IDEAS_DESCRIPTION = [
  `Deletes the words of the user recorded with ${RECORD_IDEA_TOOL} in this project for the entry`,
  'and for every entry under it, such as #161.5.2 for #161.5. Call it once the entry is finished,',
  'when you delete the entry from TODO.md.',
].join(' ')

/** The recorded words of the user, as written in the texts about a failed hook of an idea tool. */
export const IDEAS_SUBJECT: HookSubject = {
  name: 'recorded words of the user',
  checkBeforeRetry:
    `List the words of the user for the entry with ${GET_IDEAS_TOOL} before you try again.`,
}

const RECORDED_ON = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

export function describeRecorded(entry: EntryNumber): string {
  return `${RECORD_IDEA_TOOL} stored the words for ${entry}.`
}

/** The ideas recorded for `entry` and every entry above it, as the model reads them. */
export function describeIdeas(entry: EntryNumber, read: ReadIdeas): string {
  const ideaLines =
    read.ideas.length === 0
      ? [
          `${RECORD_IDEA_TOOL} has not stored words of the user for ${entry} or for an entry ` +
            'above it.',
        ]
      : read.ideas.map(describeIdea)

  return [...ideaLines, ...read.unreadableKeys.map(describeUnreadableRecord)].join('\n\n')
}

/** The ideas deleted for `entry` and every entry under it, as the model reads them. */
export function describeDeleted(entry: EntryNumber, deleted: ReadIdeas): string {
  const count = deleted.ideas.length
  const outcome =
    count === 0
      ? `${DELETE_IDEAS_TOOL} did not find words of the user recorded for ${entry} or for an ` +
        `entry under it in this project. Check that ${entry} is the number of the entry you meant.`
      : `${DELETE_IDEAS_TOOL} deleted ${count} ${count === 1 ? 'idea' : 'ideas'} recorded for ` +
        `${entry} and for the entries under it.`

  return [outcome, ...deleted.unreadableKeys.map(describeUnreadableRecord)].join('\n\n')
}

function describeIdea(idea: Idea): string {
  return `${labelIdea(idea)}: ${idea.words}`
}

/**
 * The entry that `idea` is for, and the date it was recorded on, such as "#161.5 (Nov 21, 2026)".
 */
export function labelIdea(idea: Idea): string {
  return `${idea.entry} (${RECORDED_ON.format(idea.recordedAt)})`
}
