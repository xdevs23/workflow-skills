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

const SECTIONS_ON_DOING_TASKS: readonly string[] = ['doing_tasks', 'lean_body', 'bare']

export function registerQuestionRule(on: On): void {
  on('prompt.compose', EVERY_EVENT, addQuestionRule)
}

const addQuestionRule: MatchedHook<'prompt.compose', EveryEvent> = async ($, e, next) => {
  const { sections } = await next(e)
  const sectionOnDoingTasks = sections.findIndex(section =>
    SECTIONS_ON_DOING_TASKS.includes(section.id),
  )
  if (sectionOnDoingTasks === -1) {
    $.ui.log(describeMissingSectionOnDoingTasks(e.traits), { to: 'debug' })
  }
  const position = sectionOnDoingTasks + 1

  return { sections: [...sections.slice(0, position), QUESTION_RULE, ...sections.slice(position)] }
}

function describeMissingSectionOnDoingTasks(traits: readonly string[]): string {
  return (
    `The system prompt has none of the sections ${SECTIONS_ON_DOING_TASKS.join(', ')} ` +
    `(traits: ${traits.join(', ')}), so the rule on questions opens the prompt.`
  )
}
