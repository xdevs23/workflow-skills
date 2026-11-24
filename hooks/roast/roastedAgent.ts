import type { AgentInfo } from 'claude-code'

/** A subagent of an agent type registered with the roaster, as the engine lists it. */
export type RoastedAgent = Readonly<Pick<AgentInfo, 'id' | 'type' | 'description'>>

/** What made the roaster roast the work of a subagent. */
export enum AgentRoastTrigger {
  /** The subagent was idle for IDLE_WAIT_SECONDS, in a session with the idle roast switched on. */
  Idle = 'idle',
  /** A compaction started that puts a summary in place of the conversation of the subagent. */
  Compaction = 'compaction',
}
