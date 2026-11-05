import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Board } from '../../types'
import { isMainConversation } from '../conversation'
import type { EveryEvent } from '../register'
import { callToolWithNote, submitWithNote } from '../sendToModel'
import { Outcome } from './board'
import { listOpenGoals, readBoardToRemind } from './goalReminderBoard'
import { describeGoalChanges, describeOpenGoalsAfterCompaction } from './goalReminders'
import { COMPACTION_SOURCE } from './goalSession'
import { exchangeSeenBoard, readBoardInState, readSeenBoard, restoreSeenBoard } from './goalState'

/** The note on the changes from the board `before` the model saw to the board `after`. */
type GoalChanges = { note: string; before: Board | null; after: Board }

export const addOpenGoalsAfterCompaction: MatchedHook<
  'classic.SessionStart',
  { source: typeof COMPACTION_SOURCE }
> = async ($, e, next) => {
  const ran = await next(e)
  if (!isMainConversation({ agentId: e.agent_id })) {
    return ran
  }
  const sessionId = await $.session.id()
  const board = await readBoardToRemind($, sessionId)
  if (board === undefined) {
    return ran
  }
  const { texts } = await listOpenGoals($, sessionId, board, describeOpenGoalsAfterCompaction)

  return texts.length === 0
    ? ran
    : { ...ran, additionalContext: [...(ran.additionalContext ?? []), ...texts] }
}

// The note is taken once the tool ran, so no hook beneath can drop it, and nothing is restored.
export const addGoalChangesToToolResult: MatchedHook<'tool.call', EveryEvent> = ($, e, next) =>
  callToolWithNote(e, next, async () => (await takeGoalChanges($, await $.session.id()))?.note)

// A command may run without the model, so the note waits for the next prompt that is sent to the
// model. The plugin's own prompts take the note too, since the model reads them as well.
export const submitWithGoalChanges: MatchedHook<'prompt.submit', EveryEvent> = async (
  $,
  e,
  next,
) => {
  const sessionId = await $.session.id()
  const changes = e.command === undefined ? await takeGoalChanges($, sessionId) : undefined
  if (changes === undefined) {
    return next(e)
  }
  const delivery = await submitWithNote(e, next, changes.note).catch(async (error: unknown) => {
    await restoreSeenBoard($, sessionId, changes.before, changes.after)
    throw error
  })
  if (!delivery.isAccepted) {
    await restoreSeenBoard($, sessionId, changes.before, changes.after)
  }

  return delivery.result
}

/**
 * Records the board in the state as seen by the model of the session `sessionId`, and returns the
 * note on the goals added or cleared since the model saw the board before. A model that saw no
 * board yet is given the open goals.
 */
async function takeGoalChanges(
  $: EngineInterface,
  sessionId: string,
): Promise<GoalChanges | undefined> {
  const inState = await readBoardInState($)
  if (inState?.outcome !== Outcome.Read) {
    return undefined
  }
  const { board } = inState
  if (describeChanges(await readSeenBoard($, sessionId), board) === undefined) {
    return undefined
  }
  const before = await exchangeSeenBoard($, sessionId, board)
  const note = describeChanges(before, board)

  return note === undefined ? undefined : { note, before, after: board }
}

/** The note on the changes from the board `seen` to `board`, or the open goals without `seen`. */
function describeChanges(seen: Board | null, board: Board): string | undefined {
  return seen === null ? describeOpenGoalsAfterCompaction(board) : describeGoalChanges(seen, board)
}
