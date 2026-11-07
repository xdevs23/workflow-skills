import { describe, expect, test } from 'claude-code/testing'

import type { Goal } from '../../types'
import { FIRST_SESSION, NO_TIME_LIMIT, startSession } from '../testSupport'
import { clearanceRecordOf, dependencyRecordOf, priorityRecordOf } from './boardRecord'
import { sessionScope } from './boardScope'
import {
  MIGRATION_GUIDE,
  ROTATION_CRASH,
  goalRecordsOf,
  mountGoalsPane,
  storedBoard,
} from './goalPaneTestSupport'

const SCOPE = sessionScope(FIRST_SESSION)

/** The record of `goal` depending on `dependsOn` from `setAt`. */
function dependencyRecord(goal: Goal, dependsOn: Goal, setAt: number) {
  return dependencyRecordOf(SCOPE, {
    ...goal,
    dependencySetting: { value: dependsOn.id, setAt },
  })
}

/** The records of `storedBoard` with goal 1 depending on goal 2. */
function storedBoardWithDependency(): Map<string, unknown> {
  const record = dependencyRecord(MIGRATION_GUIDE, ROTATION_CRASH, 500)

  return storedBoard().set(record.key, record.value)
}

/** The options of a picker with the values `values`, whatever their labels. */
function optionsWith(...values: string[]) {
  return values.map(value => ({ value }))
}

describe('the dependency of a goal in the Goals pane', () => {
  test(
    'every open goal has an After picker beside its priority, from none through the other open ' +
      'goals',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const pickers = await pane.findAll({ type: 'Select' })

      expect(pickers.map(picker => picker.key)).toEqual([
        'priority-1',
        'dependency-1',
        'priority-2',
        'dependency-2',
      ])
      expect((await pane.find({ key: 'dependency-1' }))?.props.value).toBe('none')
      expect((await pane.find({ key: 'dependency-1' }))?.props.options).toMatchObject(
        optionsWith('none', ROTATION_CRASH.id),
      )
    },
  )

  test(
    'a picked goal is stored by its id, and the goal depended on no longer offers a loop',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.select({ key: 'dependency-1', value: ROTATION_CRASH.id })

      const record = dependencyRecord(MIGRATION_GUIDE, ROTATION_CRASH, 1000)
      expect(goalRecordsOf(session)).toEqual(storedBoard().set(record.key, record.value))
      expect((await pane.find({ key: 'dependency-1' }))?.props.value).toBe(ROTATION_CRASH.id)
      expect((await pane.find({ key: 'dependency-2' }))?.props.options).toMatchObject(
        optionsWith('none'),
      )
    },
  )

  test('a dependency on a cleared goal shows as none', NO_TIME_LIMIT, async ($, on) => {
    const clearance = clearanceRecordOf(SCOPE, ROTATION_CRASH, 600)
    await startSession($, on, {
      stored: storedBoardWithDependency().set(clearance.key, clearance.value),
    })
    const pane = await mountGoalsPane($, 'terminal')

    expect((await pane.find({ key: 'dependency-1' }))?.props.value).toBe('none')
    expect((await pane.find({ key: 'dependency-1' }))?.props.options).toMatchObject(
      optionsWith('none'),
    )
  })

  test(
    'a pick that closes a loop set by another process shows a toast and stores nothing',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      const elsewhere = dependencyRecord(ROTATION_CRASH, MIGRATION_GUIDE, 500)
      session.store.set(elsewhere.key, elsewhere.value)
      const stored = new Map(goalRecordsOf(session))
      await pane.select({ key: 'dependency-1', value: ROTATION_CRASH.id })

      expect(session.toasts).toHaveLength(1)
      expect(goalRecordsOf(session)).toEqual(stored)
    },
  )

  test(
    'on a surface without Select, a dependency shows as a badge after the priority badge',
    NO_TIME_LIMIT,
    async ($, on) => {
      const priority = priorityRecordOf(SCOPE, {
        ...MIGRATION_GUIDE,
        prioritySetting: { value: 1, setAt: 500 },
      })
      const stored = storedBoardWithDependency().set(priority.key, priority.value)
      await startSession($, on, { stored })
      const pane = await mountGoalsPane($, 'mobile')

      expect(await pane.find({ type: 'Select' })).toBeUndefined()
      const texts = await pane.findAll({ type: 'Text', text: /after Goal 2/ })
      expect(texts.map(text => text.text)).toEqual([
        ` P1   after Goal 2  ${MIGRATION_GUIDE.text}`,
        ' after Goal 2 ',
      ])
      expect(texts[1]?.props.inverse).toBe(true)
    },
  )
})
