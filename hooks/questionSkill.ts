import type { EngineInterface, Frozen, ToolCallInput, ToolCallResult } from 'claude-code'

import { isMainConversation } from './conversation'
import { QUESTION_SKILL } from './names'
import {
  deleteQuestionSkillLoad,
  deleteQuestionSkillLoadsSavedBefore,
  readQuestionSkillLoad,
  saveQuestionSkillLoad,
} from './questionStore'
import { readLoadedSkills, readSkillName } from './skillLoads'

/**
 * A Skill tool call that loaded QUESTION_SKILL counts until this many tokens came into the context
 * after it. The limit keeps the rules of the skill recent in the context of a model that asks.
 */
export const QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD = 100_000

/**
 * A load record of another session is deleted at a load once it is this old, so the store does not
 * keep the records of sessions ended long ago. A session idle that long loads the skill again.
 */
export const QUESTION_SKILL_LOAD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Whether a load of QUESTION_SKILL counts for a question, and why it does not. */
export enum QuestionSkillLoadState {
  Counted = 'counted',
  NotInContext = 'not-in-context',
  NotRecorded = 'not-recorded',
  NoContextSize = 'no-context-size',
  OverLimit = 'over-limit',
}

/** A load of QUESTION_SKILL that does not count, with the tokens after it when over the limit. */
export type QuestionSkillDenial =
  | { state: QuestionSkillLoadState.OverLimit; tokensAfterLoad: number }
  | {
      state:
        | QuestionSkillLoadState.NotInContext
        | QuestionSkillLoadState.NotRecorded
        | QuestionSkillLoadState.NoContextSize
    }

export type QuestionSkillCheck = { state: QuestionSkillLoadState.Counted } | QuestionSkillDenial

/**
 * Saves the context size of the main conversation, in the input tokens counted for the last
 * response, as the load record of the session, when `call` loaded QUESTION_SKILL without an
 * error. A load by a subagent is left out, since the ask tool checks the main conversation only.
 */
export async function recordQuestionSkillLoad(
  $: EngineInterface,
  call: Frozen<ToolCallInput>,
  ran: ToolCallResult,
): Promise<void> {
  const isCounted =
    isMainConversation(call) &&
    ran.deny === undefined &&
    ran.isError !== true &&
    readSkillName(call) === QUESTION_SKILL
  if (!isCounted) {
    return
  }
  const [sessionId, contextTokens, savedAt] = await Promise.all([
    $.session.id(),
    readContextTokens($),
    $.clock.now(),
  ])
  if (contextTokens === undefined) {
    // An older size would judge this load, so the session is left without a record.
    await deleteQuestionSkillLoad($, sessionId)

    return
  }
  await saveQuestionSkillLoad($, sessionId, { contextTokens, savedAt })
  await deleteQuestionSkillLoadsSavedBefore($, savedAt - QUESTION_SKILL_LOAD_MAX_AGE_MS)
}

/**
 * Checks that the main conversation still contains a successful Skill tool call that loaded
 * QUESTION_SKILL, and that at most QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD tokens came into the
 * context after the load recorded for the session `sessionId`. The conversation is read in the api
 * form of the next request, where the summary of the last compaction replaces the messages
 * summarized by it.
 */
export async function checkQuestionSkillLoad(
  $: EngineInterface,
  sessionId: string,
): Promise<QuestionSkillCheck> {
  const [context, load, contextTokens] = await Promise.all([
    $.session.messages({ as: 'api' }),
    readQuestionSkillLoad($, sessionId),
    readContextTokens($),
  ])
  if (!readLoadedSkills(context).has(QUESTION_SKILL)) {
    return { state: QuestionSkillLoadState.NotInContext }
  }
  if (load === undefined) {
    return { state: QuestionSkillLoadState.NotRecorded }
  }
  if (contextTokens === undefined) {
    return { state: QuestionSkillLoadState.NoContextSize }
  }
  const tokensAfterLoad = contextTokens - load.contextTokens
  // A context smaller than at the load shrank after it, by a compaction that kept the Skill tool
  // call or by a rewind, so the recorded size does not measure the tokens that came after the load.
  if (tokensAfterLoad < 0) {
    return { state: QuestionSkillLoadState.NotRecorded }
  }

  return tokensAfterLoad <= QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD
    ? { state: QuestionSkillLoadState.Counted }
    : { state: QuestionSkillLoadState.OverLimit, tokensAfterLoad }
}

/** The input tokens counted for the last response, undefined until the live window has one. */
async function readContextTokens($: EngineInterface): Promise<number | undefined> {
  return (await $.session.usage()).context.tokens
}
