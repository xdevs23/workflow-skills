import type { MatchedHook, On, PromptComposeSection } from 'claude-code'

import { EVERY_EVENT } from './everyEvent'
import type { EveryEvent } from './everyEvent'
import { PLUGIN } from './names'

const QUESTION_RULE: PromptComposeSection = {
  id: `${PLUGIN}:question-is-not-instruction`,
  text:
    'A question from the user that only asks for information is not an instruction: answer ' +
    'it, and do not act on it.',
  scope: 'shared',
}

export function registerQuestionRule(on: On): void {
  on('prompt.compose', EVERY_EVENT, prependQuestionRule)
}

const prependQuestionRule: MatchedHook<'prompt.compose', EveryEvent> = async (_$, e, next) => {
  const { sections } = await next(e)

  return { sections: [QUESTION_RULE, ...sections] }
}
