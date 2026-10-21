import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine, TestBody } from 'claude-code/testing'
import type {
  ApiContentBlock,
  ModelCompleteInput,
  ModelCompleteResult,
  On,
  PromptSubmitInput,
  SessionAppendInput,
} from 'claude-code'

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

let rows = 0
const append = (
  $: Engine,
  door: SessionAppendInput['door'],
  origin: SessionAppendInput['origin'],
  role: 'user' | 'assistant',
  content: ApiContentBlock[],
  agentId?: string,
) => {
  rows += 1
  return $.session.append({
    door,
    origin,
    uuid: `row-${rows}`,
    agentId,
    message: { type: role, role, content },
  })
}
const prompt = ($: Engine, text: string, more: Partial<PromptSubmitInput> = {}) =>
  $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false, ...more })
const say = ($: Engine, text: string, agentId?: string) =>
  append(
    $,
    'response',
    { kind: 'model', model: 'm' },
    'assistant',
    [{ type: 'text', text }],
    agentId,
  )

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
  on('tool.call', ($, e) =>
    e.tool === 'Bash' && e.command.startsWith('git commit')
      ? {
          result: {
            stdout: '',
            stderr: '',
            interrupted: false,
            gitOperation: { commit: { sha: 'abc', kind: 'committed' } },
          },
        }
      : { result: {} },
  )
  const pieces = () => requests.map(request => request.prompt)

  return { requests, clock, session, pieces }
}

// A test with the checker switched on, as the user does in /config.
const testOn = (name: string, body: TestBody) =>
  test(name, { options: { ruleChecker: true } }, body)

const stop = (stopHookActive = false) => ({
  stop_hook_active: stopHookActive,
  background_tasks: [],
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

describe('the check points', () => {
  testOn('are text with calls, a commit, an agent or a workflow, and the end of the turn', async ($, on) => {
    const { requests, clock } = world(on, [CLEAN])
    let steps = 0
    on('turn.step', async function* () {
      steps += 1
      return {
        turnId: 't',
        index: 0,
        answer: steps === 1 ? 'Let me look.' : '',
        toolUses: [{ name: 'Read', input: {} }],
        stopReason: 'tool_use',
        usage: null,
      }
    })
    const step = async () => {
      for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })) {
        // the bottom yields nothing
      }
      await clock.settle()
    }

    await prompt($, 'go')
    await say($, 'one')
    await step()
    expect(requests).toHaveLength(1)
    await say($, 'two')
    await step()
    await $.tool.call({ tool: 'Bash', command: 'git status' })
    await clock.settle()
    expect(requests).toHaveLength(1)
    await $.tool.call({ tool: 'Bash', command: 'git commit -m x' })
    await clock.settle()
    expect(requests).toHaveLength(2)
    await say($, 'three')
    await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p' })
    await clock.settle()
    expect(requests).toHaveLength(3)
    await say($, 'four')
    await $.classic.Stop(stop())
    expect(requests).toHaveLength(4)
    expect(JSON.parse(requests[3]?.promptBlocks?.at(-1)?.text ?? '')).toHaveProperty(
      'turnEnded',
      true,
    )
  })
})

describe('the work', () => {
  testOn('is sent once, and a subagent and the plugin itself add none', async ($, on) => {
    const { requests, pieces } = world(on, [BROKEN, CLEAN])

    await prompt($, 'fix the parser')
    await say($, 'first')
    await say($, 'in a subagent', 'agent-1')
    await $.classic.Stop(stop())
    await say($, 'second')
    await $.classic.Stop(stop(true))
    await $.classic.Stop(stop(true))

    expect(requests).toHaveLength(2)
    expect(pieces()[0]).toContain('fix the parser')
    expect(pieces()[0]).not.toContain('in a subagent')
    expect(pieces()[1]).toContain('second')
    expect(pieces()[1]).not.toContain('first')
    expect(pieces()[1]).not.toContain(FINDING.wrong)
  })

  testOn('has the words the user typed or sent, also during a turn, and no other prompt', async ($, on) => {
    const { requests } = world(on, [CLEAN])

    await prompt($, 'fix the parser')
    await prompt($, 'and the lexer', { turnId: 't' })
    await prompt($, 'a task ended', { origin: { kind: 'task-notification' } })
    await prompt($, 'a hidden prompt', { isMeta: true })
    await prompt($, DROPPED)
    await $.classic.Stop(stop())

    expect(JSON.parse(requests[0]?.promptBlocks?.at(-1)?.text ?? '')).toHaveProperty('work', [
      { kind: 'user', text: 'fix the parser' },
      { kind: 'user', text: 'and the lexer' },
    ])
  })

  testOn('of a failed check is sent again by the next check', async ($, on) => {
    const { pieces, session } = world(on, ['Looks clean to me.', CLEAN])

    await prompt($, 'go')
    await say($, 'first')
    await $.classic.Stop(stop())
    expect(session.appended().filter(row => row.door === 'note')).toHaveLength(0)
    expect(await noteOf($)).toBeDefined()
    await say($, 'second')
    await $.classic.Stop(stop())

    expect(pieces()[1]).toContain('first')
    expect(pieces()[1]).toContain('second')
  })
})

