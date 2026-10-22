import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import type {
  BackgroundTaskSummary,
  ModelCompleteInput,
  ModelCompleteResult,
  On,
  PromptSubmitInput,
  SessionCronSummary,
} from 'claude-code'

import type { WaitingTask } from '../types'

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}
const CLEAN = '{"findings": []}'
const FINDING = {
  rule: 'Never guess.',
  source: 'engineering-principles',
  place: 'a.ts:3',
  wrong: 'It guesses.',
  instead: 'Measure.',
}
const BROKEN = JSON.stringify({ findings: [FINDING] })
const OVERLOADED: ModelCompleteResult = {
  isAnswered: false,
  reason: 'api-error',
  status: 529,
  error: 'overloaded',
  usage: USAGE,
}

type Reply = string | ModelCompleteResult

// A prompt the engine refuses beneath the plugin.
const DROPPED = 'a prompt that never enters'

const TODO = '/project/TODO.md'

const prompt = ($: Engine, text: string, more: Partial<PromptSubmitInput> = {}) =>
  $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false, ...more })

// The engine beneath the plugin: a project with the files named, and a checker model that gives the
// replies in order, the last one again once they run out, and keeps every request it got.
const world = (on: On, replies: readonly Reply[], files: Record<string, string> = {}) => {
  const requests: ModelCompleteInput[] = []
  const clock = mock.clock(on)
  const session = mock.session(on)
  on('session.root', () => ({ value: '/project' }))
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  on('fs.read', ($, e) => ({ value: files[e.path] ?? `the text of ${e.path}` }))
  on('fs.list', () => ({
    value: [{ name: 'SKILL.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
  }))
  on('model.complete', ($, e) => {
    const reply = replies[Math.min(requests.length, replies.length - 1)] ?? CLEAN
    requests.push(e)
    return {
      value: typeof reply === 'string' ? { isAnswered: true, text: reply, usage: USAGE } : reply,
    }
  })
  on('prompt.context', ($, e) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }))
  on('prompt.submit', ($, e) => (e.text === DROPPED ? { drop: 'refused' } : { text: e.text }))
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  on('classic.Stop', () => ({}))
  // The blocks of each request, read back as JSON.
  const pieces = () =>
    requests.map(request =>
      (request.promptBlocks ?? []).map((block): unknown => JSON.parse(block.text)),
    )

  return { requests, clock, session, pieces }
}

// A test with the checker switched on, as the user does in /config.
const testOn = (name: string, body: TestBody) =>
  test(name, { options: { ruleChecker: true } }, body)

// The rows the plugin appended of one type: the messages the agent reads, or the notices the
// transcript shows.
const sentTo = (session: ReturnType<typeof mock.session>, type: 'user' | 'system') =>
  session.appended().filter(row => row.door === 'note' && row.message.type === type)

const workflow = (id: string): BackgroundTaskSummary => ({
  id,
  type: 'workflow',
  status: 'running',
  description: 'review the parser',
  name: 'review',
})

const shell = (id: string, description: string): BackgroundTaskSummary => ({
  id,
  type: 'shell',
  status: 'running',
  description,
})

const wakeup = (id: string): SessionCronSummary => ({
  id,
  schedule: '30 9 23 10 *',
  recurring: false,
  prompt: 'merge once CI is green',
})

type Stop = {
  isDelayed?: boolean
  tasks?: BackgroundTaskSummary[]
  crons?: SessionCronSummary[]
}

const stop = (final: string, { isDelayed = false, tasks = [], crons = [] }: Stop = {}) => ({
  stop_hook_active: isDelayed,
  last_assistant_message: final,
  background_tasks: tasks,
  session_crons: crons,
})

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const noteOf = async ($: Engine) => {
  const band = await $.ui.mount({
    plugin: 'workflow-skills',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: BAND,
  })
  return band.find({ type: 'Text' })
}

