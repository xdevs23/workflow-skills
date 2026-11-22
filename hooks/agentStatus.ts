import type { AgentStatus } from 'claude-code'

/** Where the loop of an agent stands, as far as the work of the session cares. */
enum LoopStage {
  NotStarted = 'not started',
  /** Taking a turn, or held on work that it owns. */
  Working = 'working',
  /** A teammate between turns, until a message wakes it. */
  BetweenTurns = 'between turns',
  /** Takes no more turns. */
  Ended = 'ended',
}

const STAGE_OF_STATUS: Record<AgentStatus, LoopStage> = {
  pending: LoopStage.NotStarted,
  running: LoopStage.Working,
  waiting: LoopStage.Working,
  idle: LoopStage.BetweenTurns,
  completed: LoopStage.Ended,
  failed: LoopStage.Ended,
  killed: LoopStage.Ended,
}

/** Whether an agent in `status` takes no more turns. */
export function hasStatusEnded(status: AgentStatus): boolean {
  return STAGE_OF_STATUS[status] === LoopStage.Ended
}

/** Whether an agent in `status` works on its task. */
export function isRunningStatus(status: AgentStatus): boolean {
  return STAGE_OF_STATUS[status] === LoopStage.Working
}
