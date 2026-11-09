import { mock } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type {
  AgentInfo,
  On,
  PromptSubmitInput,
  RenderPropsOf,
  SessionCompactTrigger,
  SessionMessage,
} from 'claude-code'

import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, PLUGIN, QUESTION_SKILL } from './names'
import type { StoreEngine } from './pluginStore'
import { storeKeyOf } from './questionStore'

export const TURN = 'turn-1'

/** The root of the project the session works in. */
export const PROJECT_ROOT = '/work/project'
export const FIRST_SESSION = 'session-1'
export const SECOND_SESSION = 'session-2'
export const SUBAGENT = 'agent-1'
/** The context size of a session when it starts and loads the question skill, in tokens. */
export const TOKENS_AT_START = 1000

/** The sentence that ends what the main conversation is sent on its goals while one is open. */
export const GOALS_NOT_EXHAUSTIVE =
  'The goals are not exhaustive. Requests from the conversation, entries in TODO.md and rules ' +
  'still apply. Continue working on tasks where you left off and keep working towards the goals.'

/** The conversation that a compaction replaces. */
const CONVERSATION_BEFORE_COMPACTION: readonly SessionMessage[] = [
  { role: 'user', text: 'Fix the login.', toolUses: [] },
]

/** The summary that the engine puts in place of a conversation that it compacts. */
const COMPACTION_SUMMARY: SessionMessage = {
  role: 'user',
  text: 'This session is being continued from a previous conversation.',
  toolUses: [],
}

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

/**
 * Replaces the engine beneath the plugin for prompts, and returns the prompts the engine receives.
 * A prompt for which `dropOf` returns a reason is dropped with that reason.
 */
function recordPrompts(
  on: On,
  dropOf: (prompt: PromptSubmitInput) => string | undefined,
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

/** Ends the turn TURN of the main conversation with `answer`, or interrupts it. */
export function endTurn($: Engine, turn: { answer?: string; reason?: 'answer' | 'aborted' } = {}) {
  const reason = turn.reason ?? 'answer'

  return $.turn.complete({
    answer: turn.answer ?? '',
    durationMs: 5,
    isAborted: reason === 'aborted',
    turnId: TURN,
    reason,
  })
}

/**
 * Raises the classic Stop hook for an end of a turn on `message`. By default the end is the first
 * end of a turn of the main conversation.
 */
export function stopTurn(
  $: Engine,
  stop: { message?: string; followsBlock?: boolean; agentId?: string } = {},
) {
  return $.classic.Stop({
    stop_hook_active: stop.followsBlock ?? false,
    ...(stop.message === undefined ? {} : { last_assistant_message: stop.message }),
    ...(stop.agentId === undefined ? {} : { agent_id: stop.agentId }),
  })
}

/** The store beneath the plugin, with the switches that change what it returns. */
export type StoreFake = {
  store: Map<string, unknown>
  /** The error returned by the store when its keys are listed. */
  keysRefusal: string | undefined
  /** The errors returned by the store for its next writes, one write each. */
  refusedWrites: string[]
  /** Runs once before the next write of the store, as another session writing at that moment. */
  beforeNextWrite: (() => void) | undefined
}

/** What the engine beneath the plugin saw, and the switches that change how it answers. */
export type Session = StoreFake & {
  id: string
  clock: MockClock
  prompts: PromptSubmitInput[]
  panes: string[]
  toasts: string[]
  logs: string[]
  /** The context size every model request reports, in tokens; null for one without usage. */
  contextTokens: number | null
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
  /** The reason the engine drops the next prompt of the plugin with. */
  droppedPrompt: string | undefined
  /** The subagents and teammates the engine lists. */
  agents: AgentInfo[]
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
    /** Whether the main conversation loads the question skill once the session started. */
    loadsQuestionSkill?: boolean
    /** Whether the host stores the state of the plugin across a switch to another session. */
    isStateKept?: boolean
  } = {},
): Promise<Session> {
  const session: Session = {
    ...storeFakeWith(options.stored),
    id: FIRST_SESSION,
    clock: mock.clock(on, { now: 1000 }),
    prompts: recordPrompts(on, prompt => {
      const drop = prompt.origin.kind === 'plugin' ? session.droppedPrompt : undefined
      session.droppedPrompt = undefined

      return drop
    }),
    panes: [],
    toasts: [],
    logs: [],
    contextTokens: TOKENS_AT_START,
    isSkillFailing: false,
    isSkillDenied: false,
    chatLines: [],
    registered: [],
    stateHolder: 0,
    stateWriters: new Map(),
    droppedPrompt: undefined,
    agents: [],
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
  on('session.root', () => ({ value: PROJECT_ROOT }))
  on('agent.list', () => ({ value: session.agents }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage:
        session.contextTokens === null
          ? null
          : {
              input_tokens: 10,
              cache_read_input_tokens: session.contextTokens - 15,
              cache_creation_input_tokens: 5,
              output_tokens: 1,
              model: e.model,
            },
    }
  })
  fakeStore(on, session)
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
  on('session.compact', () => ({ messages: [COMPACTION_SUMMARY] }))
  // The engine draws nothing of its own above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box' }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  // The engine allows every call that reaches the permission check.
  on('tool.check', () => ({ decision: 'allow' }))
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
  if (options.loadsQuestionSkill ?? true) {
    await loadQuestionSkill($)
  }

  return session
}

/** A store fake that contains `stored`, with every switch off. */
export function storeFakeWith(stored: ReadonlyMap<string, unknown> = new Map()): StoreFake {
  return {
    store: new Map(stored),
    keysRefusal: undefined,
    refusedWrites: [],
    beforeNextWrite: undefined,
  }
}

