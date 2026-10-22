import { describe, expect, test } from 'claude-code/testing'

import type { RuleCheckerPrompts } from '../types'
import { withoutSent, withPrompt } from './prompts.ts'
import type { SubmittedPrompt } from './prompts.ts'

const EMPTY: RuleCheckerPrompts = { first: 0, prompts: [] }

const typed = (...texts: string[]): SubmittedPrompt[] =>
  texts.map(text => ({ text, origin: { kind: 'composer' } }))

describe('the prompts', () => {
  test('are the prompts the user typed or sent and no other prompt', () => {
    const prompts: SubmittedPrompt[] = [
      { text: 'fix the parser', origin: { kind: 'composer' } },
      { text: 'from the phone', origin: { kind: 'bridge' } },
      { text: 'a notification', origin: { kind: 'task-notification' } },
      { text: ' ', origin: { kind: 'composer' } },
    ]

    expect(prompts.reduce(withPrompt, EMPTY).prompts).toEqual(['fix the parser', 'from the phone'])
  })

  test('lose only what a check sent, once', () => {
    const sentOne = withoutSent(typed('one', 'two').reduce(withPrompt, EMPTY), 1)
    const more = typed('three').reduce(withPrompt, sentOne)

    expect(withoutSent(more, 1)).toEqual(more)
    expect(withoutSent(more, 2)).toEqual({ first: 2, prompts: ['three'] })
  })
})
