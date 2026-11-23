import type { EngineInterface } from 'claude-code'

import { Outcome } from '../goals/board'
import { readBoardOfSession } from '../goals/goalActions'
import { describeOpenGoalsList } from '../goals/goalReminders'
import { describeOpenGoalsUnknown } from './roastTexts'

export async function listOpenGoalsForRoast($: EngineInterface): Promise<string | undefined> {
  const read = await readBoardOfSession($, await $.session.id())
  if (read.outcome !== Outcome.Read) {
    $.ui.log(describeOpenGoalsUnknown(read.failure), { to: 'debug' })

    return undefined
  }

  return describeOpenGoalsList(read.board, await $.clock.now())
}
