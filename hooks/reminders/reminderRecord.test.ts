import { describe, expect } from 'claude-code/testing'

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
