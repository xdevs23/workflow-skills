import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Board } from '../../types'
import { isMainConversation } from '../conversation'
import type { EveryEvent } from '../everyEvent'
import { callToolWithNote, submitWithNoteOrRestore } from '../sendToModel'
import type { COMPACTION_SOURCE } from '../sessionSources'
import { Outcome } from './board'
import { listOpenGoals, readBoardToRemind } from './goalReminderBoard'
import { describeGoalChangesSent, describeOpenGoalsAfterCompaction } from './goalReminders'
import type { GoalsSent } from './goalReminders'
import { exchangeSeenBoard, readBoardInState, readSeenBoard, restoreSeenBoard } from './goalState'
import { GOAL_TOOLS } from './goalTools'
import { withGoalsNotExhaustive } from './goalToolTexts'

/**
 * The changes from the board `before` the model saw to the board `after`. `note` is `text` ended by
 * `withGoalsNotExhaustive`.
 */
type GoalChanges = GoalsSent & { note: string; before: Board | null; after: Board }

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
  const { sent } = await listOpenGoals($, sessionId, board, describeOpenGoalsAfterCompaction)
  if (sent === undefined) {
    return ran
  }
  $.ui.log(sent.line)

  return { ...ran, additionalContext: [...(ran.additionalContext ?? []), sent.text] }
}

// The note is taken once the tool ran, so no hook beneath can drop it, and nothing is restored. The
// result of a goal tool ends with the sentence that the goals are not exhaustive, so the note to it
// goes without the sentence.
export const addGoalChangesToToolResult: MatchedHook<'tool.call', EveryEvent> = ($, e, next) =>
  callToolWithNote(e, next, async () => {
    const changes = await takeGoalChanges($, await $.session.id())
    if (changes === undefined) {
      return undefined
    }
    $.ui.log(changes.line)

    return GOAL_TOOLS.has(e.tool) ? changes.text : changes.note
  })

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
  const delivery = await submitWithNoteOrRestore(e, next, changes.note, () =>
    restoreSeenBoard($, sessionId, changes.before, changes.after),
  )
  if (delivery.isAccepted) {
    $.ui.log(changes.line)
  }

  return delivery.result
}

/**
 * Records the board in the state as seen by the model running the session `sessionId`, and returns
 * the goals added, edited, unmarked, prioritized, made dependent or cleared by the user since the
 * model saw the board before. A model that has not seen a board yet is given the open goals.
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
  // With nothing to send, the check writes no text and leaves the board seen as it is.
  if (describeGoalChangesSent(await readSeenBoard($, sessionId), board) === undefined) {
    return undefined
  }
  const before = await exchangeSeenBoard($, sessionId, board)
  const sent = describeGoalChangesSent(before, board)

  return sent === undefined
    ? undefined
    : { ...sent, note: withGoalsNotExhaustive(board, sent.text), before, after: board }
}
