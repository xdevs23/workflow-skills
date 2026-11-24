import type { EngineInterface, MatchedHook, ToolCallResult, ToolSpec } from 'claude-code'

import { Outcome, openGoalNumbered, openGoalsOf } from '../goals/board'
import { readBoardOfSession } from '../goals/goalActions'
import { describeGoalNotOpen } from '../goals/goalToolTexts'
import type { TodoEntry } from '../goals/todoEntry'
import { denyFailedUse } from '../hookFailure'
import type { ToolArguments } from '../inputs'
import { describeProjectFailure, returningProjectFailure } from '../projectFolder'
import { isEntryAtOrUnder } from '../todoEntry'
import type { EntryNumber } from '../todoEntry'
import { readEntriesInTodoFile } from '../todoFile'
import { loadIdeasOfProjectIntoState } from './ideaActions'
import {
  ENTRY_OR_GOAL_PROBLEM,
  ENTRY_OR_GOAL_SCHEMA,
  ENTRY_PROBLEM,
  ENTRY_SCHEMA,
  RECORD_IDEA_SCHEMA,
  WORDS_PROBLEMS,
  WordsOutcome,
  readEntryInput,
  readEntryOrGoalInput,
  readWordsInput,
} from './ideaInputs'
import { IdeaLinkKind, entryLinkAtOrUnder, goalLinkOf, isReadWith } from './ideaLink'
import type { EntryOrGoalLink, IdeaLink, IdeasScope, ProjectLink } from './ideaLink'
import {
  GET_IDEAS,
  GET_IDEAS_TOOL,
  RECORD_IDEA,
  RECORD_IDEA_TOOL,
  UNLINK_IDEAS,
  UNLINK_IDEAS_TOOL,
} from './ideaNames'
import { readIdeasOf, relinkIdeasOf, saveIdea } from './ideaStore'
import {
  GET_IDEAS_DESCRIPTION,
  IDEAS_SUBJECT,
  RECORD_IDEA_DESCRIPTION,
  UNLINK_IDEAS_DESCRIPTION,
  describeIdeas,
  describeRecorded,
  describeUnlinked,
} from './ideaTexts'

export const IDEA_TOOL_SPECS: readonly ToolSpec[] = [
  {
    name: RECORD_IDEA,
    description: RECORD_IDEA_DESCRIPTION,
    inputSchema: RECORD_IDEA_SCHEMA,
    isDeferred: false,
  },
  {
    name: GET_IDEAS,
    description: GET_IDEAS_DESCRIPTION,
    inputSchema: ENTRY_OR_GOAL_SCHEMA,
    isDeferred: false,
  },
  {
    name: UNLINK_IDEAS,
    description: UNLINK_IDEAS_DESCRIPTION,
    inputSchema: ENTRY_SCHEMA,
    isDeferred: false,
  },
]

type LinkInput = { isRead: true; link: EntryOrGoalLink } | { isRead: false; denial: ToolCallResult }

type ScopeInput = { isRead: true; scope: IdeasScope } | { isRead: false; denial: ToolCallResult }

export const recordIdea: MatchedHook<'tool.call', { tool: typeof RECORD_IDEA_TOOL }> = async (
  $,
  e,
) => {
  const target = await readLinkInput($, e)
  if (!target.isRead) {
    return target.denial
  }
  const words = readWordsInput(e)
  if (words.outcome !== WordsOutcome.Valid) {
    return { deny: WORDS_PROBLEMS[words.outcome] }
  }
  const { link } = target
  // The session id and the clock are read while git looks up the project. The outer Promise.all
  // awaits them also when a failed lookup skips the work.
  const sessionAndTime = Promise.all([$.session.id(), $.clock.now()])
  const [, recorded] = await Promise.all([
    sessionAndTime,
    denyingIdeasFailure($, async project => {
      const [sessionId, recordedAt] = await sessionAndTime
      await saveIdea($, { sessionId, project, idea: { link, words: words.text, recordedAt } })
      await loadIdeasOfProjectIntoState($, project)

      return { result: describeRecorded(link) }
    }),
  ])

  return recorded
}

