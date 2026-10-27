import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import type { On, PromptSubmitInput, RenderPropsOf } from 'claude-code'

import { ANSWER_COMMAND, ASK_TOOL, LIST_TOOL, PANE, PLUGIN, WITHDRAW_TOOL } from './names'
import { projectDigestOf, storeKeyOf } from './questionStore'

const ROOT = '/work/project'
const FIRST_SESSION = 'session-1'
const SECOND_SESSION = 'session-2'
const TURN = 'turn-1'
const LOCK_REFUSAL = 'Lock file is already being held'

// The kit stops a test after five seconds unless told otherwise. These tests end once the work
// they start has settled, so they disable the time limit.
const NO_TIME_LIMIT = { timeoutMs: Number.POSITIVE_INFINITY }

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

/** What the engine beneath the plugin saw, and the switches that change how it answers. */
type Session = {
  id: string
  clock: MockClock
  store: Map<string, unknown>
  prompts: PromptSubmitInput[]
  panes: string[]
  toasts: string[]
  registered: string[]
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
    prompts: [],
    panes: [],
    toasts: [],
    registered: [],
    refusedWrites: [],
    beforeNextWrite: undefined,
    droppedPrompt: undefined,
  }
  on('session.root', () => ({ value: ROOT }))
  on('session.id', () => ({ value: session.id }))
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
  on('ui.log', () => ({ value: undefined }))
  on('prompt.submit', ($, e) => {
    session.prompts.push(e)
    const drop = e.origin.kind === 'plugin' ? session.droppedPrompt : undefined
    session.droppedPrompt = undefined
    if (drop !== undefined) {
      return { drop }
    }

    return e.context === undefined ? { text: e.text } : { text: e.text, context: e.context }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', { tool: 'Read' }, () => ({ result: 'the file' }))
  await startAgain($, options.isInteractive ?? true)

  return session
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

function askAboutFriday($: Engine) {
  return $.tool.call({ tool: ASK_TOOL, question: 'Ship on Friday?' })
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

function typePrompt($: Engine, text: string) {
  return $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false })
}

function startTurn($: Engine, agentId?: string) {
  return $.turn.start({
    text: 'go on',
    turnId: TURN,
    ...(agentId === undefined ? {} : { agentId }),
  })
}

function endTurn($: Engine, isAborted: boolean) {
  return $.turn.complete({
    answer: '',
    durationMs: 5,
    isAborted,
    turnId: TURN,
    reason: isAborted ? 'aborted' : 'answer',
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
    'an answer given during a turn is added to the next tool result once',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on)
      await askWhichDatabase($)
      await startTurn($)
      await answerByCommand($, '1 postgres')

      expect((await readFile($)).context?.join('\n')).toContain('postgres')
      expect((await readFile($)).context).toBeUndefined()
      await endTurn($, false)
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
      await endTurn($, false)
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
      await endTurn($, true)
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
      await endTurn($, false)
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
    expect(session.store.size).toBe(1)
    expect(session.toasts).toEqual([])
  })

  test('a write the store refuses is denied with its reason', NO_TIME_LIMIT, async ($, on) => {
    const session = await startSession($, on)
    session.refusedWrites.push('the store is over 4 MiB')

    expect((await askWhichDatabase($)).deny).toContain('the store is over 4 MiB')
    expect(session.store.size).toBe(0)
  })

  test('input the model gives outside the schema fails the check', NO_TIME_LIMIT, async ($, on) => {
    await startSession($, on)

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
      expect(session.store).toEqual(new Map([[key, { questions: 'not a list' }]]))
    },
  )

  test(
    'a session without a person at the prompt is given none of the tools',
    NO_TIME_LIMIT,
    async ($, on) => {
      const session = await startSession($, on, { isInteractive: false })

      expect(session.registered).toEqual([])
      expect((await askWhichDatabase($)).deny).toBeDefined()
      expect(session.store.size).toBe(0)
    },
  )
})
