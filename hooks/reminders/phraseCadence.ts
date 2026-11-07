import type { MatchedHook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { LETTER_OR_DIGIT, withoutQuotedText } from '../quotedText'
import { stopWithNote } from '../sendToModel'
import { CadenceProblem, FieldKind, listKind } from './cadenceKind'
import type { CadenceKind, ListedKind } from './cadenceKind'
import { describeReminderNote, readEnabledReminders } from './reminderDelivery'

// The cadence "when Claude says": a reminder is sent when the main conversation ends its turn on a
// message that contains one of the phrases of the reminder. A phrase inside quoted text does not
// count, since the message only mentions it there.

/** The settings of a reminder sent when Claude says a phrase: one pattern for each phrase. */
type PhraseSettings = { phrases: readonly RegExp[] }

const PHRASES_FIELD = 'phrases'

const PHRASES_PROBLEM = new CadenceProblem(
  'Type each phrase in double quotes, with a comma between two phrases, such as ' +
    '"finished testing", "tests pass".',
)

/** Keeps a phrase from matching inside a longer word, such as "pass" inside "password". */
const NO_LETTER_BEFORE = `(?<!${LETTER_OR_DIGIT})`
const NO_LETTER_AFTER = `(?!${LETTER_OR_DIGIT})`
const SPACE_BETWEEN_WORDS = String.raw`\s+`
/** The characters with a meaning of their own in a pattern, written with a backslash to match. */
const PATTERN_SYNTAX = /[\\^$.*+?()[\]{}|/]/gu

export const PHRASE_KIND: CadenceKind<PhraseSettings, typeof PHRASES_FIELD> = {
  id: 'when-claude-says',
  label: 'when Claude says',
  fields: [
    {
      kind: FieldKind.Text,
      key: PHRASES_FIELD,
      label: 'Phrases',
      placeholder: '"tests pass", …',
    },
  ],
  read: valueOf => readPhrases(valueOf(PHRASES_FIELD)),
}

/** The kind "when Claude says" as the core lists it in the kind dropdown. */
export const PHRASE_CADENCE: ListedKind = listKind(PHRASE_KIND, registerPhraseCadence)

/** Registers the hook that sends the reminders of the kind "when Claude says". */
export function registerPhraseCadence(on: On): void {
  on('classic.Stop', EVERY_EVENT, sendRemindersOnPhrase)
}

/**
 * Blocks the end of a turn of the main conversation on a message that contains a phrase of a
 * reminder switched on, outside quoted text, with the note on those reminders as the reason, as
 * stopWithNote does. The end that follows the block passes, so a reply that says the phrase again
 * does not send the reminder again.
 */
const sendRemindersOnPhrase: MatchedHook<'classic.Stop', EveryEvent> = ($, e, next) =>
  stopWithNote(e, next, async message => {
    const said = withoutQuotedText(message)
    const due = (await readEnabledReminders($, PHRASE_KIND)).filter(({ settings }) =>
      settings.phrases.some(phrase => phrase.test(said)),
    )
    const note = describeReminderNote(due)
    if (note === undefined) {
      return undefined
    }
    $.ui.log(note.line)

    return note.text
  })

/**
 * Reads the phrases typed into the card as `typed`: strings in double quotes as JSON writes them,
 * with a comma between two. At least one phrase, and no blank phrase.
 */
function readPhrases(typed: string): PhraseSettings | CadenceProblem {
  let listed: unknown
  try {
    listed = JSON.parse(`[${typed}]`)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return PHRASES_PROBLEM
    }
    throw error
  }
  if (!Array.isArray(listed) || listed.length === 0) {
    return PHRASES_PROBLEM
  }
  const phrases = listed.filter(isPhrase)

  return phrases.length === listed.length
    ? { phrases: phrases.map(patternOfPhrase) }
    : PHRASES_PROBLEM
}

function isPhrase(listed: unknown): listed is string {
  return typeof listed === 'string' && listed.trim() !== ''
}

/** Matches `phrase` as whole words in any case, with any white space between its words. */
function patternOfPhrase(phrase: string): RegExp {
  const words = phrase
    .trim()
    .split(/\s+/u)
    .map(word => word.replace(PATTERN_SYNTAX, String.raw`\$&`))

  return new RegExp(
    `${NO_LETTER_BEFORE}${words.join(SPACE_BETWEEN_WORDS)}${NO_LETTER_AFTER}`,
    'iu',
  )
}
