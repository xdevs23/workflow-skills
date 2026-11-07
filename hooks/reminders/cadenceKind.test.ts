import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { Reminder } from '../../types'
import {
  CadenceProblem,
  FieldKind,
  addItem,
  defaultCadenceOf,
  listKind,
  readSettings,
  removeItem,
} from './cadenceKind'
import type { CadenceKind, CadenceKinds, ListCardField } from './cadenceKind'
import { describeReminderNote, enabledRemindersOf } from './reminderDelivery'
import { Outcome, Refusal, checkDraft } from './reminders'
import { MISSHAPEN_VALUES } from './reminderTexts'

/** The settings of the test kind: a word the user says, and how the word is matched. */
type WordSettings = { word: string; match: string }

const WORD_PROBLEM = 'Type the word.'

/** A cadence kind of the tests alone, with a labeled text field and a dropdown without a label. */
const WORD_KIND: CadenceKind<WordSettings, 'word' | 'match'> = {
  id: 'when-the-user-says',
  label: 'when the user says',
  fields: [
    { kind: FieldKind.Text, key: 'word', label: () => 'Word', placeholder: 'deploy' },
    {
      kind: FieldKind.Choice,
      key: 'match',
      options: () => [
        { value: 'whole', label: 'as a word' },
        { value: 'part', label: 'within a word' },
      ],
    },
  ],
  read: valueOf => {
    const word = valueOf('word').trim()

    return word === '' ? new CadenceProblem(WORD_PROBLEM) : { word, match: valueOf('match') }
  },
}

const NO_WORDS_PROBLEM = 'Add a word.'

const WORDS_FIELD: ListCardField<'words'> = { kind: FieldKind.List, key: 'words', label: 'Words' }

/** A cadence kind of the tests alone, with a list field. */
const WORDS_KIND: CadenceKind<readonly string[], 'words'> = {
  id: 'when-the-user-says-any',
  label: 'when the user says any of',
  fields: [WORDS_FIELD],
  read: (_valueOf, itemsOf) =>
    itemsOf('words').length === 0 ? new CadenceProblem(NO_WORDS_PROBLEM) : itemsOf('words'),
}

const UNREADABLE_WORDS_PROBLEM = 'Add the words again.'

/**
 * WORDS_KIND as a version that stores the words as a text with `|` between two upgrades it, a text
 * without `|` being one it cannot read.
 */
const WORDS_KIND_STORED_AS_TEXT: CadenceKind<readonly string[], 'words'> = {
  ...WORDS_KIND,
  upgradeStored: values => {
    const { words } = values
    if (typeof words !== 'string') {
      return values
    }

    return words.includes('|')
      ? { words: words.split('|') }
      : new CadenceProblem(UNREADABLE_WORDS_PROBLEM)
  },
}

/** The registration of a kind that registers no hooks, for the tests of its card alone. */
function registerNothing(): void {}

function reminderOf(number: number, changes: Partial<Reminder>): Reminder {
  return {
    id: `reminder-${number}`,
    number,
    text: `Text of reminder ${number}.`,
    addedAt: number * 100,
    cadence: { kind: WORD_KIND.id, values: { word: 'deploy', match: 'part' } },
    isEnabled: true,
    ...changes,
  }
}

