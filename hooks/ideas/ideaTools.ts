import type { EngineInterface, MatchedHook, ToolCallResult, ToolSpec } from 'claude-code'

import { denyFailedUse } from '../hookFailure'
import { describeProjectFailure, returningProjectFailure } from '../projectFolder'
import { isEntryAtOrUnder } from '../todoEntry'
import { loadIdeasOfProjectIntoState } from './ideaActions'
import {
  ENTRY_PROBLEM,
  ENTRY_SCHEMA,
  RECORD_IDEA_SCHEMA,
  WORDS_PROBLEMS,
  WordsOutcome,
  readEntryInput,
  readWordsInput,
} from './ideaInputs'
import {
  DELETE_IDEAS,
  DELETE_IDEAS_TOOL,
  GET_IDEAS,
  GET_IDEAS_TOOL,
  RECORD_IDEA,
  RECORD_IDEA_TOOL,
} from './ideaNames'
import { deleteIdeasUnder, readIdeasOf, saveIdea } from './ideaStore'
import {
  DELETE_IDEAS_DESCRIPTION,
  GET_IDEAS_DESCRIPTION,
  IDEAS_SUBJECT,
  RECORD_IDEA_DESCRIPTION,
  describeDeleted,
  describeIdeas,
  describeRecorded,
} from './ideaTexts'

/** The tools by which the model records, lists and deletes words of the user for an entry. */
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
    inputSchema: ENTRY_SCHEMA,
    isDeferred: false,
  },
  {
    name: DELETE_IDEAS,
    description: DELETE_IDEAS_DESCRIPTION,
    inputSchema: ENTRY_SCHEMA,
    isDeferred: false,
  },
]

export const recordIdea: MatchedHook<'tool.call', { tool: typeof RECORD_IDEA_TOOL }> = async (
  $,
  e,
) => {
  const entry = readEntryInput(e)
  if (entry === undefined) {
    return { deny: ENTRY_PROBLEM }
  }
  const words = readWordsInput(e)
  if (words.outcome !== WordsOutcome.Valid) {
    return { deny: WORDS_PROBLEMS[words.outcome] }
  }
  // The session id and the clock are read while git looks up the project. The outer Promise.all
  // awaits them also when a failed lookup skips the work.
  const sessionAndTime = Promise.all([$.session.id(), $.clock.now()])
  const [, recorded] = await Promise.all([
    sessionAndTime,
    denyingIdeasFailure($, async project => {
      const [sessionId, recordedAt] = await sessionAndTime
      await saveIdea($, { sessionId, project, idea: { entry, words: words.text, recordedAt } })
      await loadIdeasOfProjectIntoState($, project)

      return { result: describeRecorded(entry) }
    }),
  ])

  return recorded
}

export const getIdeas: MatchedHook<'tool.call', { tool: typeof GET_IDEAS_TOOL }> = async (
  $,
  e,
) => {
  const entry = readEntryInput(e)
  if (entry === undefined) {
    return { deny: ENTRY_PROBLEM }
  }

  return denyingIdeasFailure($, async project => {
    const read = await readIdeasOf($, {
      project,
      includesEntry: recorded => isEntryAtOrUnder(entry, recorded),
    })

    return { result: describeIdeas(entry, read) }
  })
}

export const deleteIdeasOfEntry: MatchedHook<
  'tool.call',
  { tool: typeof DELETE_IDEAS_TOOL }
> = async ($, e) => {
  const entry = readEntryInput(e)
  if (entry === undefined) {
    return { deny: ENTRY_PROBLEM }
  }

  return denyingIdeasFailure($, async project => {
    const deleted = await deleteIdeasUnder($, { project, entries: [entry] })
    await loadIdeasOfProjectIntoState($, project)

    return { result: describeDeleted(entry, deleted) }
  })
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
