import { describe, expect } from 'claude-code/testing'

import type { StoredEntry } from '../pluginStore'
import { test } from '../testDeclaration'
import { readReminders, reminderRecordOf } from './reminderRecord'

const SESSION = 'session-1'
const CADENCE = { kind: 'after-compaction', values: {} }

describe('the numbers of stored reminders', () => {
  test('a reminder stored with a number already taken reads as the next number', () => {
    const entries = [
      { id: 'a', number: 1 },
      { id: 'b', number: 2 },
      { id: 'c', number: 2 },
      { id: 'd', number: 4 },
    ].map(({ id, number }) =>
      reminderRecordOf(SESSION, { id, number, text: id, addedAt: 0, cadence: CADENCE }))

    const { reminders } = readReminders(SESSION, entries)

    expect(reminders.map(({ id, number }) => [id, number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
      ['d', 4],
    ])
  })
})

describe('the cadence values of stored reminders', () => {
  /** The stored record of a reminder whose cadence has `phrases` as the value of its field. */
  function entryWithPhrases(phrases: readonly unknown[]): StoredEntry {
    const { key, value } = reminderRecordOf(SESSION, {
      id: 'a',
      number: 1,
      text: 'a',
      addedAt: 0,
      cadence: CADENCE,
    })

    return { key, value: { ...value, cadence: { kind: 'when-claude-says', values: { phrases } } } }
  }

  for (const phrases of [['a', 'b'], []]) {
    test(`a list of texts ${JSON.stringify(phrases)} reads back as stored`, () => {
      const { reminders, unreadableKeys } = readReminders(SESSION, [entryWithPhrases(phrases)])

      expect(reminders.map(({ cadence }) => cadence.values)).toEqual([{ phrases }])
      expect(unreadableKeys).toEqual([])
    })
  }

  test('a list holding something other than a text makes the record unreadable', () => {
    const entry = entryWithPhrases(['a', 3])

    expect(readReminders(SESSION, [entry])).toEqual({ reminders: [], unreadableKeys: [entry.key] })
  })
})
