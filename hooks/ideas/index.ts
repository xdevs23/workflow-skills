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
import { setGoalClearedHook } from '../goals/goalClearedHooks'
import { setGoalsImportedHook } from '../goals/goalImportedHooks'
import { denyFailedHook } from '../hookFailure'
import { registerDeclaredTools } from '../pluginTools'
import type { DeclaredToolSpecs, PluginTools } from '../pluginTools'
import type { PromptFooter } from '../promptFooter'
import {
  relinkIdeasOfImportedGoals,
  repairIdeasOfClearedGoals,
  unlinkIdeasOfJustClearedGoal,
} from './ideaActions'
import {
  GET_IDEAS_TOOL,
  IDEAS_FEATURE,
  IDEAS_PANE_SITE,
  RECORD_IDEA_TOOL,
  UNLINK_IDEAS_TOOL,
} from './ideaNames'
import {
  describeIdeasOfClearedGoalsNotUnlinked,
  describeIdeasOfImportedGoalsNotRelinked,
} from './ideaPaneTexts'
import { IDEAS_BUTTON, openIdeasFromButton } from './ideasButton'
import { drawIdeasPane } from './ideasPane'
import { IDEAS_SUBJECT } from './ideaTexts'
import {
  IDEA_TOOL_SPECS,
  getIdeas,
  recordIdea,
  unlinkIdeasOfEntry,
} from './ideaTools'

type StartIdeas = MatchedHook<'session.start', EveryEvent>

/**
 * Registers the idea tools declared in `declaredTools` at the start of a session, unlinks the ideas
 * recorded for each goal the user cleared, at the start and after each clear, and links the ideas
 * recorded for each goal the user imports to the imported goal.
 */
async function startIdeas(
  $: EngineInterface,
  e: Parameters<StartIdeas>[1],
  next: Parameters<StartIdeas>[2],
  declaredTools: DeclaredToolSpecs,
): Promise<Awaited<ReturnType<StartIdeas>>> {
  setGoalClearedHook(IDEAS_FEATURE, {
    run: () => unlinkIdeasOfJustClearedGoal($),
    describeFailure: (_goal, message) => describeIdeasOfClearedGoalsNotUnlinked(message),
  })
  setGoalsImportedHook(IDEAS_FEATURE, {
    run: imported => relinkIdeasOfImportedGoals($, imported),
    describeFailure: describeIdeasOfImportedGoalsNotRelinked,
  })
  await registerDeclaredTools($, declaredTools)
  await repairIdeasOfClearedGoals($)

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
 * Declares the idea tools in `tools` and registers them at the start of each session, registers the
 * hooks that handle calls to the idea tools and draw the Ideas pane, and places the Ideas button on
 * the prompt footer `footer`.
 */
export function registerIdeas(on: On, footer: PromptFooter, tools: PluginTools): void {
  const ideaToolSpecs = tools.declare(IDEA_TOOL_SPECS)
  on('session.start', EVERY_EVENT, ($, e, next) => startIdeas($, e, next, ideaToolSpecs))
  on('tool.call', { tool: RECORD_IDEA_TOOL }, recordIdea).catch(denyIdeaToolFailure)
  on('tool.call', { tool: GET_IDEAS_TOOL }, getIdeas).catch(denyIdeaToolFailure)
  on('tool.call', { tool: UNLINK_IDEAS_TOOL }, unlinkIdeasOfEntry).catch(denyIdeaToolFailure)
  on('ui.render', IDEAS_PANE_SITE, drawIdeasPane)
  on('ui.press', footer.place(IDEAS_BUTTON), openIdeasFromButton)
}
