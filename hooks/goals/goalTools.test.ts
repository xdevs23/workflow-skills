// The tools are tested as the plugin registers them at the start of a session, since the engine
// rejects calls, such as the call that registers a tool, to hooks registered by a test.
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Goal } from '../../types'
import { describeHookFailure } from '../hookFailure'
import {
  FIRST_SESSION,
  GOALS_NOT_EXHAUSTIVE,
  NO_TIME_LIMIT,
  SUBAGENT,
  mountPane,
  startSession,
} from '../testSupport'
import { MarkRemover } from './board'
import {
  clearanceRecordOf,
  doneMarkRecordOf,
  goalRecordOf,
  markRemovalRecordOf,
  todoRecordOf,
} from './boardRecord'
import { sessionScope } from './boardScope'
import {
  ATTACH_TODO,
  ATTACH_TODO_TOOL,
  DETACH_TODO,
  DETACH_TODO_TOOL,
  GOALS_PANE,
  LIST_GOALS,
} from './goalNames'
import { GOAL_TOOLS_SUBJECT } from './goalToolTexts'
import {
  MIGRATION_GUIDE,
  ROTATION_CRASH,
  SEE_OPEN_GOALS,
  addGoals,
  listGoals,
} from './goalToolTestSupport'
import type { TodoEntry } from './todoEntry'

const STORE_LISTING = 'Write the store listing'

const ROTATION_ENTRY = '#41 - Rotation keeps the open form'

/** A goal of the board of FIRST_SESSION, with the TODO entries `todos` attached to it. */
function goalNumbered(number: number, text: string, todos: readonly TodoEntry[] = []): Goal {
  return {
    id: `goal-${number}`,
    number,
    text,
    addedAt: 100,
    todos: todos.map(todo => ({ ...todo, attachedAt: 200 })),
  }
}

function attachTodo($: Engine, input: { goal?: unknown; todo?: unknown; agentId?: string }) {
  return $.tool.call({ tool: ATTACH_TODO_TOOL, ...input })
}

function detachTodo($: Engine, input: { goal?: unknown; todo?: unknown; agentId?: string }) {
  return $.tool.call({ tool: DETACH_TODO_TOOL, ...input })
}

describe('the tools of the goals board', () => {
  for (const isInteractive of [true, false]) {
    test(
      `a session ${isInteractive ? 'with' : 'without'} a person at the prompt registers the ` +
        'three tools at its start',
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on, { isInteractive })

        expect(session.registered).toEqual(
          expect.arrayContaining([LIST_GOALS, ATTACH_TODO, DETACH_TODO]),
        )
      },
    )
  }
})

