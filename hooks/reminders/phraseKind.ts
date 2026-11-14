import type { Cadence } from '../../types'
import { readStrings } from '../pluginStore'
import { NO_LETTER_AFTER, NO_LETTER_BEFORE } from '../quotedText'
import { CadenceProblem, FieldKind, listKind } from './cadenceKind'
import type { CadenceKind, ListedKind } from './cadenceKind'

// The kind "when Claude says", which phraseCadence.ts sends the reminders of. A phrase is matched
// as whole words in any case.

/** The settings of a reminder sent when Claude says a phrase: one pattern for each phrase. */
type PhraseSettings = { phrases: readonly RegExp[] }

const PHRASES_FIELD = 'phrases'

const NO_PHRASE_PROBLEM = new CadenceProblem('Type a phrase and press Enter to add it.')

const BLANK_PHRASE_PROBLEM = new CadenceProblem('Remove the blank phrase.')

const UNREADABLE_PHRASES_PROBLEM = new CadenceProblem(
  'This version of the plugin cannot read the phrases stored for this reminder. Press Edit to ' +
    'add them again.',
)

const SPACE_BETWEEN_WORDS = String.raw`\s+`
/** The characters with a meaning of their own in a pattern, written with a backslash to match. */
const PATTERN_SYNTAX = /[\\^$.*+?()[\]{}|/]/gu

export const PHRASE_KIND: CadenceKind<PhraseSettings, typeof PHRASES_FIELD> = {
  id: 'when-claude-says',
  label: 'when Claude says',
  fields: [
    {
      kind: FieldKind.List,
      key: PHRASES_FIELD,
      label: 'Phrases',
      placeholder: 'A phrase, such as tests pass',
    },
  ],
  read: (_valueOf, itemsOf) => readPhrases(itemsOf(PHRASES_FIELD)),
  upgradeStored: upgradeQuotedPhrases,
}

/** The kind "when Claude says" as the core lists it in the kind dropdown. */
export const PHRASE_CADENCE: ListedKind = listKind(PHRASE_KIND)

/** Reads `phrases`, the items of the card: at least one phrase, and no blank phrase. */
function readPhrases(phrases: readonly string[]): PhraseSettings | CadenceProblem {
  if (phrases.length === 0) {
    return NO_PHRASE_PROBLEM
  }

  return phrases.some(phrase => phrase.trim() === '')
    ? BLANK_PHRASE_PROBLEM
    : { phrases: phrases.map(patternOfPhrase) }
}

/** `values` with the phrases stored as text by an earlier version read into a list. */
function upgradeQuotedPhrases(values: Cadence['values']): Cadence['values'] | CadenceProblem {
  const stored = values[PHRASES_FIELD]
  if (typeof stored !== 'string') {
    return values
  }
  const phrases = phrasesOfQuotedText(stored)

  return phrases instanceof CadenceProblem ? phrases : { ...values, [PHRASES_FIELD]: phrases }
}

/**
 * The phrases read from `typed`, as an earlier version stored them in a text field: strings in
 * double quotes as JSON writes them, with a comma between two.
 */
function phrasesOfQuotedText(typed: string): readonly string[] | CadenceProblem {
  let listed: unknown
  try {
    listed = JSON.parse(`[${typed}]`)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return UNREADABLE_PHRASES_PROBLEM
    }
    throw error
  }
  return readStrings(listed) ?? UNREADABLE_PHRASES_PROBLEM
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
