import type {
  EngineInterface,
  Frozen,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
} from 'claude-code'

import type { CompactionNoteSource } from '../afterCompaction'
import { submitWithNotesBeside } from '../pendingTexts'
import type { PromptNoteSource, TakenNote } from '../pendingTexts'
import type { NoteSource, TextWithLine } from '../sendToModel'
import { takeEveryGrant, takeUnreadGrants } from './autonomyState'
import { describeAutonomyNote, describeAutonomyNoteNotSent } from './autonomyTexts'

export function autonomyNoteSource(
  $: EngineInterface,
): NoteSource<TextWithLine> & PromptNoteSource {
  return {
    takeNote: async () => (await takeUnreadNote($))?.note,
    takeNoteBesidePrompt: () => takeUnreadNote($),
    describeNotSent: describeAutonomyNoteNotSent,
  }
}

export function autonomyAfterCompaction($: EngineInterface): CompactionNoteSource {
  return {
    takeNote: async () => {
      const taken = await takeEveryGrant($)

      return taken && { text: describeAutonomyNote(taken.grants).text, restore: taken.restore }
    },
    describeNotSent: describeAutonomyNoteNotSent,
  }
}

// Every message to the model needs to know where autonomous implementation applies, also the
// prompt that a headless run starts with, which the user did not type at the prompt.
export function submitWithAutonomyNote(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
): Promise<PromptSubmitResult> {
  return e.command === undefined
    ? submitWithNotesBeside($, e, next, [autonomyNoteSource($)])
    : next(e)
}

async function takeUnreadNote($: EngineInterface): Promise<TakenNote | undefined> {
  const taken = await takeUnreadGrants($)

  return taken && { note: describeAutonomyNote(taken.grants), restore: taken.restore }
}
