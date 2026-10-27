import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { ApiMessage, On, PromptSubmitInput, RenderPropsOf } from 'claude-code'

import {
  ANSWER_COMMAND,
  ASK_TOOL,
  LIST_TOOL,
  PANE,
  PLUGIN,
  QUESTION_SKILL,
  WITHDRAW_TOOL,
} from './names'
import { describeQuestionSkillDenial } from './modelText'
import {
  QUESTION_SKILL_LOAD_MAX_AGE_MS,
  QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD,
  QuestionSkillLoadState,
} from './questionSkill'
import { projectDigestOf, questionSkillLoadKeyOf, storeKeyOf } from './questionStore'
import { NO_TIME_LIMIT, TURN, endTurn, recordPrompts, typePrompt } from './testSupport'
import { NUDGE } from './waitingNudge'

const ROOT = '/work/project'
const WORKTREE = '/work/project/.worktrees/feature'
const FIRST_SESSION = 'session-1'
const SECOND_SESSION = 'session-2'
const LOCK_REFUSAL = 'Lock file is already being held'
/** The context size of a session when it starts and loads the question skill. */
const TOKENS_AT_START = 1000

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Questions',
  isFocused: true,
  bodyColumns: 60,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

/** The summary left by a compaction in place of the messages replaced by it. */
const COMPACTION_SUMMARY: ApiMessage = {
  role: 'user',
  content: [
    {
      type: 'text',
      text: 'This session is being continued from a previous conversation. Summary: work on the API.',
    },
  ],
}

/** A message that mentions the question skill without loading it. */
const QUESTION_SKILL_NAMED: ApiMessage = {
  role: 'user',
  content: [{ type: 'text', text: `Load ${QUESTION_SKILL} before you ask.` }],
}

const BAND_PROPS: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
}

/** What the engine beneath the plugin saw, and the switches that change how it answers. */
type Session = {
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
   * Whether the host reports that the session has no scope until the plugin writes one. This is
   * the case assumed for a session that /resume switched to, because /resume raises no start. That
   * the host drops the scope there is not confirmed.
   */
  isScopeDropped: boolean
  /** The project root the engine returns, which a move into a worktree changes. */
  root: string
  /** The reason the engine returns in place of the project root. */
  rootRefusal: string | undefined
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
async function startSession(
  $: Engine,
  on: On,
  options: { stored?: ReadonlyMap<string, unknown>; isInteractive?: boolean } = {},
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
    isScopeDropped: false,
    root: ROOT,
    rootRefusal: undefined,
    refusedWrites: [],
    beforeNextWrite: undefined,
    droppedPrompt: undefined,
  }
  on('state.get', { plugin: PLUGIN, key: 'session' }, ($, e, next) =>
    session.isScopeDropped ? { value: { value: undefined, version: 0 } } : next(e),
  )
  on('state.set', { plugin: PLUGIN, key: 'session' }, ($, e, next) => {
    session.isScopeDropped = false

    return next(e)
  })
  on('session.root', () =>
    session.rootRefusal === undefined ? { value: session.root } : { deny: session.rootRefusal },
  )
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
  on('store.keys', () => ({ value: [...session.store.keys()] }))
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
  await startAgain($, options.isInteractive ?? true)
  await callSkillTool($, QUESTION_SKILL)

  return session
}

