import { describe, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Board, Goal } from '../../types'
import { LOCK_REFUSAL } from '../pluginStore'
import type { StoreEngine } from '../pluginStore'
import { test } from '../testDeclaration'
import { FIRST_SESSION, SECOND_SESSION, storeEngineOf, storeFakeWith } from '../testSupport'
import { EMPTY_BOARD, Outcome, Refusal } from './board'
import type {
  AddRefused,
  BoardChange,
  EditRefused,
  MarkRefused,
  Read,
  UnmarkRefused,
} from './board'
import { MarkRemover, doneMarkOf } from './doneMark'
import {
  clearanceRecordOf,
  doneMarkRecordOf,
  goalRecordOf,
  markRemovalRecordOf,
  textRecordOf,
  todoKeyOf,
  todoRecordOf,
} from './boardRecord'
import { boardPrefixOf, sessionScope } from './boardScope'
import {
  StoreFailure,
  describeStoreFailure,
  loadBoard,
  saveAttachedTodo,
  saveClearedGoal,
  saveDetachedTodo,
  saveDoneMark,
  saveEditedGoal,
  saveGoalDependency,
  saveNewGoal,
  saveRemovedDoneMark,
} from './boardStore'
import type { Failed } from './boardStore'

const SCOPE = sessionScope(FIRST_SESSION)

/**
 * A store fake, with the engine calls of the store code on it, the clock of the test kit and the
 * lines written to the debug log.
 */
function startStore(on: On) {
  const fake = storeFakeWith()
  const clock = mock.clock(on, { now: 1000 })
  const logs: string[] = []

  return { fake, clock, logs, $: storeEngineOf(fake, clock, logs) }
}

type StoreResult =
  | BoardChange
  | AddRefused
  | EditRefused
  | MarkRefused
  | UnmarkRefused
  | Read
  | Failed

/** The board after a change or a load, failing the test for a refusal or a failure. */
function boardOf(result: StoreResult): Board {
  if (result.outcome === Outcome.Refused || result.outcome === Outcome.Failed) {
    throw new Error(`The change ended as ${result.outcome}`)
  }

  return result.board
}

/** The goal changed by a change, failing the test for any other outcome. */
function goalOf(result: StoreResult): Goal {
  if (result.outcome !== Outcome.Changed) {
    throw new Error(`The change ended as ${result.outcome}`)
  }

  return result.goal
}

/** The failure of a change or a load, failing the test for any other outcome. */
function failureOf(result: BoardChange | Read | Failed): Failed {
  if (result.outcome !== Outcome.Failed) {
    throw new Error(`The change ended as ${result.outcome}`)
  }

  return result
}

async function addFullApp($: StoreEngine): Promise<Goal> {
  return goalOf(await saveNewGoal($, SCOPE, 'Write the migration guide', 100))
}

/** An edit of the goal added by addFullApp to a new text. */
const upgradeGuideEdit = {
  text: 'Write the upgrade guide',
  editedFrom: 'Write the migration guide',
}

describe('the board of a session in the store', () => {
  test('a session without stored records has an empty board', async ($, on) => {
    const store = startStore(on)

    expect(await loadBoard(store.$, SCOPE)).toEqual({
      outcome: Outcome.Read,
      board: EMPTY_BOARD,
    })
  })

  test('a board is read back as the changes made it', async ($, on) => {
    const store = startStore(on)
    const fullApp = await addFullApp(store.$)
    const exportFix = goalOf(await saveNewGoal(store.$, SCOPE, 'Fix the export timeout', 200))
    await saveAttachedTodo(store.$, SCOPE, 2, { number: '42', title: 'Release v3.2.0' }, 210)
    await saveAttachedTodo(
      store.$,
      SCOPE,
      2,
      { number: '41', title: 'Login keeps the session' },
      220,
    )
    await saveDetachedTodo(store.$, SCOPE, 2, '42')
    const cleared = await saveClearedGoal(store.$, SCOPE, 2, 300)

    expect(boardOf(cleared)).toEqual({
      goals: [
        fullApp,
        {
          ...exportFix,
          clearedAt: 300,
          todos: [{ number: '41', title: 'Login keeps the session', attachedAt: 220 }],
        },
      ],
    })
    expect(await loadBoard(store.$, SCOPE)).toEqual({
      outcome: Outcome.Read,
      board: boardOf(cleared),
    })
  })

  test('each session reads only its own board', async ($, on) => {
    const store = startStore(on)
    const otherScope = sessionScope(SECOND_SESSION)
    await saveNewGoal(store.$, SCOPE, 'Write the migration guide', 100)
    await saveNewGoal(store.$, otherScope, 'Write the docs', 200)

    expect(boardOf(await loadBoard(store.$, SCOPE)).goals.map(goal => goal.text)).toEqual([
      'Write the migration guide',
    ])
    expect(boardOf(await loadBoard(store.$, otherScope)).goals.map(goal => goal.text)).toEqual([
      'Write the docs',
    ])
  })
})

