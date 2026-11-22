import type { EngineInterface } from 'claude-code'

import { describeUnreadableRecord } from '../pluginStore'
import { returningProjectFailure } from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import type { EntryNumber } from '../todoEntry'
import { readIdeasRecordedBy } from './ideaStore'

export type RecordedWords = { readonly entry: EntryNumber; readonly words: string }

export type WordsOfSession =
  | { readonly isKnown: true; readonly words: readonly RecordedWords[] }
  | { readonly isKnown: false; readonly failure: ProjectFailure }

export async function readWordsRecordedInSession($: EngineInterface): Promise<WordsOfSession> {
  const sessionId = await $.session.id()

  return returningProjectFailure(
    $,
    async (project): Promise<WordsOfSession> => {
      const { ideas, unreadableKeys } = await readIdeasRecordedBy($, { project, sessionId })
      for (const key of unreadableKeys) {
        $.ui.log(describeUnreadableRecord(key), { to: 'debug' })
      }

      return { isKnown: true, words: ideas.map(({ entry, words }) => ({ entry, words })) }
    },
    (failure): WordsOfSession => ({ isKnown: false, failure }),
  )
}