/** A tool call and its result as the api form contains them. */
function toolCall(call: {
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
function callSkillTool($: Engine, skill: string, agentId?: string) {
  return $.tool.call({ tool: 'Skill', skill, ...(agentId === undefined ? {} : { agentId }) })
}

/** The number of questions in the store, leaving out the other records of the plugin. */
async function questionCountOf(session: Session): Promise<number> {
  const prefix = storeKeyOf(await projectDigestOf(ROOT), '')

  return [...session.store.keys()].filter(key => key.startsWith(prefix)).length
}

/** Removes the load record of the session, as for a load never seen by the plugin. */
function forgetQuestionSkillLoad(session: Session) {
  session.store.delete(questionSkillLoadKeyOf(session.id))
}

function skillLoad(skill: string): ApiMessage[] {
  return toolCall({ tool: 'Skill', input: { skill }, isFailed: false })
}

function failedSkillLoad(skill: string): ApiMessage[] {
  return toolCall({ tool: 'Skill', input: { skill }, isFailed: true })
}

/**
 * Switches the process to another session as /resume is assumed to do: the session id changes, no
 * start is raised, and the host has no scope for the session it switched to.
 */
function resumeAnother(session: Session, id: string) {
  session.id = id
  session.isScopeDropped = true
}

/** Raises the start of a session, as a new session in the same project does. */
async function startAgain($: Engine, isInteractive = true) {
  await $.session.start({
    cwd: ROOT,
    surface: isInteractive ? 'terminal' : null,
    isInteractive,
  })
}

function askWhichDatabase($: Engine) {
  return $.tool.call({
    tool: ASK_TOOL,
    question: 'Which database?',
    choices: ['sqlite', 'postgres'],
  })
}

function askAboutFriday($: Engine, agentId?: string) {
  return $.tool.call({
    tool: ASK_TOOL,
    question: 'Ship on Friday?',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

async function listQuestions($: Engine): Promise<string> {
  return String((await $.tool.call({ tool: LIST_TOOL })).result)
}

function readFile($: Engine, agentId?: string) {
  return $.tool.call({
    tool: 'Read',
    file_path: 'notes.md',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

async function answerByCommand($: Engine, args: string): Promise<string> {
  const ran = await $.command.run({
    command: ANSWER_COMMAND,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

  return String(ran.text)
}

function startTurn($: Engine, agentId?: string) {
  return $.turn.start({
    text: 'go on',
    turnId: TURN,
    ...(agentId === undefined ? {} : { agentId }),
  })
}

function mountPane<Surface extends 'terminal' | 'desktop' | 'mobile'>(
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

function mountBand($: Engine) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND_PROPS,
  })
}

describe('asking without waiting', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(
      `an answer picked on the ${surface} while idle is sent to the model as a prompt`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on)
        expect((await askWhichDatabase($)).deny).toBeUndefined()
        const pane = await mountPane($, surface)
        await pane.select({ key: 'pick-1', value: 'sqlite' })
        await session.clock.settle()

        expect(session.prompts).toHaveLength(1)
        expect(session.prompts[0]?.text).toContain('sqlite')
        expect(session.prompts[0]?.origin).toMatchObject({ kind: 'plugin', asUser: true })
        expect((await readFile($)).context).toBeUndefined()
      },
    )
  }

  test(
    'an asked question is written into the chat history with its number and choices',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)

      expect(session.chatLines).toEqual([
        'Question #1 (choices: sqlite / postgres): Which database?',
        'Question #2: Ship on Friday?',
      ])
    },
  )

  test(
    'an answer given during a turn is added to the next tool result once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 postgres')

      expect((await readFile($)).context?.join('\n')).toContain('postgres')
      expect((await readFile($)).context).toBeUndefined()
      await endTurn($)
      await session.clock.settle()
      expect(session.prompts).toHaveLength(0)
    },
  )

  test(
    'an answer given during a turn that finishes without reading a tool result goes out when ' +
      'the turn ends',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      const pane = await mountPane($, 'terminal')
      await pane.input({ key: 'answer-1', text: 'neither, keep the files' })
      await session.clock.settle()

      expect(session.prompts).toHaveLength(0)
      await endTurn($)
      await session.clock.settle()
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.text).toContain('neither, keep the files')
    },
  )

  test(
    'an answer given during a turn the user interrupts is sent with the next prompt of the user',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      await endTurn($, { reason: 'aborted' })
      await session.clock.settle()

      expect(session.prompts).toHaveLength(0)
      await typePrompt($, 'go on')
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
      expect((await readFile($)).context).toBeUndefined()
    },
  )

  test(
    'an answer whose prompt the engine drops is added to the next tool result',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.droppedPrompt = 'a hook stopped it'
      await answerByCommand($, '1 sqlite')
      await session.clock.settle()

      expect(session.prompts).toHaveLength(1)
      expect(session.toasts.join('\n')).toContain('a hook stopped it')
      expect((await readFile($)).context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'a subagent reads no answer, and its turns leave the session idle',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 postgres')

      expect((await readFile($, 'agent-1')).context).toBeUndefined()
      expect((await readFile($)).context?.join('\n')).toContain('postgres')
      await endTurn($)
      await startTurn($, 'agent-1')
      await askAboutFriday($)
      await answerByCommand($, '2 yes')
      await session.clock.settle()
      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.text).toContain('yes')
    },
  )

  test(
    'the list contains open questions and answers, and the band opens the pane',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)
      const band = await mountBand($)
      await band.press({ key: 'answer' })
      await answerByCommand($, '#2 next week')
      await session.clock.settle()
      const listed = await listQuestions($)

      expect(session.panes).toEqual([PANE])
      expect(listed).toContain('Which database?')
      expect(listed).toContain('next week')
    },
  )

  test('the answer command lists, answers and explains its form', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    await askWhichDatabase($)

    const listed = await answerByCommand($, '')
    expect(listed).toContain('Which database?')
    expect(listed).toContain(`/${ANSWER_COMMAND} <number> <answer>`)
    expect(session.panes).toEqual([PANE])
    expect(await answerByCommand($, 'sqlite')).toContain(`/${ANSWER_COMMAND} <number>`)
    expect(await answerByCommand($, '9 sqlite')).toContain('#9')
    expect(await answerByCommand($, '9 sqlite')).not.toContain('Answered')
    expect(await answerByCommand($, '1 sqlite')).toContain('Answered')
    expect(await answerByCommand($, '1 postgres')).not.toContain('Answered')
  })

  test(
    'the pane on a surface without input fields still draws every question',
    NO_TIME_LIMIT,
    async ($, on) => {
      await startSession($, on)
      await askWhichDatabase($)
      const pane = await mountPane($, 'mobile')

      expect(await pane.find({ type: 'Text', text: /Which database/ })).toBeDefined()
    },
  )

  test(
    'a second session finds the questions of the first, and only the first reads the answers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.id = SECOND_SESSION
      await startAgain($)
      await callSkillTool($, QUESTION_SKILL)

      expect(await listQuestions($)).toContain('Which database?')
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      expect((await readFile($)).context).toBeUndefined()
      await askAboutFriday($)
      expect(await listQuestions($)).toContain('#2')
      session.id = FIRST_SESSION
      await startAgain($)
      expect((await readFile($)).context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'a session that /resume switched to uses the tools as itself',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      resumeAnother(session, SECOND_SESSION)
      await callSkillTool($, QUESTION_SKILL)

      expect(await listQuestions($)).toContain('Which database?')
      expect((await askAboutFriday($)).deny).toBeUndefined()
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeDefined()
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 2 })).deny).toBeUndefined()
    },
  )

  test(
    'a session that /clear switched to does not use the answers given in the session before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.id = SECOND_SESSION
      await callSkillTool($, QUESTION_SKILL)
      await startTurn($)
      await answerByCommand($, '1 sqlite')

      expect((await readFile($)).context).toBeUndefined()
      expect((await askAboutFriday($)).deny).toBeUndefined()
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 2 })).deny).toBeUndefined()
    },
  )

  test(
    'the first prompt typed after /resume switched back carries the answers given meanwhile',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      resumeAnother(session, SECOND_SESSION)
      await answerByCommand($, '1 sqlite')
      resumeAnother(session, FIRST_SESSION)
      await typePrompt($, 'go on')

      expect(session.prompts).toHaveLength(1)
      expect(session.prompts[0]?.context?.join('\n')).toContain('sqlite')
    },
  )

  test(
    'the band and the pane of a session that /resume switched to answer as that session',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      resumeAnother(session, SECOND_SESSION)
      const band = await mountBand($)
      await band.press({ key: 'answer' })
      const pane = await mountPane($, 'terminal')
      await pane.input({ key: 'answer-1', text: 'sqlite' })

      expect(session.panes).toEqual([PANE])
      expect(session.toasts).toEqual([])
      expect(await listQuestions($)).toContain('Answer: sqlite')
    },
  )

  test(
    'a session that /clear switched to after a move into a worktree uses the project before',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.root = WORKTREE
      session.id = SECOND_SESSION

      expect(await listQuestions($)).toContain('#1: Which database?')
    },
  )

  test(
    'a session that /resume switched to after a move into a worktree with the scope dropped ' +
      'asks in the project of the worktree',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      session.root = WORKTREE
      resumeAnother(session, SECOND_SESSION)
      await callSkillTool($, QUESTION_SKILL)
      await askAboutFriday($)
      const worktreeKeys = storeKeyOf(await projectDigestOf(WORKTREE), '')

      expect(await listQuestions($)).not.toContain('Which database?')
      expect([...session.store.keys()].filter(key => key.startsWith(worktreeKeys))).toHaveLength(1)
    },
  )

  test(
    'a scope that cannot be set makes the tools fail with the reason, which the debug log shows too',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      resumeAnother(session, SECOND_SESSION)
      const refusal = 'the project root is unknown'
      session.rootRefusal = refusal

      expect((await askWhichDatabase($)).deny).toContain(refusal)
      expect((await $.tool.call({ tool: LIST_TOOL })).deny).toContain(refusal)
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toContain(refusal)
      expect(await answerByCommand($, '')).toContain(refusal)
      expect(session.logs.filter(line => line.includes(refusal))).toHaveLength(4)
    },
  )

  test(
    'a withdrawn question is closed for the user and listed as withdrawn',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await askAboutFriday($)

      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeUndefined()
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeDefined()
      expect(await answerByCommand($, '')).not.toContain('Which database?')
      expect(await answerByCommand($, '1 sqlite')).not.toContain('Answered')
      expect(await listQuestions($)).toMatch(/Withdrawn questions:\n#1: Which database\?/)
      const band = await mountBand($)
      expect(await band.find({ type: 'Text', text: /^1 open question/ })).toBeDefined()
      session.id = SECOND_SESSION
      await startAgain($)
      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 2 })).deny).toBeDefined()
      expect(await listQuestions($)).toMatch(/Open questions:\n#2: Ship on Friday\?/)
    },
  )

  test(
    'an answer given while the question is withdrawn is kept, and the withdrawal is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      const questionPrefix = storeKeyOf(await projectDigestOf(ROOT), '')
      const questionKey = [...session.store.keys()].find(key => key.startsWith(questionPrefix))
      const answerKey = `answers:${questionKey?.slice('questions:'.length)}:given-elsewhere`
      session.beforeNextWrite = () =>
        session.store.set(answerKey, { text: 'sqlite', answeredAt: 1000 })

      expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 1 })).deny).toBeDefined()
      expect(await listQuestions($)).toMatch(/Answered questions:\n#1: Which database\?\nAnswer: sqlite/)
    },
  )

  test(
    'two questions asked at the same moment get different numbers',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const digest = await projectDigestOf(ROOT)
      session.beforeNextWrite = () =>
        session.store.set(storeKeyOf(digest, 'asked-elsewhere'), {
          id: 'asked-elsewhere',
          number: 1,
          sessionId: SECOND_SESSION,
          text: 'Keep the old API?',
          choices: [],
          askedAt: 900,
        })

      expect(String((await askWhichDatabase($)).result)).toContain('#2')
      const [first, second] = await Promise.all([askAboutFriday($), askAboutFriday($)])
      expect(new Set([String(first.result), String(second.result)]).size).toBe(2)
    },
  )

  test('a store busy with another write is written again', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    session.refusedWrites.push(LOCK_REFUSAL)
    const asking = askWhichDatabase($)
    await session.clock.settle()
    await session.clock.advance(60_000)

    expect((await asking).deny).toBeUndefined()
    expect(await questionCountOf(session)).toBe(1)
    expect(session.toasts).toEqual([])
  })

  test('a write the store refuses is denied with its reason', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    session.refusedWrites.push('the store is over 4 MiB')

    expect((await askWhichDatabase($)).deny).toContain('the store is over 4 MiB')
    expect(await questionCountOf(session)).toBe(0)
    expect(session.chatLines).toEqual([])
  })

  test('input the model gives outside the schema fails the check', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)

    expect((await $.tool.call({ tool: ASK_TOOL, question: '  ' })).deny).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: ['only'] })).deny,
    ).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: ['a', 'a'] })).deny,
    ).toBeDefined()
    expect(
      (await $.tool.call({ tool: ASK_TOOL, question: 'Pick?', choices: [] })).deny,
    ).toBeDefined()
    expect((await $.tool.call({ tool: WITHDRAW_TOOL, number: 0 })).deny).toBeDefined()
    expect(session.chatLines).toEqual([])
  })

  test(
    'a store entry of another shape fails the check and is left unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      const key = storeKeyOf(await projectDigestOf(ROOT), 'damaged')
      const session = await startSession($, on, {
        stored: new Map([[key, { questions: 'not a list' }]]),
      })

      expect((await askWhichDatabase($)).deny).toContain(key)
      expect((await $.tool.call({ tool: LIST_TOOL })).deny).toContain(key)
      expect(session.store.get(key)).toEqual({ questions: 'not a list' })
      expect(await questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a session without a person at the prompt is given none of the tools',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isInteractive: false })

      expect(session.registered).toEqual([])
      expect((await askWhichDatabase($)).deny).toBeDefined()
      expect(await questionCountOf(session)).toBe(0)
    },
  )
})

