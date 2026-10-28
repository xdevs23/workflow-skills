import { mock } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type {
  ApiMessage,
  On,
  PromptSubmitInput,
  RenderPropsOf,
  TurnCompleteReason,
} from 'claude-code'

import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, PLUGIN, QUESTION_SKILL } from './names'
import { storeKeyOf } from './questionStore'

export const TURN = 'turn-1'

const ROOT = '/work/project'
export const FIRST_SESSION = 'session-1'
export const SECOND_SESSION = 'session-2'
/** The context size of a session when it starts and loads the question skill. */
export const TOKENS_AT_START = 1000

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Questions',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

const BAND_PROPS: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
}

// The kit stops a test after five seconds unless told otherwise. These tests end once the work
// they start has settled, so they disable the time limit.
export const NO_TIME_LIMIT = { timeoutMs: Number.POSITIVE_INFINITY }

/**
 * Replaces the engine beneath the plugin for prompts, and returns the prompts the engine receives.
 * A prompt for which `dropOf` returns a reason is dropped with that reason.
 */
export function recordPrompts(
  on: On,
  dropOf: (prompt: PromptSubmitInput) => string | undefined = () => undefined,
): PromptSubmitInput[] {
  const prompts: PromptSubmitInput[] = []
  on('prompt.submit', ($, e) => {
    prompts.push(e)
    const drop = dropOf(e)
    if (drop !== undefined) {
      return { drop }
    }

    return e.context === undefined ? { text: e.text } : { text: e.text, context: e.context }
  })

  return prompts
}

export function typePrompt($: Engine, text: string) {
  return $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false })
}

/** Ends the turn TURN of the main conversation, or of the subagent `agentId`, with `answer`. */
export function endTurn(
  $: Engine,
  turn: {
    answer?: string
    reason?: Exclude<TurnCompleteReason, 'refusal'>
    agentId?: string
  } = {},
) {
  const reason = turn.reason ?? 'answer'

  return $.turn.complete({
    answer: turn.answer ?? '',
    durationMs: 5,
    isAborted: reason === 'aborted',
    turnId: TURN,
    reason,
    ...(turn.agentId === undefined ? {} : { agentId: turn.agentId }),
  })
}

/** What the engine beneath the plugin saw, and the switches that change how it answers. */
export type Session = {
  id: string
  clock: MockClock
  store: Map<string, unknown>
  prompts: PromptSubmitInput[]
  panes: string[]
  toasts: string[]
  logs: string[]
  /** The messages in the main conversation seen by the model, in the api form. */
  context: ApiMessage[]
  /** The input tokens counted for the last response, as `session.usage` reports them. */
  contextTokens: number | undefined
  /** Whether the Skill tool reports an error for the next call. */
  isSkillFailing: boolean
  /** Whether a hook beneath the plugin denies the next Skill tool call. */
  isSkillDenied: boolean
  /** The lines written into the chat history. Lines sent only to the debug log are left out. */
  chatLines: string[]
  registered: string[]
  /**
   * The number of the session for which the host stores the state of the plugin, counted up at
   * every switch to another session and at every start of a process.
   */
  stateHolder: number
  /** The number of the session that wrote each key of the state of the plugin last. */
  stateWriters: Map<string, number>
  /** The error that the store returns when its keys are listed. */
  keysRefusal: string | undefined
  /** The reasons the store refuses its next writes with, one write each. */
  refusedWrites: string[]
  /** Runs once before the next write of the store, as another session writing at that moment. */
  beforeNextWrite: (() => void) | undefined
  /** The reason the engine drops the next prompt of the plugin with. */
  droppedPrompt: string | undefined
}

/**
 * Replaces the engine beneath the plugin with hooks that answer as the engine does, then starts
 * the session in which the plugin registers its tools.
 */
