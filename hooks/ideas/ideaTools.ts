import type { EngineInterface, MatchedHook, ToolCallResult, ToolSpec } from 'claude-code'

import { denyFailedUse } from '../hookFailure'
import { describeFailedStoreCall, returningStoreFailure } from '../pluginStore'
import { isEntryAtOrUnder } from '../todoEntry'
import { loadIdeasIntoState } from './ideaActions'
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
import { readProjectOfIdeas } from './ideaProject'
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
  const [sessionId, project, recordedAt] = await Promise.all([
    $.session.id(),
    readProjectOfIdeas($),
    $.clock.now(),
  ])

  return denyingStoreFailure($, async () => {
    await saveIdea($, { sessionId, project, idea: { entry, words: words.text, recordedAt } })
    await loadIdeasIntoState($, project)

    return { result: describeRecorded(entry) }
  })
}

export const getIdeas: MatchedHook<'tool.call', { tool: typeof GET_IDEAS_TOOL }> = async (
  $,
  e,
) => {
  const entry = readEntryInput(e)
  if (entry === undefined) {
    return { deny: ENTRY_PROBLEM }
  }
  const project = await readProjectOfIdeas($)

  return denyingStoreFailure($, async () => {
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
  const project = await readProjectOfIdeas($)

  return denyingStoreFailure($, async () => {
    const deleted = await deleteIdeasUnder($, { project, entries: [entry] })
    await loadIdeasIntoState($, project)

    return { result: describeDeleted(entry, deleted) }
  })
}

/** Runs `work`, and denies the tool call with the failure of the store that stopped it. */
function denyingStoreFailure(
  $: EngineInterface,
  work: () => Promise<ToolCallResult>,
): Promise<ToolCallResult> {
  return returningStoreFailure(work, failed =>
    denyFailedUse($, IDEAS_SUBJECT, describeFailedStoreCall(failed)),
  )
}
