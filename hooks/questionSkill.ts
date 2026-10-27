import type { EngineInterface } from 'claude-code'

import { QUESTION_SKILL } from './names'
import { readLoadedSkills } from './skillLoads'

/**
 * Whether the Skill tool loaded QUESTION_SKILL in the main conversation. The conversation is read
 * in the api form of the next request, where the summary of the last compaction replaces the
 * messages summarized by it.
 */
export async function hasLoadedQuestionSkill($: EngineInterface): Promise<boolean> {
  return readLoadedSkills(await $.session.messages({ as: 'api' })).has(QUESTION_SKILL)
}