describe('the check', () => {
  testOn('sends the final message, the words of the user and the workflows', async ($, on) => {
    const { pieces } = world(on, [CLEAN])

    await prompt($, 'fix the parser')
    await prompt($, 'and the lexer', { turnId: 't' })
    await prompt($, 'a task ended', { origin: { kind: 'task-notification' } })
    await prompt($, 'a hidden prompt', { isMeta: true })
    await prompt($, DROPPED)
    await $.classic.Stop(stop('Next I will review it.', { tasks: [workflow('w1')] }))

    expect(pieces()).toEqual([
      [
        {
          final: 'Next I will review it.',
          user: ['fix the parser', 'and the lexer'],
          running: [{ workflow: 'review', description: 'review the parser' }],
          waiting: [],
        },
      ],
    ])
  })

  testOn('sends the words of the user once, and again after a failed check', async ($, on) => {
    const { pieces } = world(on, ['Looks clean to me.', CLEAN])

    await prompt($, 'first')
    await $.classic.Stop(stop('one'))
    expect(await noteOf($)).toBeDefined()
    await prompt($, 'second')
    await $.classic.Stop(stop('two'))
    await $.classic.Stop(stop('three'))

    expect(pieces()).toEqual([
      [{ final: 'one', user: ['first'], running: [], waiting: [] }],
      [{ final: 'two', user: ['first', 'second'], running: [], waiting: [] }],
      [{ final: 'three', user: [], running: [], waiting: [] }],
    ])
  })

  testOn('sends only the tasks and wakeups started during the current turn', async ($, on) => {
    const { pieces } = world(on, [BROKEN, CLEAN, CLEAN, CLEAN])
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    const ci = shell('s1', 'watch the CI run')
    const deploy = shell('s2', 'watch the deploy')
    const turn = (turnId: string) => $.turn.start({ text: 'go', turnId })
    const piece = (final: string, waiting: WaitingTask[]) => [
      { final, user: [], running: [], waiting },
    ]

    await turn('t1')
    await $.classic.Stop(stop('Next I will merge.', { tasks: [ci], crons: [wakeup('c1')] }))
    await $.classic.Stop(stop('Fixed.', { isDelayed: true, tasks: [ci] }))
    await turn('t2')
    await $.classic.Stop(stop('Next I will release.', { tasks: [ci, deploy] }))
    await turn('t3')
    await $.classic.Stop(stop('Still waiting.', { tasks: [ci, deploy] }))

    expect(pieces()).toEqual([
      piece('Next I will merge.', [
        { kind: 'shell', description: 'watch the CI run' },
        { kind: 'wakeup', description: 'merge once CI is green' },
      ]),
      piece('Fixed.', [{ kind: 'shell', description: 'watch the CI run' }]),
      piece('Next I will release.', [{ kind: 'shell', description: 'watch the deploy' }]),
      piece('Still waiting.', []),
    ])
  })

  testOn('is not sent without a final message or a TODO.md to send', async ($, on) => {
    const { requests } = world(on, [CLEAN])

    await prompt($, 'go')
    await $.classic.Stop(stop(''))

    expect(requests).toHaveLength(0)
  })
})

describe('TODO.md', () => {
  testOn(
    'is sent while no workflow runs, when TODO.md or the running workflows changed',
    async ($, on) => {
      const files: Record<string, string> = { [TODO]: '#160 - Slim it - QUEUED' }
      const { pieces } = world(on, [CLEAN], files)

      await $.classic.Stop(stop('one'))
      await $.classic.Stop(stop('two'))
      files[TODO] = '#160 - Slim it - IN PROGRESS'
      await $.classic.Stop(stop('three', { tasks: [workflow('w1')] }))
      await $.classic.Stop(stop('four'))

      expect(pieces().map(blocks => blocks.slice(0, -1))).toEqual([
        [{ todo: '#160 - Slim it - QUEUED' }],
        [],
        [],
        [{ todo: '#160 - Slim it - IN PROGRESS' }],
      ])
    },
  )

  testOn('that a check did not get is sent by the next one', async ($, on) => {
    const { pieces } = world(on, ['Looks clean to me.', CLEAN], { [TODO]: '#4 - Parser - TODO' })

    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop(''))

    expect(pieces()).toHaveLength(2)
    expect(pieces()[1]?.[0]).toEqual({ todo: '#4 - Parser - TODO' })
  })

  testOn('is sent at the first stop after the running workflow ended', async ($, on) => {
    const { pieces } = world(on, [CLEAN], { [TODO]: '#4 - Parser - TODO' })

    await $.classic.Stop(stop('', { tasks: [workflow('w1')] }))
    expect(pieces()).toEqual([])
    await $.classic.Stop(stop(''))

    expect(pieces()).toEqual([
      [{ todo: '#4 - Parser - TODO' }, { final: null, user: [], running: [], waiting: [] }],
    ])
  })
})

