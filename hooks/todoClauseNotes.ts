import type { Caught, EngineInterface, MatchedHook, On } from 'claude-code'

import { isMainConversation } from './conversation'
import { EVERY_EVENT } from './everyEvent'
import type { EveryEvent } from './everyEvent'
import { NO_LETTER_AFTER, maskQuotedText } from './quotedText'
import { callToolWithNote } from './sendToModel'
import { copyTodo, takeTodoChange } from './todoCopy'
import type { TodoChange } from './todoCopy'

const AND_CLAUSE = new RegExp(`, and${NO_LETTER_AFTER}`, 'u')
const SENTENCES = new Intl.Segmenter('en', { granularity: 'sentence' })

/**
 * Registers the hooks that note each sentence added to TODO.md with a clause after ", and" on the
 * result returned by the tool call that wrote it, whatever tool wrote it. The note is only a hint,
 * so a hook of it that fails lets the event go on without the note.
 */
export function registerTodoClauseNotes(on: On): void {
  on('turn.start', EVERY_EVENT, copyTodoAtTurnStart).catch(goOnWithoutNote)
  on('tool.call', EVERY_EVENT, addAndClauseNoteToToolResult).catch(goOnWithoutNote)
}

// Lines added between turns, such as by the user, go into the copy without a note.
const copyTodoAtTurnStart: MatchedHook<'turn.start', EveryEvent> = async ($, e, next) => {
  if (isMainConversation(e)) {
    await copyTodo($, await $.session.id())
  }

  return next(e)
}

const addAndClauseNoteToToolResult: MatchedHook<'tool.call', EveryEvent> = ($, e, next) =>
  callToolWithNote(e, next, () => takeAndClauseNote($))

async function takeAndClauseNote($: EngineInterface): Promise<string | undefined> {
  const change = await takeTodoChange($, await $.session.id())
  const sentences = change === undefined ? [] : addedSentencesWithAndClause(change)

  return sentences.length === 0 ? undefined : describeAndClauseNote(sentences)
}

/** Writes why a hook of the note failed to the debug log, and lets the event `e` go on. */
function goOnWithoutNote<E, R>($: EngineInterface, e: E, next: ((e: E) => R) & Caught): R {
  const { message, kind } = next.error
  $.ui.log(`The note on clauses after ", and" in TODO.md failed: ${message ?? kind}`, {
    to: 'debug',
  })

  return next(e)
}

/** The sentences with a clause after ", and" in TODO.md that the previous copy did not contain. */
function addedSentencesWithAndClause({ before, after }: TodoChange): string[] {
  const sentencesBefore = new Set(sentencesWithAndClause(before))

  return sentencesWithAndClause(after).filter(sentence => !sentencesBefore.has(sentence))
}

/**
 * The sentences of `text` with a clause after ", and" outside quoted text. The sentences are found
 * in the text with its quoted text masked, so a quotation that contains a full stop is in one
 * sentence, and a fenced block of code that spans several lines is masked as a whole.
 */
function sentencesWithAndClause(text: string): string[] {
  return Array.from(SENTENCES.segment(maskQuotedText(text)))
    .filter(({ segment }) => AND_CLAUSE.test(segment))
    .map(({ segment, index }) => text.slice(index, index + segment.length).trim())
}

function describeAndClauseNote(sentences: readonly string[]): string {
  return [
    'TODO.md got these sentences with a clause after ", and":',
    ...sentences.map(sentence => `> ${sentence}`),
    'Check each clause after ", and" against the words of the user. Delete the clause unless the ' +
      'user said it.',
  ].join('\n')
}