describe('asking with the question skill in context', () => {
  const NOT_RECORDED = describeQuestionSkillDenial({ state: QuestionSkillLoadState.NotRecorded })

  test(
    'a question asked by a session that has not loaded the question skill is denied and not ' +
      'stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = []

      expect((await askWhichDatabase($)).deny).toBeDefined()
      expect(await questionCountOf(session)).toBe(0)
      expect(session.chatLines).toEqual([])
    },
  )

  const notLoaded: [string, () => ApiMessage[]][] = [
    ['another skill loaded by the Skill tool', () => skillLoad(`${PLUGIN}:writing-style`)],
    ['a Skill tool call for the question skill that failed', () => failedSkillLoad(QUESTION_SKILL)],
    ['a message that mentions the question skill', () => [QUESTION_SKILL_NAMED]],
    [
      'another tool called with the name of the question skill',
      () => toolCall({ tool: 'Read', input: { skill: QUESTION_SKILL }, isFailed: false }),
    ],
    [
      'a Skill tool call for the question skill without its result',
      () =>
        toolCall({
          tool: 'Skill',
          input: { skill: QUESTION_SKILL },
          isFailed: false,
          resultOf: 'call-other',
        }),
    ],
  ]
  for (const [contains, context] of notLoaded) {
    test(
      `a question asked from a context with ${contains} is denied`,
      NO_TIME_LIMIT,
      async ($, on) => {
        const session = await startSession($, on)
        session.context = context()

        expect((await askWhichDatabase($)).deny).toBeDefined()
        expect(await questionCountOf(session)).toBe(0)
      },
    )
  }

  test(
    'a question asked after a Skill tool call with spaces and a slash around the name is stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = skillLoad(` /${QUESTION_SKILL} `)

      expect((await askWhichDatabase($)).deny).toBeUndefined()
      expect(await questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question is denied once more tokens than the limit came into the context after the load ' +
      'of the question skill',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD
      expect((await askWhichDatabase($)).deny).toBeUndefined()
      session.contextTokens = TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD + 1

      expect((await askAboutFriday($)).deny).toBe(
        describeQuestionSkillDenial({
          state: QuestionSkillLoadState.OverLimit,
          tokensAfterLoad: QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD + 1,
        }),
      )
      expect(await questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question is denied when the plugin did not see a load of the question skill, although ' +
      'the context contains one',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a failed or denied Skill tool call, a load by a subagent and a load of another skill do ' +
      'not count as a load of the question skill',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)
      session.isSkillFailing = true
      await callSkillTool($, QUESTION_SKILL)
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      session.isSkillFailing = false
      session.isSkillDenied = true
      await callSkillTool($, QUESTION_SKILL)
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      session.isSkillDenied = false
      await callSkillTool($, QUESTION_SKILL, 'agent-1')
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      await callSkillTool($, `${PLUGIN}:writing-style`)

      expect((await askAboutFriday($)).deny).toBe(NOT_RECORDED)
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked after the question skill was loaded again is stored',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = 2 * (TOKENS_AT_START + QUESTION_SKILL_MAX_TOKENS_AFTER_LOAD)
      await callSkillTool($, ` /${QUESTION_SKILL}`)

      expect((await askWhichDatabase($)).deny).toBeUndefined()
      expect(await questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a load made while the engine does not report the context size removes the earlier record',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = undefined
      await callSkillTool($, QUESTION_SKILL)
      expect(session.store.has(questionSkillLoadKeyOf(session.id))).toBe(false)
      session.contextTokens = TOKENS_AT_START

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked while the engine does not report the context size is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = undefined

      expect((await askWhichDatabase($)).deny).toBe(
        describeQuestionSkillDenial({ state: QuestionSkillLoadState.NoContextSize }),
      )
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a question asked after a compaction kept the load in a smaller context is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.contextTokens = TOKENS_AT_START - 1

      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a load record of another shape fails the check and is left unchanged',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const key = questionSkillLoadKeyOf(session.id)
      for (const damaged of [{ contextTokens: 'many', savedAt: 1000 }, { contextTokens: 1000 }]) {
        session.store.set(key, damaged)

        expect((await askWhichDatabase($)).deny).toContain(key)
        expect(session.store.get(key)).toEqual(damaged)
      }
      expect(await questionCountOf(session)).toBe(0)
    },
  )

  test(
    'a load record the store refuses is shown with its reason, and the next question is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      forgetQuestionSkillLoad(session)
      session.refusedWrites.push('the store is over 4 MiB')
      await callSkillTool($, QUESTION_SKILL)

      expect(session.toasts).toHaveLength(1)
      expect(session.toasts[0]).toContain('the store is over 4 MiB')
      expect((await askWhichDatabase($)).deny).toBe(NOT_RECORDED)
    },
  )

  test(
    'a load deletes the load records of other sessions once they are older than the age limit',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      const firstKey = questionSkillLoadKeyOf(session.id)
      session.id = SECOND_SESSION
      await session.clock.advance(QUESTION_SKILL_LOAD_MAX_AGE_MS)
      await callSkillTool($, QUESTION_SKILL)
      expect(session.store.has(firstKey)).toBe(true)
      await session.clock.advance(1)
      await callSkillTool($, QUESTION_SKILL)

      expect(session.store.has(firstKey)).toBe(false)
      expect(session.store.has(questionSkillLoadKeyOf(SECOND_SESSION))).toBe(true)
    },
  )

  test(
    'a question asked after a compaction removed the question skill from context is denied',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      expect((await askWhichDatabase($)).deny).toBeUndefined()
      session.context = [COMPACTION_SUMMARY]

      expect((await askAboutFriday($)).deny).toBeDefined()
      expect(await questionCountOf(session)).toBe(1)
    },
  )

  test(
    'a question asked by a subagent is stored without a check of the main conversation',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      session.context = []

      expect((await askAboutFriday($, 'agent-1')).deny).toBeUndefined()
      expect(await questionCountOf(session)).toBe(1)
    },
  )
})

