import type { HookSubject } from '../hookFailure'
import { LEAD_AGENT } from '../leadAgent'
import { OR_LIST } from '../listFormat'
import type { TextWithLine } from '../sendToModel'
import { describeFailedRecordRead } from '../sessionRecord'
import type { FailedRecordRead } from '../sessionRecord'
import { describeFailedStoreCall } from '../storeFailures'
import type { FailedStoreCall } from '../storeFailures'
import {
  AGENT_MODES,
  AGENT_MODE_COMMAND,
  AgentMode,
  DEFAULT_AGENT_MODE,
  IMPLEMENT_SKILL,
  ORCHESTRATE_SKILL,
} from './agentModeNames'

/** How the main conversation works in each mode, addressed to the model. */
const WORK_IN_MODE: Record<AgentMode, string> = {
  [AgentMode.Single]:
    `${IMPLEMENT_SKILL} is not active. Unless the user asks for them, or grants work to a skill ` +
    'that needs them, you start no subagents and no workflows, write no entries of TODO.md, ' +
    'record no ideas and draw no drafts, and make the change yourself, whatever its size. This ' +
    'holds also where a tool description, hint or refusal of this plugin asks you for one of ' +
    'these things. Commit each change once it is fully done',
  [AgentMode.Orchestrator]:
    `you follow ${IMPLEMENT_SKILL}: the user asks for a feature, you draw a draft and show it, ` +
    'the user and you discuss and refine it, and then you mark the entry READY. Edit by hand a ' +
    `change so small or trivial that ${IMPLEMENT_SKILL} does not help with it`,
  [AgentMode.Swarm]:
    `you follow ${ORCHESTRATE_SKILL}: you hand every unit of work to a subagent of the type ` +
    `${LEAD_AGENT} and supervise it`,
}

/** How the main conversation works in each mode, for the person. */
const WORK_IN_MODE_FOR_PERSON: Record<AgentMode, string> = {
  [AgentMode.Single]:
    `Claude makes the change itself, without ${IMPLEMENT_SKILL}, and starts subagents and ` +
    'workflows, writes entries of TODO.md, records ideas and draws drafts only when you ask ' +
    'for them, and commits each change once it is fully done',
  [AgentMode.Orchestrator]: `Claude follows ${IMPLEMENT_SKILL}`,
  [AgentMode.Swarm]:
    'Claude hands every unit of work to a lead and supervises the leads, as ' +
    `${ORCHESTRATE_SKILL} describes`,
}

export const AGENT_MODE =
  [
    'The user sets how you, the main conversation of this session, work by choosing an agent ' +
      `mode with /${AGENT_MODE_COMMAND}.`,
    ...AGENT_MODES.map(mode => `In the mode ${mode}, ${WORK_IN_MODE[mode]}.`),
    'The agent mode applies only to the main conversation, and to no subagent or workflow agent ' +
      'it starts.',
    'The latest note on the agent mode in the conversation contains the mode that applies, and ' +
      `${DEFAULT_AGENT_MODE} applies while the conversation has no such note.`,
    `Only the user changes it, with /${AGENT_MODE_COMMAND}.`,
  ].join(' ')

export function describeAgentModeNote(mode: AgentMode): TextWithLine {
  return {
    text:
      `The agent mode set for this session is ${mode}: ${WORK_IN_MODE[mode]}. This note replaces ` +
      'every earlier note on the agent mode.',
    line: `Claude read that the agent mode set for this session is ${mode}.`,
  }
}

export function describeAgentModeNoteNotSent(reason: string): string {
  return (
    `Claude was not told the agent mode set for this session: ${reason}. Claude is told with the ` +
    'next tool result or message.'
  )
}

export const AGENT_MODE_DESCRIPTION =
  `Show or set how Claude works in this session, ${DEFAULT_AGENT_MODE} by default`

export const AGENT_MODE_ARGUMENT_HINT = `[${AGENT_MODES.join('|')}]`

export const AGENT_MODE_SUBJECT: HookSubject = {
  name: 'agent mode',
  checkBeforeRetry: `Run /${AGENT_MODE_COMMAND} to see the agent mode before you try again.`,
}

export const AGENT_MODE_LOST_WITHOUT_COMMAND =
  'In this session, you cannot set or show the agent mode. Claude keeps the mode the session ' +
  `had, ${DEFAULT_AGENT_MODE} for a new session.`

export const AGENT_MODE_NOT_TYPED_BY_USER =
  `/${AGENT_MODE_COMMAND} did not change the agent mode. Only /${AGENT_MODE_COMMAND} typed by ` +
  'the user changes it.'

export function describeAgentModeForPerson(mode: AgentMode): string {
  const others = AGENT_MODES.filter(other => other !== mode).map(
    other => `/${AGENT_MODE_COMMAND} ${other}`,
  )

  return (
    `This session works in the agent mode ${mode}: ${WORK_IN_MODE_FOR_PERSON[mode]}. Switch with ` +
    `${OR_LIST.format(others)}.`
  )
}

export function describeUnknownAgentModeWords(words: string): string {
  return (
    `/${AGENT_MODE_COMMAND} needs ${OR_LIST.format([...AGENT_MODES, 'nothing'])}, so ` +
    `"${words}" changes nothing.`
  )
}

export function describeAgentModeNotRead(read: FailedRecordRead): string {
  return (
    'The agent mode set for this session could not be read, so Claude works in the mode ' +
    `${DEFAULT_AGENT_MODE} until it is read. ${describeFailedRecordRead(read)}`
  )
}

export function describeAgentModeNotChanged(failed: FailedStoreCall): string {
  return `/${AGENT_MODE_COMMAND} did not change the agent mode. ${describeFailedStoreCall(failed)}`
}