describe('the model call', () => {
  testOn('tries again after an error that passes by itself', async ($, on) => {
    const { requests, clock, session } = world(on, [OVERLOADED, BROKEN])

    await prompt($, 'go')
    await say($, 'done')
    await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p' })
    await clock.settle()
    expect(requests).toHaveLength(1)
    await clock.advance(1_000)

    expect(requests).toHaveLength(2)
    expect(session.appended().filter(row => row.door === 'note')).toHaveLength(1)
  })

  testOn('shows an error that stays as a failed check, and keeps the work', async ($, on) => {
    const refused: ModelCompleteResult = {
      ...OVERLOADED,
      status: 401,
      error: 'authentication_failed',
    }
    const empty: ModelCompleteResult = { isAnswered: false, reason: 'empty-reply', usage: USAGE }
    const { requests, pieces } = world(on, [refused, empty, CLEAN])

    await prompt($, 'go')
    await say($, 'done')
    await $.classic.Stop(stop())
    await $.classic.Stop(stop())
    expect(requests).toHaveLength(2)
    expect(await noteOf($)).toBeDefined()
    await $.classic.Stop(stop())

    expect(pieces()[2]).toContain('done')
  })

  testOn('beside the turn is aborted by the end of the turn, which sends its work', async ($, on) => {
    const { requests, clock, pieces } = world(on, [OVERLOADED, CLEAN])

    await prompt($, 'go')
    await say($, 'done')
    await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p' })
    await clock.settle()
    await $.classic.Stop(stop())
    await clock.advance(1_000)

    expect(requests).toHaveLength(2)
    expect(pieces()[1]).toContain('done')
  })
})

describe('the request', () => {
  testOn('has the rules in the system prompt, most stable first, each part cached', async ($, on) => {
    const { requests } = world(on, [CLEAN], { '/project/TODO.md': '### #4 - Parser - IN PROGRESS' })
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
    await $.classic.Stop(stop())

    const system = requests[0]?.systemBlocks ?? []
    expect(system.map(block => block.cache)).toEqual([undefined, true, true, true])
    expect(system[1]?.text).toContain('workflow-skills:todo-md')
    expect(system[2]?.text).toContain('global rules')
    expect(JSON.parse(system[3]?.text ?? '')).toEqual([
      { source: 'project /project/CLAUDE.md', text: 'project rules' },
      { source: 'nested instruction file', text: 'nested rules' },
    ])
    const [todo] = requests[0]?.promptBlocks ?? []
    expect(JSON.parse(todo?.text ?? '')).toEqual({ todo: '### #4 - Parser - IN PROGRESS' })
  })

  testOn('at the end of a turn with no new work is sent only for a TODO.md', async ($, on) => {
    const { requests } = world(on, [CLEAN])

    await $.classic.Stop(stop())

    expect(requests).toHaveLength(0)
  })
})

describe('the findings', () => {
  testOn('delay the stop once, and are appended when the stop was delayed already', async ($, on) => {
    const { session } = world(on, [
      BROKEN,
      JSON.stringify({ findings: [{ ...FINDING, place: 'b.ts:1' }] }),
    ])

    await prompt($, 'go')
    await say($, 'done')
    const delayed = await $.classic.Stop(stop())
    expect(delayed.block).toBeDefined()
    await say($, 'fixed')
    const passed = await $.classic.Stop(stop(true))

    expect(passed.block).toBeUndefined()
    expect(session.appended().filter(row => row.door === 'note')).toHaveLength(2)
  })

  testOn('of a check during the turn are appended, and delay the stop', async ($, on) => {
    const { clock, session } = world(on, [BROKEN, CLEAN])

    await prompt($, 'go')
    await say($, 'done')
    await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p' })
    await clock.settle()

    expect(session.appended().filter(row => row.door === 'note')).toHaveLength(1)
    expect((await $.classic.Stop(stop())).block).toBeDefined()
  })

  testOn('already sent in this session are not sent again', async ($, on) => {
    const { requests, session } = world(on, [BROKEN])

    await prompt($, 'go')
    await say($, 'one')
    await $.classic.Stop(stop())
    await say($, 'two')
    await $.classic.Stop(stop(true))

    expect(requests).toHaveLength(2)
    expect(session.appended().filter(row => row.door === 'note')).toHaveLength(1)
  })
})

describe('the switch', () => {
  test('is off by default, so no check runs', async ($, on) => {
    const { requests } = world(on, [BROKEN])

    await prompt($, 'go')
    const answer = await $.classic.Stop(stop())
    await $.tool.call({ tool: 'Agent', description: 'd', prompt: 'p' })

    expect(answer.block).toBeUndefined()
    expect(requests).toHaveLength(0)
  })
})