describe('listing the goals', () => {
  test(
    'the open goals are listed by number with their entries, then the cleared goals by number',
    NO_TIME_LIMIT,
    async ($, on) => {
      const scope = sessionScope(FIRST_SESSION)
      // The goals are stored in the reverse order of their numbers.
      const goals: Goal[] = [
        { ...goalNumbered(4, 'Ship the tablet layout'), clearedAt: 410 },
        goalNumbered(3, STORE_LISTING, [{ number: '45', title: 'Listing has screenshots' }]),
        { ...goalNumbered(2, ROTATION_CRASH), clearedAt: 400 },
        goalNumbered(1, MIGRATION_GUIDE, [
          { number: '38', title: 'Guide covers the schema' },
          { number: '234', title: 'Guide lists the flags' },
        ]),
      ]
      const records = goals.flatMap(goal => [
        goalRecordOf(scope, goal),
        ...goal.todos.map(todo => todoRecordOf(scope, goal, todo)),
        ...(goal.clearedAt === undefined ? [] : [clearanceRecordOf(scope, goal, goal.clearedAt)]),
      ])
      const stored = new Map(records.map(record => [record.key, record.value]))
      await startSession($, on, { stored })

      expect(await listGoals($)).toBe(
        [
          `#1: ${MIGRATION_GUIDE}`,
          'Attached: #38 - Guide covers the schema, #234 - Guide lists the flags',
          `#3: ${STORE_LISTING}`,
          'Attached: #45 - Listing has screenshots',
          '',
          'Cleared by the user:',
          `#2: ${ROTATION_CRASH}`,
          '#4: Ship the tablet layout',
          '',
          GOALS_NOT_EXHAUSTIVE,
        ].join('\n'),
      )
    },
  )

  test(
    'a board whose goals are all cleared, or that has none, is listed as the empty board, with ' +
      'its cleared goals after it',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const empty = await listGoals($)
      await addGoals(session, [MIGRATION_GUIDE], [1])

      expect(empty).toBe(
        'The board of this session does not have an open goal. Only the user adds goals, with ' +
          '/goals add or in the Goals pane.',
      )
      expect(await listGoals($)).toBe(`${empty}\n\nCleared by the user:\n#1: ${MIGRATION_GUIDE}`)
    },
  )

  test(
    'a goal marked as done is listed with its evidence, and a removed mark is left out',
    NO_TIME_LIMIT,
    async ($, on) => {
      const scope = sessionScope(FIRST_SESSION)
      const doneMark = { evidence: 'release/v2.4.0', markedAt: 300 }
      const marked = {
        ...goalNumbered(1, MIGRATION_GUIDE, [{ number: '38', title: 'Guide covers the schema' }]),
        doneMark,
      }
      const unmarked = {
        ...goalNumbered(2, ROTATION_CRASH),
        doneMark,
        markRemoval: { markedAt: 300, removedAt: 400, removedBy: MarkRemover.User },
      }
      const records = [
        ...[marked, unmarked].flatMap(goal => [
          goalRecordOf(scope, goal),
          ...goal.todos.map(todo => todoRecordOf(scope, goal, todo)),
          doneMarkRecordOf(scope, goal),
        ]),
        markRemovalRecordOf(scope, unmarked),
      ]
      await startSession($, on, { stored: new Map(records.map(each => [each.key, each.value])) })

      expect(await listGoals($)).toBe(
        [
          `#1: ${MIGRATION_GUIDE}`,
          'Marked as done by you: release/v2.4.0',
          'Attached: #38 - Guide covers the schema',
          `#2: ${ROTATION_CRASH}`,
          '',
          GOALS_NOT_EXHAUSTIVE,
        ].join('\n'),
      )
    },
  )

  test(
    'a subagent lists the goals as the main conversation does, without the sentence that the ' +
      'goals are not exhaustive',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH])
      await attachTodo($, { goal: 2, todo: ROTATION_ENTRY })

      const listed = await listGoals($, SUBAGENT)
      expect(listed).toBe(
        `#1: ${MIGRATION_GUIDE}\n#2: ${ROTATION_CRASH}\nAttached: ${ROTATION_ENTRY}`,
      )
      expect(await listGoals($)).toBe(`${listed}\n\n${GOALS_NOT_EXHAUSTIVE}`)
    },
  )
})