describe('the nudge together with the answers to the questions', () => {
  const WAITING = 'Your question about the database is still open.'
  const NUDGE_REFUSAL = 'The state of the plugin is not readable'

  test(
    'a typed prompt receives the nudge and the answers that wait, both once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      resumeAnother(session, SECOND_SESSION)
      await answerByCommand($, '1 sqlite')
      resumeAnother(session, FIRST_SESSION)
      await endTurn($, { answer: WAITING })
      await session.clock.settle()
      await typePrompt($, 'go on')
      await typePrompt($, 'go on')

      expect(session.prompts).toHaveLength(2)
      expect(session.prompts[0]?.context).toHaveLength(2)
      expect(session.prompts[0]?.context?.[0]).toBe(NUDGE)
      expect(session.prompts[0]?.context?.[1]).toContain('sqlite')
      expect(session.prompts[1]?.context).toBeUndefined()
    },
  )

  test(
    'a nudge that cannot be read leaves the answers and the next prompt going out without it',
    NO_TIME_LIMIT,
    async ($, on) => {
      on('state.get', { plugin: PLUGIN, key: 'nudgeDueInSession' }, () => ({
        deny: NUDGE_REFUSAL,
      }))
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 sqlite')
      await endTurn($, { answer: WAITING })
      await session.clock.settle()
      await typePrompt($, 'go on')

      expect(session.prompts).toHaveLength(2)
      expect(session.prompts[0]?.text).toContain('sqlite')
      expect(session.prompts[1]?.context).toBeUndefined()
      expect(session.logs.filter(line => line.includes(NUDGE_REFUSAL))).toHaveLength(2)
    },
  )
})
