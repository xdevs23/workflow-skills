import type {
  EngineInterface,
  Frozen,
  Next,
  PromptSubmitInput,
  PromptSubmitResult,
} from 'claude-code'

import type { CompactionNoteSource } from './afterCompaction'
import { submitWithNotesBeside } from './pendingTexts'
import type { PromptNoteSource, TakenNote } from './pendingTexts'
import type { NoteSource, TextWithLine } from './sendToModel'
import { updateOfSession } from './sessionBoundState'

/**
 * A setting of the session `sessionId`, such as the agent mode, which goes to the main conversation
 * in a note each time it differs from the value last read by the model, and after every compaction.
 * `readByModel` is null while that value is unknown.
 */
export type SettingOfSession<V> = { readonly sessionId: string; setting: V; readByModel: V | null }

/** A setting taken for a note, and the function that marks it unread once the note was not sent. */
export type TakenSetting<V> = { setting: V; restore: () => Promise<void> }

/** How a feature takes its setting and describes it in a note. */
export type SettingNoteSource<V> = {
  /** Takes the setting while the model has not read it. */
  takeUnread: () => Promise<TakenSetting<V> | undefined>
  /** Takes the setting whatever the model has read, for a conversation just compacted. */
  takeEvery: () => Promise<TakenSetting<V> | undefined>
  describeNote: (setting: V) => TextWithLine
  describeNotSent: (reason: string) => string
}

/** The sources that send a setting with tool results, beside prompts and after compactions. */
export type SettingNotes = {
  noteSource: NoteSource<TextWithLine> & PromptNoteSource
  afterCompaction: CompactionNoteSource
}

/**
 * Marks the setting of the running session as read by the model when `isToSend` holds for it, and
 * returns it. `apply` hands a change to the atom of the feature, as in `updateOfSession`. A note
 * that was not sent leaves the value read by the model unknown, so the setting goes again with the
 * next note.
 */
export async function takeSetting<T extends SettingOfSession<T['setting']>>(
  $: EngineInterface,
  isToSend: (own: T) => boolean,
  apply: (changeInState: (inState: T | null) => T | null) => Promise<T | null>,
): Promise<TakenSetting<T['setting']> | undefined> {
  const sessionId = await $.session.id()
  let taken: TakenSetting<T['setting']> | undefined
  await updateOfSession<T>(
    $,
    sessionId,
    own => {
      // A retried write runs this again, and the last run sets the result.
      taken = undefined
      if (own === null || !isToSend(own)) {
        return own
      }
      taken = {
        setting: own.setting,
        restore: async () => {
          await updateOfSession<T>($, sessionId, now => now && { ...now, readByModel: null }, apply)
        },
      }

      return { ...own, readByModel: own.setting }
    },
    apply,
  )

  return taken
}

export function notesOfSetting<V>(source: SettingNoteSource<V>): SettingNotes {
  const takeUnreadNote = async (): Promise<TakenNote | undefined> => {
    const taken = await source.takeUnread()

    return taken && { note: source.describeNote(taken.setting), restore: taken.restore }
  }

  return {
    noteSource: {
      takeNote: async () => (await takeUnreadNote())?.note,
      takeNoteBesidePrompt: takeUnreadNote,
      describeNotSent: source.describeNotSent,
    },
    afterCompaction: {
      takeNote: async () => {
        const taken = await source.takeEvery()

        return taken && { text: source.describeNote(taken.setting).text, restore: taken.restore }
      },
      describeNotSent: source.describeNotSent,
    },
  }
}

/**
 * Submits the prompt `e` with the notes of `settings` beside it. Every message to the model needs
 * the settings, also the prompt that a headless run starts with, which the user did not type.
 */
export function submitWithSettingNotes(
  $: EngineInterface,
  e: Frozen<PromptSubmitInput>,
  next: Next<'prompt.submit'>,
  settings: readonly SettingNotes[],
): Promise<PromptSubmitResult> {
  return e.command === undefined
    ? submitWithNotesBeside(
        $,
        e,
        next,
        settings.map(notes => notes.noteSource),
      )
    : next(e)
}