describe('attaching and detaching a TODO entry', () => {
  test(
    'an entry attached to a goal is listed under it until it is detached',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH])

      const attached = await attachTodo($, { goal: 2, todo: ROTATION_ENTRY })
      expect(attached.result).toBe(
        `Attached ${ROTATION_ENTRY} to goal #2.\n\n${GOALS_NOT_EXHAUSTIVE}`,
      )
      expect(await listGoals($)).toContain(`#2: ${ROTATION_CRASH}\nAttached: ${ROTATION_ENTRY}`)

      const detached = await detachTodo($, { goal: 2, todo: '#41' })
      expect(detached.result).toBe(`Detached #41 from goal #2.\n\n${GOALS_NOT_EXHAUSTIVE}`)
      expect(await listGoals($)).not.toContain('#41')
    },
  )

  test(
    'the Goals pane shows an entry once it is attached, and stops showing it once it is detached',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      const pane = await mountPane($, 'terminal', GOALS_PANE)

      await attachTodo($, { goal: 1, todo: ROTATION_ENTRY })
      expect(await pane.find({ type: 'Text', text: ROTATION_ENTRY })).toBeDefined()
      await detachTodo($, { goal: 1, todo: '#41' })
      expect(await pane.find({ type: 'Text', text: ROTATION_ENTRY })).toBeUndefined()
    },
  )

  test('an entry under the number of a sub-unit is attached', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await addGoals(session, [MIGRATION_GUIDE])
    await attachTodo($, { goal: 1, todo: '#41.1 - Rotation keeps the scroll position' })

    expect(await listGoals($)).toContain('Attached: #41.1 - Rotation keeps the scroll position')
  })

  test(
    'an entry is read without the white space around it and its title, so attaching it again ' +
      'leaves the board unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      await attachTodo($, { goal: 1, todo: ` ${ROTATION_ENTRY.replace(' - ', ' -   ')}  \n` })
      const stored = [...session.store]

      expect((await attachTodo($, { goal: 1, todo: ROTATION_ENTRY })).result).toBe(
        `Attached ${ROTATION_ENTRY} to goal #1.\n\n${GOALS_NOT_EXHAUSTIVE}`,
      )
      expect([...session.store]).toEqual(stored)
      expect(await listGoals($)).toContain(`Attached: ${ROTATION_ENTRY}`)
    },
  )

  test(
    'detaching an entry not attached to the goal is denied with the entry, the goal and the ' +
      'list tool',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH])
      await attachTodo($, { goal: 2, todo: ROTATION_ENTRY })

      expect((await detachTodo($, { goal: 1, todo: '#41' })).deny).toBe(
        `#41 is not attached to goal #1. ${SEE_OPEN_GOALS}`,
      )
      expect(await listGoals($)).toContain(`Attached: ${ROTATION_ENTRY}`)
    },
  )

  test(
    'a subagent cannot attach or detach an entry, and the board is left as it was',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH])
      await attachTodo($, { goal: 2, todo: ROTATION_ENTRY })
      const stored = [...session.store]

      const attached = await attachTodo($, { goal: 1, todo: ROTATION_ENTRY, agentId: SUBAGENT })
      const detached = await detachTodo($, { goal: 2, todo: '#41', agentId: SUBAGENT })
      expect(attached.deny).toContain('Name the entry and the goal in your result instead.')
      expect(detached.deny).toBe(attached.deny)
      expect([...session.store]).toEqual(stored)
    },
  )
})

describe('input the model gives outside the schema', () => {
  test(
    'a goal that is not a whole number from 1 up is denied, and nothing is written',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      const stored = [...session.store]

      for (const goal of [0, -1, 1.5, '1', undefined]) {
        for (const denied of [
          await attachTodo($, { goal, todo: ROTATION_ENTRY }),
          await detachTodo($, { goal, todo: '#41' }),
        ]) {
          expect(denied.deny).toBe('Give the number of the goal as a whole number from 1 up.')
        }
      }
      expect([...session.store]).toEqual(stored)
    },
  )

  test('a blank or missing entry is denied with the form to use', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await addGoals(session, [MIGRATION_GUIDE])
    const stored = [...session.store]

    for (const todo of [' \n', undefined]) {
      expect((await attachTodo($, { goal: 1, todo })).deny).toBe(
        'The TODO entry is blank. Give it with its number and title, as its heading in TODO.md ' +
          'shows it.',
      )
      expect((await detachTodo($, { goal: 1, todo })).deny).toBe(
        'The TODO entry is blank. Give it by its number, such as #12 or #12.3.',
      )
    }
    expect([...session.store]).toEqual(stored)
  })

  test(
    'an entry in another form, or with a title over several lines, is denied with the form to use',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      const stored = [...session.store]

      for (const todo of ['41 - Settings', '#41', '#41 Settings', '#41 - Settings\n#9: Other']) {
        expect((await attachTodo($, { goal: 1, todo })).deny).toBe(
          'Give the TODO entry on one line in the form #<number> - <title>, as its heading in ' +
            'TODO.md shows it.',
        )
      }
      expect((await detachTodo($, { goal: 1, todo: ROTATION_ENTRY })).deny).toBe(
        'Give the TODO entry by its number alone, such as #12 or #12.3.',
      )
      expect([...session.store]).toEqual(stored)
    },
  )

  test('an entry over 200 characters is denied', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await addGoals(session, [MIGRATION_GUIDE])
    const longEntry = `#41 - ${'a'.repeat(195)}`

    for (const change of [attachTodo, detachTodo]) {
      expect((await change($, { goal: 1, todo: longEntry })).deny).toBe(
        'Give the TODO entry in at most 200 characters.',
      )
    }
    expect((await attachTodo($, { goal: 1, todo: longEntry.slice(0, -1) })).deny).toBeUndefined()
  })

  test(
    'an entry whose number is not a TODO number, or that lacks a title, is not attached',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])

      expect((await attachTodo($, { goal: 1, todo: '#4x - Settings' })).deny).toBe(
        '#4x is not the number of an entry in TODO.md, which has numbers such as #12 or #12.3. ' +
          'Give the entry as its heading in TODO.md shows it.',
      )
      expect((await attachTodo($, { goal: 1, todo: '#41 -  ' })).deny).toBe(
        'Give the TODO entry with its title after its number, as its heading in TODO.md shows it.',
      )
      expect(await listGoals($)).not.toContain('Attached')
    },
  )
})