describe('changes made at the same moment', () => {
  test('goals added at the same moment get different numbers', async ($, on) => {
    const store = startStore(on)
    await Promise.all(
      [
        'Write the migration guide',
        'Fix the export timeout',
        'Speed up the nightly build',
      ].map(text => saveNewGoal(store.$, SCOPE, text, 100)),
    )
    const numbers = boardOf(await loadBoard(store.$, SCOPE)).goals.map(goal => goal.number)

    expect(numbers.toSorted((first, second) => first - second)).toEqual([1, 2, 3])
  })

  test(
    'a goal added while another process adds a goal with the same number gets the next number',
    async ($, on) => {
      const store = startStore(on)
      const other = goalRecordOf(SCOPE, {
        id: 'added-elsewhere',
        number: 1,
        text: 'Write the docs',
        addedAt: 50,
        todos: [],
      })
      store.fake.beforeNextWrite = () => store.fake.store.set(other.key, other.value)

      expect((await addFullApp(store.$)).number).toBe(2)
      expect(boardOf(await loadBoard(store.$, SCOPE)).goals.map(goal => goal.number)).toEqual([
        1, 2,
      ])
    },
  )

  test(
    'a TODO entry attached by another process during an attach is still attached',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      const other = todoRecordOf(SCOPE, fullApp, {
        number: '42',
        title: 'Release',
        attachedAt: 150,
      })
      store.fake.beforeNextWrite = () => store.fake.store.set(other.key, other.value)
      await saveAttachedTodo(store.$, SCOPE, 1, { number: '45', title: 'One emulator boot' }, 200)

      expect(boardOf(await loadBoard(store.$, SCOPE)).goals[0]?.todos).toEqual([
        { number: '42', title: 'Release', attachedAt: 150 },
        { number: '45', title: 'One emulator boot', attachedAt: 200 },
      ])
    },
  )

  test('a goal cleared by another process during an attach is still cleared', async ($, on) => {
    const store = startStore(on)
    const fullApp = await addFullApp(store.$)
    const other = clearanceRecordOf(SCOPE, fullApp, 150)
    store.fake.beforeNextWrite = () => store.fake.store.set(other.key, other.value)
    await saveAttachedTodo(store.$, SCOPE, 1, { number: '45', title: 'One emulator boot' }, 200)

    expect(boardOf(await loadBoard(store.$, SCOPE)).goals[0]?.clearedAt).toBe(150)
  })

  test(
    'a done mark set by another process during the removal of an older mark is still set',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      await saveDoneMark(store.$, SCOPE, 1, 'release/v1.45.3', 300)
      const newMark = { evidence: 'release/v1.45.4', markedAt: 350 }
      const other = doneMarkRecordOf(SCOPE, { ...fullApp, doneMark: newMark })
      store.fake.beforeNextWrite = () => store.fake.store.set(other.key, other.value)
      const removal = { removedAt: 400, removedBy: MarkRemover.User } as const
      await saveRemovedDoneMark(store.$, SCOPE, 1, removal, 300)
      const goal = boardOf(await loadBoard(store.$, SCOPE)).goals[0] ?? fullApp

      expect(doneMarkOf(goal)).toEqual(newMark)
      expect(goal.markRemoval).toEqual({ ...removal, markedAt: 300 })
    },
  )

  test(
    'a done mark set while another process removes the mark of its dependency is removed',
    async ($, on) => {
      const store = startStore(on)
      await addFullApp(store.$)
      const loginFix = goalOf(await saveNewGoal(store.$, SCOPE, 'Fix the export timeout', 110))
      await saveGoalDependency(store.$, SCOPE, 1, 2, 200)
      await saveDoneMark(store.$, SCOPE, 2, 'release/v3.2.0', 300)
      const removal = { markedAt: 300, removedAt: 350, removedBy: MarkRemover.User } as const
      const other = markRemovalRecordOf(SCOPE, { ...loginFix, markRemoval: removal })
      store.fake.beforeNextWrite = () => store.fake.store.set(other.key, other.value)
      await saveDoneMark(store.$, SCOPE, 1, 'branch full-app', 400)

      expect(boardOf(await loadBoard(store.$, SCOPE)).goals.map(doneMarkOf)).toEqual([
        undefined,
        undefined,
      ])
    },
  )
})

