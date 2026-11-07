import { describe, expect, test } from 'claude-code/testing'

import { FIRST_SESSION, NO_TIME_LIMIT, startSession } from '../testSupport'
import { priorityRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import {
  FULL_STORE,
  ROTATION_CRASH,
  goalRecordsOf,
  mountGoalsPane,
  storedBoard,
} from './goalPaneTestSupport'

const SCOPE = sessionScope(FIRST_SESSION)

/** The keys of the priority pickers of the pane, in the order the pane draws them. */
async function pickerKeysOf(
  pane: Awaited<ReturnType<typeof mountGoalsPane<'terminal'>>>,
): Promise<string[]> {
  const pickers = await pane.findAll({ type: 'Select' })

  return pickers.map(picker => picker.key ?? '').filter(key => key.startsWith('priority-'))
}

describe('the priority of a goal in the Goals pane', () => {
  test(
    'every open goal has a priority picker from none through P0 to P9, on none without a priority',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const picker = await pane.find({ key: 'priority-1' })

      expect(picker?.props.value).toBe('none')
      expect(picker?.props.options).toMatchObject(
        ['none', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(value => ({ value })),
      )
      expect(await pickerKeysOf(pane)).toEqual(['priority-1', 'priority-2'])
    },
  )

  test(
    'a picked priority is stored, and the goal moves before the goals without one',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.select({ key: 'priority-2', value: '1' })

      const record = priorityRecordOf(SCOPE, {
        ...ROTATION_CRASH,
        prioritySetting: { value: 1, setAt: 1000 },
      })
      expect(goalRecordsOf(session)).toEqual(storedBoard().set(record.key, record.value))
      expect(await pickerKeysOf(pane)).toEqual(['priority-2', 'priority-1'])
      expect((await pane.find({ key: 'priority-2' }))?.props.value).toBe('1')
    },
  )

  test(
    'picking none removes the priority with a record of its own, and the goal moves back',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.select({ key: 'priority-2', value: '0' })
      await pane.select({ key: 'priority-2', value: 'none' })

      const removal = priorityRecordOf(SCOPE, {
        ...ROTATION_CRASH,
        prioritySetting: { setAt: 1000 },
      })
      expect(goalRecordsOf(session)).toEqual(storedBoard().set(removal.key, removal.value))
      expect(await pickerKeysOf(pane)).toEqual(['priority-1', 'priority-2'])
    },
  )

  test('a pick the store does not save shows the failure in a toast', NO_TIME_LIMIT, async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    session.refusedWrites.push(FULL_STORE)
    await pane.select({ key: 'priority-2', value: '0' })

    expect(session.toasts).toHaveLength(1)
    expect(session.toasts[0]).toContain(FULL_STORE)
    expect(goalRecordsOf(session)).toEqual(storedBoard())
  })
})
