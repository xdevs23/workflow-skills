import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptSubmitInput } from 'claude-code'

import type { RuleCheckerPrompts } from '../types'

export type SubmittedPrompt = Pick<PromptSubmitInput, 'text' | 'origin'>

const userPrompts = atom({ plugin: 'workflow-skills', key: 'ruleCheckerPrompts' } as const, {
  first: 0,
  prompts: [],
})

// The origins of a prompt that the user typed or sent.
const PERSON_ORIGINS: readonly SubmittedPrompt['origin']['kind'][] = ['composer', 'bridge', 'sdk']

// The prompts after one was submitted: with its text when the user typed or sent it.
export const withPrompt = (
  before: RuleCheckerPrompts,
  { text, origin }: SubmittedPrompt,
): RuleCheckerPrompts =>
  PERSON_ORIGINS.includes(origin.kind) && text.trim() !== ''
    ? { ...before, prompts: [...before.prompts, text] }
    : before

// The prompts after a check sent every prompt before `upTo` and the reply decoded. Prompts
// collected meanwhile are not removed, and a check that finishes after a later one removes nothing
// more.
export const withoutSent = (before: RuleCheckerPrompts, upTo: number): RuleCheckerPrompts => {
  const first = Math.max(before.first, upTo)

  return { first, prompts: before.prompts.slice(first - before.first) }
}

export function collectPrompt($: EngineInterface, submitted: SubmittedPrompt) {
  return update($, userPrompts, before => withPrompt(before, submitted))
}

// The prompts collected since the last successful check, and the number past the last of them.
export async function takePrompts($: EngineInterface) {
  const collected = await read($, userPrompts)

  return { prompts: collected.prompts, upTo: collected.first + collected.prompts.length }
}

export function removeSent($: EngineInterface, upTo: number) {
  return update($, userPrompts, before => withoutSent(before, upTo))
}