describe('writing only what changed', () => {
  test('a refused change writes nothing', async ($, on) => {
    const store = startStore(on)
    await addFullApp(store.$)
    const stored = [...store.fake.store]

    expect(await saveClearedGoal(store.$, SCOPE, 2, 400)).toEqual({
      outcome: Outcome.Refused,
      refusal: Refusal.GoalNotOpen,
      goal: 2,
    })
    expect([...store.fake.store]).toEqual(stored)
  })

  test('attaching a TODO entry again under the same title writes nothing', async ($, on) => {
    const store = startStore(on)
    await addFullApp(store.$)
    const todo = { number: '45', title: 'One emulator boot' }
    await saveAttachedTodo(store.$, SCOPE, 1, todo, 200)
    store.fake.refusedWrites.push('the store is over 4 MiB')

    expect((await saveAttachedTodo(store.$, SCOPE, 1, todo, 300)).outcome).toBe(Outcome.Unchanged)
    expect(store.fake.refusedWrites).toHaveLength(1)
  })

  test('an edit writes one record, and the goal is read back with its new text', async ($, on) => {
    const store = startStore(on)
    const fullApp = await addFullApp(store.$)
    await saveAttachedTodo(store.$, SCOPE, 1, { number: '45', title: 'One emulator boot' }, 200)
    const keys = [...store.fake.store.keys()]
    const edited = await saveEditedGoal(store.$, SCOPE, 1, upgradeGuideEdit, 300)

    expect([...store.fake.store.keys()]).toEqual([
      ...keys,
      textRecordOf(SCOPE, fullApp, 300).key,
    ])
    expect(await loadBoard(store.$, SCOPE)).toEqual({
      outcome: Outcome.Read,
      board: boardOf(edited),
    })
    expect(boardOf(edited).goals).toEqual([
      {
        ...fullApp,
        text: 'Write the upgrade guide',
        editedAt: 300,
        todos: [{ number: '45', title: 'One emulator boot', attachedAt: 200 }],
      },
    ])
  })

  test('an edit of a marked goal writes the removal of the mark and the text', async ($, on) => {
    const store = startStore(on)
    const fullApp = await addFullApp(store.$)
    await saveDoneMark(store.$, SCOPE, 1, 'release/v3.2.0', 300)
    const keys = [...store.fake.store.keys()]
    const edited = await saveEditedGoal(store.$, SCOPE, 1, upgradeGuideEdit, 400)
    const removal = { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User } as const

    expect([...store.fake.store.keys()]).toEqual([
      ...keys,
      markRemovalRecordOf(SCOPE, { ...fullApp, markRemoval: removal }).key,
      textRecordOf(SCOPE, fullApp, 400).key,
    ])
    expect(edited.outcome === Outcome.Changed && edited.unmarked).toEqual([
      { ...goalOf(edited), markRemoval: removal },
    ])
    expect(await loadBoard(store.$, SCOPE)).toEqual({
      outcome: Outcome.Read,
      board: boardOf(edited),
    })
  })

  test('an edit to the text already on the goal writes nothing', async ($, on) => {
    const store = startStore(on)
    await addFullApp(store.$)
    store.fake.refusedWrites.push('the store is over 4 MiB')

    const edited = await saveEditedGoal(
      store.$,
      SCOPE,
      1,
      { text: 'Write the migration guide', editedFrom: 'Write the migration guide' },
      300,
    )

    expect(edited.outcome).toBe(Outcome.Unchanged)
    expect(store.fake.refusedWrites).toHaveLength(1)
  })

  test(
    'a done mark and its removal write one record each, which are read back with the goal',
    async ($, on) => {
      const store = startStore(on)
      await addFullApp(store.$)
      const keys = [...store.fake.store.keys()]
      const marked = await saveDoneMark(store.$, SCOPE, 1, 'release/v3.2.0', 300)
      const removal = { removedAt: 400, removedBy: MarkRemover.Model } as const
      const removed = await saveRemovedDoneMark(store.$, SCOPE, 1, removal)
      const removedGoal = {
        ...goalOf(marked),
        doneMark: { evidence: 'release/v3.2.0', markedAt: 300 },
        markRemoval: { ...removal, markedAt: 300 },
      }

      expect([...store.fake.store.keys()]).toEqual([
        ...keys,
        doneMarkRecordOf(SCOPE, removedGoal).key,
        markRemovalRecordOf(SCOPE, removedGoal).key,
      ])
      expect(goalOf(removed)).toEqual(removedGoal)
      expect(await loadBoard(store.$, SCOPE)).toEqual({
        outcome: Outcome.Read,
        board: boardOf(removed),
      })
    },
  )

  test(
    'a removed mark writes the removals of the marks depending on it first, so a retry of a ' +
      'failed write removes every mark',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      const loginFix = goalOf(await saveNewGoal(store.$, SCOPE, 'Fix the export timeout', 110))
      await saveGoalDependency(store.$, SCOPE, 1, 2, 200)
      await saveDoneMark(store.$, SCOPE, 2, 'release/v3.2.0', 300)
      await saveDoneMark(store.$, SCOPE, 1, 'branch full-app', 310)
      const keys = [...store.fake.store.keys()]
      const removal = { removedAt: 400, removedBy: MarkRemover.User } as const
      store.fake.beforeNextWrite = () => store.fake.refusedWrites.push('the store is over 4 MiB')
      const failed = await saveRemovedDoneMark(store.$, SCOPE, 2, removal)
      const removed = await saveRemovedDoneMark(store.$, SCOPE, 2, removal)

      expect(failed.outcome).toBe(Outcome.Failed)
      expect([...store.fake.store.keys()]).toEqual([
        ...keys,
        markRemovalRecordOf(SCOPE, { ...fullApp, markRemoval: { ...removal, markedAt: 310 } }).key,
        markRemovalRecordOf(SCOPE, { ...loginFix, markRemoval: { ...removal, markedAt: 300 } }).key,
      ])
      expect(boardOf(await loadBoard(store.$, SCOPE)).goals.map(doneMarkOf)).toEqual([
        undefined,
        undefined,
      ])
      expect(await loadBoard(store.$, SCOPE)).toEqual({
        outcome: Outcome.Read,
        board: boardOf(removed),
      })
    },
  )

  test('a done mark with the evidence already on the goal writes nothing', async ($, on) => {
    const store = startStore(on)
    await addFullApp(store.$)
    await saveDoneMark(store.$, SCOPE, 1, 'release/v3.2.0', 300)
    store.fake.refusedWrites.push('the store is over 4 MiB')

    expect((await saveDoneMark(store.$, SCOPE, 1, 'release/v3.2.0', 310)).outcome).toBe(
      Outcome.Unchanged,
    )
    expect(store.fake.refusedWrites).toHaveLength(1)
  })

  test('detaching a TODO entry deletes its record', async ($, on) => {
    const store = startStore(on)
    const fullApp = await addFullApp(store.$)
    await saveAttachedTodo(store.$, SCOPE, 1, { number: '45', title: 'One emulator boot' }, 200)
    await saveDetachedTodo(store.$, SCOPE, 1, '45')

    expect(store.fake.store.has(todoKeyOf(SCOPE, fullApp, '45'))).toBe(false)
  })
})