/** Replaces the store beneath the plugin with `fake`, read at every call. */
export function fakeStore(on: On, fake: StoreFake): void {
  on('store.keys', () => {
    const refusal = fake.keysRefusal

    return refusal === undefined ? { value: [...fake.store.keys()] } : { deny: refusal }
  })
  on('store.get', ($, e) => ({ value: fake.store.get(e.key) }))
  on('store.delete', ($, e) => {
    fake.store.delete(e.key)

    return { value: undefined }
  })
  on('store.set', ($, e) => {
    const refusal = writeToStoreFake(fake, e.key, e.value)

    return refusal === undefined ? { value: undefined } : { deny: refusal }
  })
}

/**
 * The calls on the engine made by the store code of the plugin, run on `fake` as the engine runs
 * them, with the wait of `clock` and a debug log whose lines go to `logs`. A test calls store code
 * directly with it, since the engine of the test kit does not offer the store and the clock.
 */
export function storeEngineOf(fake: StoreFake, clock: MockClock, logs: string[]): StoreEngine {
  return {
    store: {
      get: key => Promise.resolve(fake.store.get(key)),
      set: (key, value) => {
        const refusal = writeToStoreFake(fake, key, value)

        return refusal === undefined ? Promise.resolve() : Promise.reject(new Error(refusal))
      },
      delete: key => {
        fake.store.delete(key)

        return Promise.resolve()
      },
      keys: () => {
        const refusal = fake.keysRefusal

        return refusal === undefined
          ? Promise.resolve([...fake.store.keys()])
          : Promise.reject(new Error(refusal))
      },
    },
    clock: { sleep: ms => clock.sleep(ms) },
    ui: { log: text => void logs.push(text) },
  }
}

/** Writes `value` under `key` in `fake`, and returns the error of a refused write. */
function writeToStoreFake(fake: StoreFake, key: string, value: unknown): string | undefined {
  const refusal = fake.refusedWrites.shift()
  if (refusal !== undefined) {
    return refusal
  }
  const beforeWrite = fake.beforeNextWrite
  fake.beforeNextWrite = undefined
  beforeWrite?.()
  fake.store.set(key, structuredClone(value))

  return undefined
}

/** Calls the Skill tool for `skill`, as the model in the main conversation or in `agentId` does. */
export function callSkillTool($: Engine, skill: string, agentId?: string) {
  return $.tool.call({ tool: 'Skill', skill, ...(agentId === undefined ? {} : { agentId }) })
}

/**
 * Sends a model request of the loop of `agentId`, or of the main conversation, which reports the
 * context size of the session.
 */
export async function sendModelRequest($: Engine, agentId?: string) {
  const stream = $.turn.step({
    turnId: TURN,
    index: 0,
    model: 'claude-opus-5-5',
    messageCount: 1,
    ...(agentId === undefined ? {} : { agentId }),
  })
  while ((await stream.next()).done !== true) {
    // The response is read to its end, as the engine reads it.
  }
}

/** Loads the question skill in the main conversation, as its model does after a request. */
export async function loadQuestionSkill($: Engine) {
  await sendModelRequest($)

  return callSkillTool($, QUESTION_SKILL)
}

/** The number of questions of the session in the store, leaving out the other records. */
export function questionCountOf(session: Session): number {
  const prefix = storeKeyOf(session.id, '')

  return [...session.store.keys()].filter(key => key.startsWith(prefix)).length
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
  await $.session.start({
    cwd: PROJECT_ROOT,
    surface: isInteractive ? 'terminal' : null,
    isInteractive,
  })
  await $.classic.SessionStart({ source: started.source, session_id: started.id })
}

/** Raises the start of the session again, as a reload of the plugin does: the state is kept. */
export function reloadPlugin($: Engine) {
  return $.session.start({ cwd: PROJECT_ROOT, surface: 'terminal', isInteractive: true })
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

/** The notes read by the model in the result returned by the Read tool. */
export async function notesOfToolResult($: Engine, agentId?: string): Promise<readonly string[]> {
  return (await readFile($, agentId)).context ?? []
}

/** The prompts sent by the plugin itself. */
export function promptsOfPlugin(session: Session): string[] {
  return session.prompts.filter(prompt => prompt.origin.kind === 'plugin').map(({ text }) => text)
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

/**
 * Compacts the conversation of the agent `agentId`, or the main conversation, by `trigger`, as the
 * engine does, and returns the texts of the messages after the summary. Throws an error with the
 * reason given by a hook that skipped the compaction. Around the compaction of any agent, the
 * engine raises the classic SessionStart hook with the source compact, without the agent id.
 */
export async function compact(
  $: Engine,
  { trigger = 'auto', agentId }: { trigger?: SessionCompactTrigger; agentId?: string } = {},
): Promise<string[]> {
  await $.classic.SessionStart({ source: 'compact' })
  const compacted = await $.session.compact({
    trigger,
    messages: CONVERSATION_BEFORE_COMPACTION,
    ...(agentId === undefined ? {} : { agentId }),
  })
  if (compacted.skip !== undefined) {
    throw new Error(compacted.skip)
  }

  return compacted.messages.slice(1).map(({ text }) => text)
}

/** Mounts the pane with the id `requestId` of the plugin, the questions pane by default. */
export function mountPane<Surface extends 'terminal' | 'desktop' | 'mobile'>(
  $: Engine,
  surface: Surface,
  requestId: string = PANE,
) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface,
    component: 'Pane',
    requestId,
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
