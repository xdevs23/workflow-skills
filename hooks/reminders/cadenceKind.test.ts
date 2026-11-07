import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import type { Reminder } from '../../types'
import {
  CadenceProblem,
  FieldKind,
  defaultCadenceOf,
  listKind,
  readSettings,
} from './cadenceKind'
import type { CadenceKind, CadenceKinds } from './cadenceKind'
import { describeReminderNote, enabledRemindersOf } from './reminderDelivery'
import { Outcome, Refusal, checkDraft } from './reminders'

/** The settings of the test kind: a word the user says, and how the word is matched. */
type WordSettings = { word: string; match: string }

const WORD_PROBLEM = 'Type the word.'

/** A cadence kind of the tests alone, with a labeled text field and a dropdown without a label. */
const WORD_KIND: CadenceKind<WordSettings, 'word' | 'match'> = {
  id: 'when-the-user-says',
  label: 'when the user says',
  fields: [
    { kind: FieldKind.Text, key: 'word', label: 'Word', placeholder: 'deploy' },
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

    expect(checkDraft({ text: ' Run the smoke tests. ', cadence }, kinds)).toEqual({
      outcome: Outcome.Checked,
      text: 'Run the smoke tests.',
      cadence,
    })
    expect(checkDraft({ text: ' ', cadence }, kinds)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.BlankText,
    })
    const blankWord = { kind: WORD_KIND.id, values: { word: '' } }
    expect(checkDraft({ text: 'Run it.', cadence: blankWord }, kinds)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.CadenceProblem,
      problem: WORD_PROBLEM,
    })
    const otherKind = { kind: 'every', values: {} }
    expect(checkDraft({ text: 'Run it.', cadence: otherKind }, kinds)).toEqual({
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
