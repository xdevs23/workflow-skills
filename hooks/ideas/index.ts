import type {
  Caught,
  EngineInterface,
  Frozen,
  MatchedHook,
  On,
  ToolCallInput,
  ToolCallResult,
} from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { denyFailedHook } from '../hookFailure'
import { declarePluginTools } from '../pluginTools'
import type { PromptFooter } from '../promptFooter'
import { DELETE_IDEAS_TOOL, GET_IDEAS_TOOL, IDEAS_PANE_SITE, RECORD_IDEA_TOOL } from './ideaNames'
import { IDEAS_BUTTON, openIdeasFromButton } from './ideasButton'
import { drawIdeasPane } from './ideasPane'
import { IDEAS_SUBJECT } from './ideaTexts'
import {
  IDEA_TOOL_SPECS,
  deleteIdeasOfEntry,
  getIdeas,
  recordIdea,
  registerIdeaTools,
} from './ideaTools'

const startIdeas: MatchedHook<'session.start', EveryEvent> = async ($, e, next) => {
  await registerIdeaTools($)

  return next(e)
}

/** Denies the call of an idea tool whose hook failed, such as on a store that cannot be read. */
function denyIdeaToolFailure(
  $: EngineInterface,
  _e: Frozen<ToolCallInput>,
  next: Caught,
): ToolCallResult {
  return denyFailedHook($, IDEAS_SUBJECT, next.error)
}

/**
 * Registers the idea tools at the start of each session, the hooks that answer calls to the idea
 * tools and draw the Ideas pane, and places the Ideas button on the prompt footer `footer`.
 */
export function registerIdeas(on: On, footer: PromptFooter): void {
  declarePluginTools(IDEA_TOOL_SPECS)
  on('session.start', EVERY_EVENT, startIdeas)
  on('tool.call', { tool: RECORD_IDEA_TOOL }, recordIdea).catch(denyIdeaToolFailure)
  on('tool.call', { tool: GET_IDEAS_TOOL }, getIdeas).catch(denyIdeaToolFailure)
  on('tool.call', { tool: DELETE_IDEAS_TOOL }, deleteIdeasOfEntry).catch(denyIdeaToolFailure)
  on('ui.render', IDEAS_PANE_SITE, drawIdeasPane)
  on('ui.press', footer.place(IDEAS_BUTTON), openIdeasFromButton)
}