export async function startSession(
  $: Engine,
  on: On,
  options: {
    stored?: ReadonlyMap<string, unknown>
    isInteractive?: boolean
    /** Whether the host stores the state of the plugin across a switch to another session. */
    isStateKept?: boolean
  } = {},
): Promise<Session> {
  const session: Session = {
    id: FIRST_SESSION,
    clock: mock.clock(on, { now: 1000 }),
    store: new Map(options.stored),
    prompts: recordPrompts(on, prompt => {
      const drop = prompt.origin.kind === 'plugin' ? session.droppedPrompt : undefined
      session.droppedPrompt = undefined

      return drop
    }),
    panes: [],
    toasts: [],
    logs: [],
    context: skillLoad(QUESTION_SKILL),
    contextTokens: TOKENS_AT_START,
    isSkillFailing: false,
    isSkillDenied: false,
    chatLines: [],
    registered: [],
    stateHolder: 0,
    stateWriters: new Map(),
    keysRefusal: undefined,
    refusedWrites: [],
    beforeNextWrite: undefined,
    droppedPrompt: undefined,
  }
  // The host stores the state of the plugin for each session. A session that a switch or a new
  // process brings does not read the values written before, unless the test sets `isStateKept`.
  on('state.get', { plugin: PLUGIN }, async ($, e, next) => {
    const held = await next(e)
    const isHeld = session.stateWriters.get(e.key) === session.stateHolder
    if (held.value === undefined || isHeld || options.isStateKept === true) {
      return held
    }

    return { value: { value: undefined, version: held.value.version } }
  })
  on('state.set', { plugin: PLUGIN }, ($, e, next) => {
    session.stateWriters.set(e.key, session.stateHolder)

    return next(e)
  })
  on('session.id', () => ({ value: session.id }))
  // The hook returns the main conversation for the api form and an empty list for the rows form.
  on('session.messages', ($, e) => ({ value: e.as === 'api' ? session.context : [] }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context:
        session.contextTokens === undefined
          ? { window: 1_000_000 }
          : { tokens: session.contextTokens, window: 1_000_000 },
      rateLimits: [],
    },
  }))
  on('store.keys', () =>
    session.keysRefusal === undefined
      ? { value: [...session.store.keys()] }
      : { deny: session.keysRefusal },
  )
  on('store.get', ($, e) => ({ value: session.store.get(e.key) }))
  on('store.delete', ($, e) => {
    session.store.delete(e.key)

    return { value: undefined }
  })
  on('store.set', ($, e) => {
    const refusal = session.refusedWrites.shift()
    if (refusal !== undefined) {
      return { deny: refusal }
    }
    const beforeWrite = session.beforeNextWrite
    session.beforeNextWrite = undefined
    beforeWrite?.()
    session.store.set(e.key, structuredClone(e.value))

    return { value: undefined }
  })
  on('tool.register', ($, e) => {
    session.registered.push(e.name)

    return { value: { tool: `mcp__${PLUGIN}__${e.name}` } }
  })
  on('command.register', ($, e) => {
    session.registered.push(e.name)

    return { value: { command: e.name } }
  })
  on('ui.open', ($, e) => {
    session.panes.push(e.id)

    return { value: { isPlaced: true } }
  })
  on('ui.toast', ($, e) => {
    session.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.log', ($, e) => {
    session.logs.push(e.text)
    if (e.to !== 'debug') {
      session.chatLines.push(e.text)
    }

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('classic.SessionStart', () => ({}))
  // The engine draws nothing of its own above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', { tool: 'Read' }, () => ({ result: 'the file' }))
  on('tool.call', { tool: 'Skill' }, () => {
    if (session.isSkillDenied) {
      return { deny: 'The Skill tool is not allowed' }
    }

    return session.isSkillFailing
      ? { result: 'Unknown skill', isError: true }
      : { result: 'Launching skill' }
  })
  await startProcess($, session, {
    id: FIRST_SESSION,
    source: 'startup',
    ...(options.isInteractive === undefined ? {} : { isInteractive: options.isInteractive }),
  })
  await callSkillTool($, QUESTION_SKILL)

  return session
}

/** A tool call and its result as the api form contains them. */
export function toolCall(call: {
  tool: string
  input: Record<string, string>
  isFailed: boolean
  resultOf?: string
}): ApiMessage[] {
  const id = `call-${call.tool}`

  return [
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name: call.tool, input: call.input }],
    },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: call.resultOf ?? id,
          content: 'the result',
          is_error: call.isFailed,
        },
      ],
    },
  ]
}

/** Calls the Skill tool for `skill`, as the model in the main conversation or in `agentId` does. */
export function callSkillTool($: Engine, skill: string, agentId?: string) {
  return $.tool.call({ tool: 'Skill', skill, ...(agentId === undefined ? {} : { agentId }) })
}

/** The number of questions of the session in the store, leaving out the other records. */
export function questionCountOf(session: Session): number {
  const prefix = storeKeyOf(session.id, '')

  return [...session.store.keys()].filter(key => key.startsWith(prefix)).length
}

export function skillLoad(skill: string): ApiMessage[] {
  return toolCall({ tool: 'Skill', input: { skill }, isFailed: false })
}

/**
 * Switches the process to the session `id` as /resume or /clear does by the mod API: the session
 * that ends raises its end with the reason, the process goes on under the id without a start, and
 * the classic SessionStart hook runs with the reason as its source.
 */
export async function switchSession(
  $: Engine,
  session: Session,
  switched: { id: string; reason: 'resume' | 'clear' },
) {
  await $.session.end({ reason: switched.reason, sessionId: session.id, resume: { id: session.id } })
  session.id = switched.id
  session.stateHolder += 1
  await $.classic.SessionStart({ source: switched.reason, session_id: switched.id })
}

/**
 * Starts a process on the session `id`, as `claude` does for a new session and `claude --resume`
 * for an earlier one: the start is raised, then the classic SessionStart hook with the source.
 */
export async function startProcess(
  $: Engine,
  session: Session,
  started: { id: string; source: 'startup' | 'resume'; isInteractive?: boolean },
) {
  const isInteractive = started.isInteractive ?? true
  session.id = started.id
  session.stateHolder += 1
  await $.session.start({ cwd: ROOT, surface: isInteractive ? 'terminal' : null, isInteractive })
  await $.classic.SessionStart({ source: started.source, session_id: started.id })
}

export function askWhichDatabase($: Engine) {
  return $.tool.call({
    tool: ASK_TOOL,
    question: 'Which database?',
    choices: ['sqlite', 'postgres'],
  })
}

export function askAboutFriday($: Engine, agentId?: string) {
  return $.tool.call({
    tool: ASK_TOOL,
    question: 'Ship on Friday?',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

export async function listQuestions($: Engine): Promise<string> {
  return String((await $.tool.call({ tool: LIST_TOOL })).result)
}

export function readFile($: Engine, agentId?: string) {
  return $.tool.call({
    tool: 'Read',
    file_path: 'notes.md',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

export async function answerByCommand($: Engine, args: string): Promise<string> {
  const ran = await $.command.run({
    command: ANSWER_COMMAND,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

  return String(ran.text)
}

export function startTurn($: Engine, agentId?: string) {
  return $.turn.start({
    text: 'go on',
    turnId: TURN,
    ...(agentId === undefined ? {} : { agentId }),
  })
}

export function mountPane<Surface extends 'terminal' | 'desktop' | 'mobile'>(
  $: Engine,
  surface: Surface,
) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId: PANE,
    props: PANE_PROPS,
  })
}

export function mountBand($: Engine) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
}