describe('a damaged record, a refused read or a refused write', () => {
  test(
    'a damaged record is reported with its key, and a change leaves the store untouched',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      const goal = goalRecordOf(SCOPE, { ...fullApp, id: 'damaged' }).value
      const login = { number: '41', title: 'Login', attachedAt: 200 }
      const todo = todoRecordOf(SCOPE, fullApp, login)
      const missingGoal = { ...fullApp, id: 'missing' }
      const damagedRecords: readonly (readonly [string, unknown])[] = [
        [`${boardPrefixOf(SCOPE)}damaged`, null],
        [`${boardPrefixOf(SCOPE)}damaged`, { ...goal, number: 0 }],
        [`${boardPrefixOf(SCOPE)}damaged`, { ...goal, number: -1 }],
        [`${boardPrefixOf(SCOPE)}damaged`, { ...goal, number: 1.5 }],
        [`${boardPrefixOf(SCOPE)}damaged`, { ...goal, number: 2, version: 2 }],
        [todo.key, { ...todo.value, number: 41 }],
        [todo.key, { ...todo.value, number: '41.0' }],
        [todo.key, { ...todo.value, title: 41 }],
        [todo.key, { ...todo.value, attachedAt: 'yesterday' }],
        [todoKeyOf(SCOPE, fullApp, '42'), todo.value],
        [todoKeyOf(SCOPE, missingGoal, '41'), todoRecordOf(SCOPE, missingGoal, login).value],
      ]
      for (const [key, damaged] of damagedRecords) {
        store.fake.store.set(key, damaged)
        const stored = [...store.fake.store]
        const failed = { outcome: Outcome.Failed, failure: StoreFailure.Unreadable, key }

        expect(await loadBoard(store.$, SCOPE)).toEqual(failed)
        expect(await saveNewGoal(store.$, SCOPE, 'Ship', 400)).toEqual(failed)
        expect(await saveClearedGoal(store.$, SCOPE, 1, 400)).toEqual(failed)
        expect([...store.fake.store]).toEqual(stored)
        expect(store.fake.store.get(key)).toBe(damaged)
        store.fake.store.delete(key)
      }
    },
  )

  test(
    'a goal stored under a number already taken is left out until it is given a free number',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      const pending = goalRecordOf(SCOPE, { ...fullApp, id: 'pending', text: 'Ship' })
      store.fake.store.set(pending.key, pending.value)

      expect(boardOf(await loadBoard(store.$, SCOPE))).toEqual({ goals: [fullApp] })
      expect(goalOf(await saveNewGoal(store.$, SCOPE, 'Store listing', 400)).number).toBe(2)
    },
  )

  test(
    'a write the store refuses is reported with its error, and the board is as stored before',
    async ($, on) => {
      const store = startStore(on)
      const fullApp = await addFullApp(store.$)
      store.fake.refusedWrites.push('the store is over 4 MiB')
      const failed = failureOf(await saveClearedGoal(store.$, SCOPE, 1, 400))

      expect(failed.failure).toBe(StoreFailure.NotSaved)
      expect(failed.key).toBe(clearanceRecordOf(SCOPE, fullApp, 400).key)
      expect(describeStoreFailure(failed)).toContain('the store is over 4 MiB')
      expect(boardOf(await loadBoard(store.$, SCOPE))).toEqual({ goals: [fullApp] })
    },
  )

  test(
    'keys the store cannot list are reported with the error, for a load and a change',
    async ($, on) => {
      const store = startStore(on)
      await addFullApp(store.$)
      store.fake.keysRefusal = 'the store file is not readable'

      for (const result of [
        await loadBoard(store.$, SCOPE),
        await saveClearedGoal(store.$, SCOPE, 1, 400),
      ]) {
        const failed = failureOf(result)

        expect(failed.failure).toBe(StoreFailure.NotRead)
        expect(failed.key).toBe(boardPrefixOf(SCOPE))
        expect(describeStoreFailure(failed)).toContain('the store file is not readable')
      }
    },
  )

  test('a write refused while another process holds the lock is made again', async ($, on) => {
    const store = startStore(on)
    await addFullApp(store.$)
    store.fake.refusedWrites.push(LOCK_REFUSAL)
    const clearing = saveClearedGoal(store.$, SCOPE, 1, 400)
    await store.clock.settle()
    await store.clock.advance(60_000)

    expect(goalOf(await clearing).clearedAt).toBe(400)
    expect(boardOf(await loadBoard(store.$, SCOPE)).goals[0]?.clearedAt).toBe(400)
    expect(store.logs.filter(line => line.includes(LOCK_REFUSAL))).toHaveLength(1)
  })
})
