import { describe, expect } from 'claude-code/testing'

import { test } from '../testDeclaration'
import { endTurn, promptsOfPlugin, startSession, startTurn } from '../testSupport'
import { MARK_GOAL_DONE_TOOL } from './goalNames'
import {
  MIGRATION_GUIDE,
  ROTATION_CRASH,
  clearElsewhere,
  markElsewhere,
  mountGoalsPane,
  storedBoard,
  storedBoardWithMark,
} from './goalPaneTestSupport'

function waitingFor(goalNumber: number): string {
  return `The nudge for Goal ${goalNumber} is sent to Claude once the current turn ends.`
}

describe('Nudge in the Goals pane', () => {
  test(
    'Nudge while no turn runs sends one prompt with the goal, the TODO entries attached to it ' +
      'and the tool that marks it done',
    async ($, on) => {
      const session = await startSession($, on, { stored: storedBoard() })
      const pane = await mountGoalsPane($, 'terminal')
      await pane.press({ key: 'nudge-2' })
      await session.clock.settle()

      const [nudge, ...others] = promptsOfPlugin(session)
      expect(others).toEqual([])
      expect(nudge).toContain(`Goal 2 is not satisfied yet: ${ROTATION_CRASH.text}.`)
      expect(nudge).toContain('#41 (Rotation keeps the open form)')
      expect(nudge).toContain(MARK_GOAL_DONE_TOOL)
      expect(nudge).not.toContain('Goal 1')
      expect(session.toasts).toEqual([])
    },
  )

  test('Nudge on two goals during a turn sends both in one prompt once the turn ends', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await startTurn($)
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-1' })
    await session.clock.settle()

    expect(promptsOfPlugin(session)).toEqual([])
    expect(session.toasts).toEqual([waitingFor(2), waitingFor(1)])

    await endTurn($)
    await session.clock.settle()
    const [nudge, ...others] = promptsOfPlugin(session)
    expect(others).toEqual([])
    expect(nudge).toContain('the following goals have not been marked as done')
    expect(nudge).toContain(`Goal 2 is not satisfied yet: ${ROTATION_CRASH.text}.`)
    expect(nudge).toContain(`Goal 1 is not satisfied yet: ${MIGRATION_GUIDE.text}.`)
    expect(nudge?.indexOf('Goal 2 is')).toBeLessThan(nudge?.indexOf('Goal 1 is') ?? -1)
  })

  test('a goal pressed while the nudge of another goal is sent goes out after that turn', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-1' })
    await session.clock.settle()

    expect(session.toasts).toEqual([waitingFor(1)])
    const [first, ...beforeTurnEnd] = promptsOfPlugin(session)
    expect(beforeTurnEnd).toEqual([])
    expect(first).toContain('Goal 2 is not satisfied yet')
    expect(first).not.toContain('Goal 1')

    await endTurn($)
    await session.clock.settle()
    const [, second, ...others] = promptsOfPlugin(session)
    expect(others).toEqual([])
    expect(second).toContain(`Goal 1 is not satisfied yet: ${MIGRATION_GUIDE.text}.`)
  })

  test('of two goals pressed, the one not marked as done by the end of the turn is nudged', async (
    $,
    on,
  ) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await startTurn($)
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-1' })
    markElsewhere(session, ROTATION_CRASH)
    await endTurn($)
    await session.clock.settle()

    const [nudge, ...others] = promptsOfPlugin(session)
    expect(others).toEqual([])
    expect(nudge).toContain('the following goal has not been marked as done')
    expect(nudge).toContain(`Goal 1 is not satisfied yet: ${MIGRATION_GUIDE.text}.`)
    expect(nudge).not.toContain('Goal 2')
  })

  test('a goal pressed twice during a turn is nudged once', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await startTurn($)
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-2' })
    await endTurn($)
    await session.clock.settle()

    const [nudge, ...others] = promptsOfPlugin(session)
    expect(others).toEqual([])
    expect(nudge).toContain('the following goal has not been marked as done')
    expect(nudge?.split(ROTATION_CRASH.text)).toHaveLength(2)
  })

  test('a goal marked as done before the end of the turn is not nudged', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await startTurn($)
    await pane.press({ key: 'nudge-2' })
    markElsewhere(session, ROTATION_CRASH)
    await endTurn($)
    await session.clock.settle()

    expect(promptsOfPlugin(session)).toEqual([])
  })

  test('a goal marked as done has no Nudge, and an unmarked one beside it has', async ($, on) => {
    await startSession($, on, { stored: storedBoardWithMark() })
    const pane = await mountGoalsPane($, 'terminal')

    expect(await pane.find({ key: 'nudge-2' })).toBeUndefined()
    expect(await pane.find({ key: 'nudge-1' })).toBeDefined()
  })

  test('Nudge on a goal marked as done since the pane drew it sends nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    markElsewhere(session, ROTATION_CRASH)
    await pane.press({ key: 'nudge-2' })
    await session.clock.settle()

    expect(promptsOfPlugin(session)).toEqual([])
    expect(session.toasts).toEqual(['Goal 2 is already marked as done.'])
  })

  test('a nudge refused beneath the plugin shows the reason in a toast', async ($, on) => {
    on('prompt.submit', { origin: { kind: 'plugin' } }, () => ({ drop: 'refused by a test hook' }))
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: 'nudge-2' })
    await session.clock.settle()

    expect(session.toasts).toEqual([
      'The nudge for Goal 2 was not sent to Claude: refused by a test hook.',
    ])
  })

  test('a refused nudge of two goals names both in its toast', async ($, on) => {
    on('prompt.submit', { origin: { kind: 'plugin' } }, () => ({ drop: 'refused by a test hook' }))
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await startTurn($)
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-1' })
    await endTurn($)
    await session.clock.settle()

    expect(session.toasts).toEqual([
      waitingFor(2),
      waitingFor(1),
      'The nudge for Goal 2 and Goal 1 was not sent to Claude: refused by a test hook.',
    ])
  })

  test('a goal pressed while a refused nudge is sent is sent once that nudge is refused', async (
    $,
    on,
  ) => {
    on('prompt.submit', { origin: { kind: 'plugin' } }, () => ({ drop: 'refused by a test hook' }))
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    await pane.press({ key: 'nudge-2' })
    await pane.press({ key: 'nudge-1' })
    await session.clock.settle()

    expect(session.toasts).toEqual([
      waitingFor(1),
      'The nudge for Goal 2 was not sent to Claude: refused by a test hook.',
      'The nudge for Goal 1 was not sent to Claude: refused by a test hook.',
    ])
  })

  test('Nudge on a goal cleared elsewhere sends nothing', async ($, on) => {
    const session = await startSession($, on, { stored: storedBoard() })
    const pane = await mountGoalsPane($, 'terminal')
    clearElsewhere(session, ROTATION_CRASH)
    await pane.press({ key: 'nudge-2' })
    await session.clock.settle()

    expect(promptsOfPlugin(session)).toEqual([])
    expect(session.toasts).toEqual(['Goal 2 is no longer open.'])
  })
})