export const getIdeas: MatchedHook<'tool.call', { tool: typeof GET_IDEAS_TOOL }> = async (
  $,
  e,
) => {
  const target = await readLinkInput($, e)
  if (!target.isRead) {
    return target.denial
  }
  const read = await readIdeasScope($, target.link)
  if (!read.isRead) {
    return read.denial
  }
  const { scope } = read

  return denyingIdeasFailure($, async project => {
    const ideas = await readIdeasOf($, {
      project,
      includesLink: recorded => isReadWith(recorded, scope),
    })

    return { result: describeIdeas(scope.link, ideas) }
  })
}

export const unlinkIdeasOfEntry: MatchedHook<
  'tool.call',
  { tool: typeof UNLINK_IDEAS_TOOL }
> = async ($, e) => {
  const entry = readEntryInput(e)
  if (entry === undefined) {
    return { deny: ENTRY_PROBLEM }
  }

  return denyingIdeasFailure($, async project => {
    const todos = await readEntriesInTodoFile($, project)
    const unlinked = await relinkIdeasOf($, {
      project,
      relink: link => relinkToProjectFromEntry(link, entry, todos),
    })
    await loadIdeasOfProjectIntoState($, project)

    return { result: describeUnlinked(entry, unlinked) }
  })
}

function relinkToProjectFromEntry(
  link: IdeaLink,
  top: EntryNumber,
  todos: readonly TodoEntry[],
): ProjectLink | undefined {
  const entryLink = entryLinkAtOrUnder(link, top)
  if (entryLink === undefined) {
    return undefined
  }
  const title = todos.find(todo => todo.number === entryLink.entry)?.title

  return {
    kind: IdeaLinkKind.Project,
    wasFor: title === undefined ? entryLink : { ...entryLink, title },
  }
}

async function readLinkInput($: EngineInterface, input: ToolArguments): Promise<LinkInput> {
  const target = readEntryOrGoalInput(input)
  switch (target?.kind) {
    case undefined:
      return { isRead: false, denial: { deny: ENTRY_OR_GOAL_PROBLEM } }
    case IdeaLinkKind.Entry:
      return { isRead: true, link: target }
    case IdeaLinkKind.Goal:
      return readGoalLink($, target.goal)
  }
}

async function readGoalLink($: EngineInterface, number: number): Promise<LinkInput> {
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    return { isRead: false, denial: denyFailedUse($, IDEAS_SUBJECT, read.failure) }
  }
  const goal = openGoalNumbered(read.board, number)

  return goal === undefined
    ? { isRead: false, denial: { deny: describeGoalNotOpen(number) } }
    : { isRead: true, link: goalLinkOf(goal) }
}

async function readIdeasScope($: EngineInterface, link: EntryOrGoalLink): Promise<ScopeInput> {
  if (link.kind === IdeaLinkKind.Goal) {
    return { isRead: true, scope: { link, goalIds: new Set([link.goal.id]) } }
  }
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    return { isRead: false, denial: denyFailedUse($, IDEAS_SUBJECT, read.failure) }
  }
  const goalIds = openGoalsOf(read.board)
    .filter(goal => goal.todos.some(todo => isEntryAtOrUnder(link.entry, todo.number)))
    .map(goal => goal.id)

  return { isRead: true, scope: { link, goalIds: new Set(goalIds) } }
}

/**
 * Looks up the project, runs `work` on it, and denies the tool call with the reason when the lookup
 * or the store stops it.
 */
function denyingIdeasFailure(
  $: EngineInterface,
  work: (project: string) => Promise<ToolCallResult>,
): Promise<ToolCallResult> {
  return returningProjectFailure($, work, failure =>
    denyFailedUse($, IDEAS_SUBJECT, describeProjectFailure(failure)),
  )
}