describe('the model call', () => {
  testOn('tries again after an error that passes by itself', async ($, on) => {
    const { requests, clock, session } = world(on, [OVERLOADED, BROKEN])

    const stopped = $.classic.Stop(stop('done'))
    await clock.settle()
    expect(requests).toHaveLength(1)
    await clock.advance(1_000)
    await stopped

    expect(requests).toHaveLength(2)
    expect(sentTo(session, 'user')).toHaveLength(1)
  })

  testOn('shows an error that stays as a failed check', async ($, on) => {
    const refused: ModelCompleteResult = {
      ...OVERLOADED,
      status: 401,
      error: 'authentication_failed',
    }
    const empty: ModelCompleteResult = { isAnswered: false, reason: 'empty-reply', usage: USAGE }
    const { requests } = world(on, [refused, empty])

    await $.classic.Stop(stop('done'))
    await $.classic.Stop(stop('done'))

    expect(requests).toHaveLength(2)
    expect(await noteOf($)).toBeDefined()
  })
})

describe('the request', () => {
  testOn('has the rules in the system prompt, most stable first, each part cached', async ($, on) => {
    const { requests } = world(on, [CLEAN], { [TODO]: '### #4 - Parser - IN PROGRESS' })
    await $.prompt.context({
      blocks: [],
      instructionFiles: [
        { kind: 'project', path: '/project/CLAUDE.md', content: 'project rules' },
        { kind: 'user', path: '/home/someone/.claude/CLAUDE.md', content: 'global rules' },
      ],
    })
    const nested = { type: 'nested_memory', origin: { kind: 'engine' } } as const
    await $.prompt.attachment({ ...nested, text: 'nested rules' })
    await $.prompt.attachment({ ...nested, text: 'nested rules' })
    await $.prompt.attachment({ ...nested, text: '' })
    await $.prompt.attachment({ ...nested, text: 'a subagent rule', agentId: 'agent-1' })

    await prompt($, 'go')
    await $.classic.Stop(stop('done'))

    const system = requests[0]?.systemBlocks ?? []
    expect(system.map(block => block.cache)).toEqual([undefined, true, true, true])
    expect(system[1]?.text).toContain('workflow-skills:todo-md')
    expect(system[2]?.text).toContain('global rules')
    expect(JSON.parse(system[3]?.text ?? '')).toEqual([
      { source: 'project /project/CLAUDE.md', text: 'project rules' },
      { source: 'nested instruction file', text: 'nested rules' },
    ])
  })
})

describe('the findings', () => {
  testOn('are appended, shown where they were sent, and delay the stop once', async ($, on) => {
    const { session } = world(on, [
      BROKEN,
      JSON.stringify({ findings: [{ ...FINDING, place: 'b.ts:1' }] }),
    ])

    const delayed = await $.classic.Stop(stop('done'))
    expect(delayed.block).toBeDefined()
    const passed = await $.classic.Stop(stop('fixed', { isDelayed: true }))

    const contentOf = (type: 'user' | 'system') =>
      sentTo(session, type).map(row => row.message.content)
    expect(passed.block).toBeUndefined()
    expect(contentOf('user')).toHaveLength(2)
    expect(contentOf('system')).toEqual(contentOf('user'))
  })

  testOn('are sent again when TODO.md or the running workflows changed', async ($, on) => {
    const { requests, session } = world(on, [BROKEN], { [TODO]: '#160 - Slim it - QUEUED' })

    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop('', { tasks: [workflow('w1')] }))
    await $.classic.Stop(stop(''))

    expect(requests).toHaveLength(2)
    expect(sentTo(session, 'user')).toHaveLength(2)
  })
})

describe('the switch', () => {
  test('is off by default, so no check runs', async ($, on) => {
    const { requests } = world(on, [BROKEN])

    const answer = await $.classic.Stop(stop('done'))

    expect(answer.block).toBeUndefined()
    expect(requests).toHaveLength(0)
  })
})