describe('a cadence kind plugged into the core', () => {
  test('the listed kind reads the stored values through the kind', () => {
    const listed = listKind(WORD_KIND, registerNothing)

    expect(listed.problemOf({ word: '  ' })).toEqual(new CadenceProblem(WORD_PROBLEM))
    expect(listed.problemOf({ word: 'deploy' })).toBeUndefined()
    expect(listed.fields).toBe(WORD_KIND.fields)
  })

  test('a field without a stored value reads as an empty text or the first option', () => {
    expect(readSettings(WORD_KIND, { word: 'deploy' })).toEqual({ word: 'deploy', match: 'whole' })
    expect(defaultCadenceOf(listKind(WORD_KIND, registerNothing))).toEqual({
      kind: WORD_KIND.id,
      values: { word: '', match: 'whole' },
    })
  })

  test('the cadence line is the label, then each value, a dropdown by its option label', () => {
    const line = listKind(WORD_KIND, registerNothing).describe({ word: ' deploy ', match: 'part' })

    expect(line).toBe('when the user says deploy within a word')
  })

  test('a kind that writes its own cadence line gets it on the values it reads alone', () => {
    const describe = ({ word }: WordSettings) => `when the user says "${word}"`
    const listed = listKind({ ...WORD_KIND, describe }, registerNothing)

    expect(listed.describe({ word: ' deploy ' })).toBe('when the user says "deploy"')
    expect(listed.describe({ word: ' ' })).toBe('when the user says as a word')
  })

  test('a card is saved with a text and values the kind reads, and refused otherwise', () => {
    const kinds: CadenceKinds = [listKind(WORD_KIND, registerNothing)]
    const cadence = { kind: WORD_KIND.id, values: { word: 'deploy', match: 'whole' } }

    expect(checkDraft({ text: ' Run the smoke tests. ', cadence, nextItems: {} }, kinds)).toEqual({
      outcome: Outcome.Checked,
      text: 'Run the smoke tests.',
      cadence,
    })
    expect(checkDraft({ text: ' ', cadence, nextItems: {} }, kinds)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankText,
    })
    const blankWord = { kind: WORD_KIND.id, values: { word: '' } }
    expect(checkDraft({ text: 'Run it.', cadence: blankWord, nextItems: {} }, kinds)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.CadenceProblem,
      problem: WORD_PROBLEM,
    })
    const otherKind = { kind: 'every', values: {} }
    expect(checkDraft({ text: 'Run it.', cadence: otherKind, nextItems: {} }, kinds)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.UnknownCadence,
    })
  })

  test(
    'the kind gets its reminders switched on, by number, with their settings read',
    () => {
      const reminders = [
        reminderOf(4, {}),
        reminderOf(1, { cadence: { kind: WORD_KIND.id, values: { word: 'ship' } } }),
        reminderOf(2, { isEnabled: false }),
        reminderOf(3, { removedAt: 500 }),
        reminderOf(5, { cadence: { kind: 'every', values: { amount: '2' } } }),
        reminderOf(6, { cadence: { kind: WORD_KIND.id, values: { word: '' } } }),
      ]

      expect(enabledRemindersOf(WORD_KIND, reminders)).toEqual([
        {
          id: 'reminder-1',
          number: 1,
          text: 'Text of reminder 1.',
          addedAt: 100,
          settings: { word: 'ship', match: 'whole' },
        },
        {
          id: 'reminder-4',
          number: 4,
          text: 'Text of reminder 4.',
          addedAt: 400,
          settings: { word: 'deploy', match: 'part' },
        },
      ])
    },
  )

  test('a list field reads its stored items, and none without', () => {
    expect(readSettings(WORDS_KIND, { words: ['ship', 'deploy'] })).toEqual(['ship', 'deploy'])
    expect(readSettings(WORDS_KIND, {})).toEqual(new CadenceProblem(NO_WORDS_PROBLEM))
    expect(defaultCadenceOf(listKind(WORDS_KIND, registerNothing)).values).toEqual({ words: [] })
  })

  test('a value not of the shape of its field is a problem, and the cadence line the label', () => {
    const misshapen = new CadenceProblem(MISSHAPEN_VALUES)

    expect(readSettings(WORDS_KIND, { words: 'ship' })).toEqual(misshapen)
    expect(readSettings(WORD_KIND, { word: ['deploy'] })).toEqual(misshapen)
    expect(listKind(WORD_KIND, registerNothing).describe({ word: ['deploy'] })).toBe(WORD_KIND.label)
  })

  test('the values stored by an earlier version are read and drawn as the kind upgrades them', () => {
    const listed = listKind(WORDS_KIND_STORED_AS_TEXT, registerNothing)

    expect(readSettings(WORDS_KIND_STORED_AS_TEXT, { words: 'ship|deploy' })).toEqual([
      'ship',
      'deploy',
    ])
    expect(listed.readValues({ words: 'ship|deploy' })).toEqual({ words: ['ship', 'deploy'] })
    expect(listed.problemOf({ words: 'ship' })).toEqual(
      new CadenceProblem(UNREADABLE_WORDS_PROBLEM),
    )
    expect(listed.describe({ words: 'ship' })).toBe(WORDS_KIND.label)
  })

  test('an item is added without the white space around it, and a blank one is not', () => {
    const added = addItem(WORDS_FIELD, { words: ['ship'] }, ' deploy ')

    expect(added).toEqual({ words: ['ship', 'deploy'] })
    expect(addItem(WORDS_FIELD, added, '  ')).toBe(added)
    expect(removeItem(WORDS_FIELD, added, { index: 0, item: 'ship' })).toEqual({
      words: ['deploy'],
    })
    expect(removeItem(WORDS_FIELD, added, { index: 0, item: 'deploy' })).toBe(added)
  })

  test('the cadence line writes the items of a list in double quotes', () => {
    const line = listKind(WORDS_KIND, registerNothing).describe({ words: ['ship', 'deploy'] })

    expect(line).toBe('when the user says any of "ship", "deploy"')
  })

  test('saving a card adds the text typed for the next item of a list', () => {
    const kinds: CadenceKinds = [listKind(WORDS_KIND, registerNothing)]
    const typed = { kind: WORDS_KIND.id, values: { words: ['ship'] } }

    expect(checkDraft({ text: 'Run it.', cadence: typed, nextItems: { words: ' deploy' } }, kinds))
      .toEqual({
        outcome: Outcome.Checked,
        text: 'Run it.',
        cadence: { kind: WORDS_KIND.id, values: { words: ['ship', 'deploy'] } },
      })
  })

  test('a card is saved without text typed for an item under a key of no list field', () => {
    const kinds: CadenceKinds = [listKind(WORD_KIND, registerNothing)]
    const cadence = { kind: WORD_KIND.id, values: { word: 'deploy', match: 'whole' } }
    const nextItems = { word: 'ship', words: 'ship' }

    expect(checkDraft({ text: 'Run it.', cadence, nextItems }, kinds)).toEqual({
      outcome: Outcome.Checked,
      text: 'Run it.',
      cadence,
    })
  })

  test('the note gives the model the texts of the reminders due, and nothing else', () => {
    const due = enabledRemindersOf(WORD_KIND, [
      reminderOf(3, { text: 'Read the spec again.' }),
      reminderOf(1, { text: 'Start a build.' }),
    ])

    expect(describeReminderNote(due)).toEqual({
      text: 'Reminder from the user: Start a build.\n\nReminder from the user: Read the spec again.',
      line: 'Reminders: reminders 1 and 3 sent to Claude',
    })
    expect(describeReminderNote(due.slice(0, 1))?.line).toBe('Reminders: reminder 1 sent to Claude')
    expect(describeReminderNote([])).toBeUndefined()
  })
})
