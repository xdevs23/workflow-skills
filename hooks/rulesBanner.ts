import type { MatchedHook, On, PromptComposeSection } from 'claude-code'

import { EVERY_EVENT } from './everyEvent'
import type { EveryEvent } from './everyEvent'
import { PLUGIN } from './names'

const RULES_BANNER: PromptComposeSection = {
  id: `${PLUGIN}:rules-binding`,
  text:
    `The rules from ${PLUGIN} are binding and none of it is noise. DO NOT IGNORE THE ` +
    'RULES. Violating the rules harms productivity and frustrates the user, which causes real ' +
    `harm to a human. Thus, you must respect the rules, as ${PLUGIN} defines them. The ` +
    "user's words take precedence over the plugin (user words include their global CLAUDE.md, " +
    'the project instructions, chat messages)',
  scope: 'shared',
}

/** Registers the hook that opens every system prompt with the section on the rules. */
export function registerRulesBanner(on: On): void {
  on('prompt.compose', EVERY_EVENT, prependRulesBanner)
}

const prependRulesBanner: MatchedHook<'prompt.compose', EveryEvent> = async ($, e, next) => {
  const { sections } = await next(e)

  return { sections: [RULES_BANNER, ...sections] }
}
