import type { AgentInfo } from 'claude-code'

/** A subagent of an agent type registered with the roaster, as the engine lists it. */
export type RoastedAgent = Readonly<Pick<AgentInfo, 'id' | 'type' | 'description'>>