describe('a goal that is not open', () => {
  test(
    'a goal never added and a cleared goal are denied with one answer that names the goal and ' +
      'the list tool',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE, ROTATION_CRASH], [2])

      for (const goal of [2, 7]) {
        const denial = `Goal #${goal} is not open on the board of this session. ${SEE_OPEN_GOALS}`
        expect((await attachTodo($, { goal, todo: ROTATION_ENTRY })).deny).toBe(denial)
        expect((await detachTodo($, { goal, todo: '#41' })).deny).toBe(denial)
      }
      expect(await listGoals($)).not.toContain('Attached')
    },
  )
})

describe('a store or a hook that fails', () => {
  test(
    'a store that cannot be read denies every tool with the reason, which the debug log has too',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const refusal = 'the store file is not readable'
      session.keysRefusal = refusal

      const denials = [
        await listGoals($),
        (await attachTodo($, { goal: 1, todo: ROTATION_ENTRY })).deny,
        (await detachTodo($, { goal: 1, todo: '#41' })).deny,
      ]
      for (const denial of denials) {
        expect(denial).toStartWith('The goals board could not be used: ')
        expect(denial).toContain(refusal)
        expect(denial).toEndWith(
          'The debug log has this too. Until the cause is fixed, go on without the goals board.',
        )
        expect(session.logs).toContain(denial)
      }
      expect(session.chatLines).toEqual([])
    },
  )

  test(
    'a change written to a store over 4 MiB is denied with the reason, and the entry is not ' +
      'attached',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      const refusal = 'the store is over 4 MiB'
      session.refusedWrites.push(refusal)

      const denial = (await attachTodo($, { goal: 1, todo: ROTATION_ENTRY })).deny
      expect(denial).toStartWith('The goals board could not be used: ')
      expect(denial).toContain(refusal)
      expect(session.logs).toContain(denial)
      expect(await listGoals($)).not.toContain('Attached')
    },
  )

  test(
    'a hook that fails denies the call with the reason, which the debug log has too',
    NO_TIME_LIMIT,
    async ($, on) => {
      let isSessionIdFailing = false
      on('session.id', {}, ($, e, next) => {
        if (isSessionIdFailing) {
          throw new Error('the session id is not known')
        }

        return next(e)
      })
      const session = await startSession($, on)
      await addGoals(session, [MIGRATION_GUIDE])
      isSessionIdFailing = true

      const denials = [
        await listGoals($),
        (await attachTodo($, { goal: 1, todo: ROTATION_ENTRY })).deny,
        (await detachTodo($, { goal: 1, todo: '#41' })).deny,
      ]
      // The engine reports, in words it picks, that the session id could not be looked up.
      for (const denial of denials) {
        expect(denial).toStartWith('The goals board could not be used: ')
        expect(denial).toContain('session.id')
        expect(session.logs).toContain(denial)
      }
    },
  )

  // A hook of the test kit that holds a wait runs under the same time limit as the hook of the
  // plugin, so which of the two runs out of time first differs from run to run. The text for a hook
  // that ran out of time is therefore tested without a session.
  test(
    'the denial of a goal tool that ran out of time leaves open whether the change was saved, ' +
      'and adds the last failure before that',
    () => {
      expect(describeHookFailure(GOAL_TOOLS_SUBJECT, { kind: 'timeout', budget: 10_000 })).toBe(
        'The goals board did not finish in time, so whether the change was saved is unknown.\n' +
          'List the goals before you try again. The debug log has this too.',
      )
      expect(
        describeHookFailure(GOAL_TOOLS_SUBJECT, {
          kind: 'timeout',
          message: 'the store is locked',
          budget: 10_000,
        }),
      ).toContain('\nThe last failure before that: the store is locked\n')
    },
  )
})
