import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type {
  BackgroundTaskSummary,
  ModelCompleteInput,
  ModelCompleteResult,
  On,
  PromptSubmitInput,
  SessionCronSummary,
} from 'claude-code'

import type { WaitingTask } from '../types'
import { RuleCheckerModel } from './checker-settings.ts'
import { Report } from './reply.ts'

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}
const CLEAN = '{"findings": []}'
const FINDING = {
  report: Report.Forbidden,
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

const TRANSCRIPT = '/sessions/s1.jsonl'
const SETTINGS = '/sessions/s1/workflow-skills.json'
const OTHER_TRANSCRIPT = '/sessions/s2.jsonl'
const OTHER_SETTINGS = '/sessions/s2/workflow-skills.json'

// The text of a settings file with the checker on and the skills given.
const storedOn = (skills: readonly string[]) =>
  JSON.stringify({ ruleChecker: { enabled: true, model: RuleCheckerModel.Haiku, skills } })

const SKILLS = ['code-writing', 'hygiene', 'todo-md'].map(name => ({
  name,
  kind: 'dir' as const,
  size: 0,
  mtimeMs: 0,
  isLink: false,
}))

const prompt = ($: Engine, text: string, more: Partial<PromptSubmitInput> = {}) =>
  $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false, ...more })

// The engine beneath the plugin: a project with the files given, which the plugin may write, and
// with the paths whose read or listing fails, a plugin with three skills, and a checker model that
// returns the replies in order, the last one again once they run out, and records every request
// it got.
const world = (
  on: On,
  replies: readonly Reply[],
  files: Record<string, string> = {},
  isFailing: (path: string) => boolean = () => false,
) => {
  const requests: ModelCompleteInput[] = []
  const logged: string[] = []
  const clock = mock.clock(on)
  const session = mock.session(on)
  on('session.root', () => ({ value: '/project' }))
  on('session.start', () => ({ cwd: '/project' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('fs.exists', ($, e) => ({ value: e.path in files }))
  const failIf = (path: string) => {
    if (isFailing(path)) throw new Error(`EACCES: permission denied, ${path}`)
  }
  on('fs.read', ($, e) => {
    failIf(e.path)
    return { value: files[e.path] ?? `the text of ${e.path}` }
  })
  on('fs.write', ($, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('fs.list', ($, e) => {
    failIf(e.path)
    return {
      value: e.path.endsWith('/skills')
        ? SKILLS
        : [{ name: 'SKILL.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
    }
  })
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
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('ui.log', ($, e) => {
    logged.push(e.text)
    return { value: undefined }
  })
  // The blocks of each request, read back as JSON.
  const pieces = () =>
    requests.map(request =>
      (request.promptBlocks ?? []).map((block): unknown => JSON.parse(block.text)),
    )

  return { requests, logged, clock, session, pieces }
}

// Runs the command of the checker as the user types it.
const ruleChecker = ($: Engine, args: string) =>
  $.command.run({
    command: 'rule-checker',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

// Starts the session with the transcript path given, as the engine does.
const startSession = ($: Engine, transcript: string, source: 'startup' | 'clear' | 'resume') =>
  $.classic.SessionStart({ source, transcript_path: transcript })

// Switches the checker on in a new session, as the user does with the command.
const switchOn = async ($: Engine) => {
  await startSession($, TRANSCRIPT, 'startup')
  await ruleChecker($, 'on')
}

// The messages the plugin appended for the agent to read.
const sentTo = (session: ReturnType<typeof mock.session>) =>
  session.appended().filter(row => row.door === 'note' && row.message.type === 'user')

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
  test('sends the final message, the words of the user and the workflows', async ($, on) => {
    const { pieces } = world(on, [CLEAN])
    await switchOn($)

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

  test('sends the words of the user once, and again after a failed check', async ($, on) => {
    const { pieces } = world(on, ['Looks clean to me.', CLEAN])
    await switchOn($)

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

  test('sends only the tasks and wakeups started during the current turn', async ($, on) => {
    const { pieces } = world(on, [CLEAN])
    await switchOn($)
    const ci = shell('s1', 'watch the CI run')
    const deploy = shell('s2', 'watch the deploy')
    const turn = (turnId: string) => $.turn.start({ text: 'go', turnId })
    const piece = (final: string, waiting: WaitingTask[]) => [
      { final, user: [], running: [], waiting },
    ]

    await turn('t1')
    await $.classic.Stop(stop('Next I will merge.', { tasks: [ci], crons: [wakeup('c1')] }))
    await $.classic.Stop(stop('Fixed.', { tasks: [ci] }))
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

  test('sends the findings of the last successful check, also after a new prompt', async ($, on) => {
    const { pieces } = world(on, [BROKEN, BROKEN, CLEAN])
    await switchOn($)

    await prompt($, 'go')
    await $.classic.Stop(stop('one'))
    await $.classic.Stop(stop('two', { isDelayed: true }))
    await prompt($, 'next')
    await $.classic.Stop(stop('three'))
    await $.classic.Stop(stop('four', { isDelayed: true }))

    expect(pieces().map(([turn]) => turn)).toEqual([
      { final: 'one', user: ['go'], running: [], waiting: [] },
      { final: 'two', user: [], running: [], waiting: [], sent: [FINDING] },
      { final: 'three', user: ['next'], running: [], waiting: [], sent: [FINDING] },
      { final: 'four', user: [], running: [], waiting: [] },
    ])
  })

  test('is not sent without a final message or a TODO.md to send', async ($, on) => {
    const { requests } = world(on, [CLEAN])
    await switchOn($)

    await prompt($, 'go')
    await $.classic.Stop(stop(''))

    expect(requests).toHaveLength(0)
  })
})

describe('TODO.md', () => {
  test('is sent while no workflow runs, when TODO.md or the running workflows changed', async ($, on) => {
    const files: Record<string, string> = { [TODO]: '#160 - Slim it - QUEUED' }
    const { pieces } = world(on, [CLEAN], files)
    await switchOn($)

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
  })

  test('that a check did not get is sent by the next one', async ($, on) => {
    const { pieces } = world(on, ['Looks clean to me.', CLEAN], { [TODO]: '#4 - Parser - TODO' })
    await switchOn($)

    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop(''))

    expect(pieces()).toHaveLength(2)
    expect(pieces()[1]?.[0]).toEqual({ todo: '#4 - Parser - TODO' })
  })

  test('is sent at the first stop after the running workflow ended', async ($, on) => {
    const { pieces } = world(on, [CLEAN], { [TODO]: '#4 - Parser - TODO' })
    await switchOn($)

    await $.classic.Stop(stop('', { tasks: [workflow('w1')] }))
    expect(pieces()).toEqual([])
    await $.classic.Stop(stop(''))

    expect(pieces()).toEqual([
      [{ todo: '#4 - Parser - TODO' }, { final: null, user: [], running: [], waiting: [] }],
    ])
  })
})

describe('the model call', () => {
  test('tries again after an error that passes by itself', async ($, on) => {
    const { requests, clock, session } = world(on, [OVERLOADED, BROKEN])
    await switchOn($)

    const stopped = $.classic.Stop(stop('done'))
    await clock.settle()
    expect(requests).toHaveLength(1)
    await clock.advance(1_000)
    await stopped

    expect(requests).toHaveLength(2)
    expect(sentTo(session)).toHaveLength(1)
  })

  test('shows an error that stays as a failed check', async ($, on) => {
    const refused: ModelCompleteResult = {
      ...OVERLOADED,
      status: 401,
      error: 'authentication_failed',
    }
    const empty: ModelCompleteResult = { isAnswered: false, reason: 'empty-reply', usage: USAGE }
    const { requests } = world(on, [refused, empty])
    await switchOn($)

    await $.classic.Stop(stop('done'))
    await $.classic.Stop(stop('done'))

    expect(requests).toHaveLength(2)
    expect(await noteOf($)).toBeDefined()
  })
})

describe('the request', () => {
  test('has the rules in the system prompt, most stable first, each part cached', async ($, on) => {
    const { requests } = world(on, [CLEAN], { [TODO]: '### #4 - Parser - IN PROGRESS' })
    await switchOn($)
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
  test('are appended, shown where they were sent, and delay the stop once', async ($, on) => {
    const { session, logged } = world(on, [
      BROKEN,
      JSON.stringify({
        findings: [
          { ...FINDING, place: 'b.ts:1' },
          { ...FINDING, report: Report.NextWork, wrong: 'It\nsleeps.' },
        ],
      }),
    ])
    await switchOn($)

    const delayed = await $.classic.Stop(stop('done'))
    expect(delayed.block).toBeDefined()
    const passed = await $.classic.Stop(stop('fixed', { isDelayed: true }))

    expect(passed.block).toBeUndefined()
    expect(sentTo(session)).toHaveLength(2)
    expect(logged).toHaveLength(3)
    expect(logged[2]).toContain('It sleeps.')
  })

  test('are sent again when TODO.md or the running workflows changed', async ($, on) => {
    const { requests, session } = world(on, [BROKEN], { [TODO]: '#160 - Slim it - QUEUED' })
    await switchOn($)

    await $.classic.Stop(stop(''))
    await $.classic.Stop(stop('', { tasks: [workflow('w1')] }))
    await $.classic.Stop(stop(''))

    expect(requests).toHaveLength(2)
    expect(sentTo(session)).toHaveLength(2)
  })
})

describe('the note', () => {
  test('is cleared by a fresh load of the checker', async ($, on) => {
    world(on, [BROKEN])
    await switchOn($)

    await $.classic.Stop(stop('done'))
    expect(await noteOf($)).toBeDefined()
    await $.session.start({ cwd: '/project', surface: 'terminal', isInteractive: true })

    expect(await noteOf($)).toBeUndefined()
  })
})

describe('the switch', () => {
  test('is off in a new session, so nothing is collected or checked', async ($, on) => {
    const { pieces } = world(on, [CLEAN])
    await startSession($, TRANSCRIPT, 'startup')

    await prompt($, 'typed while off')
    const answer = await $.classic.Stop(stop('done'))
    expect(answer.block).toBeUndefined()
    expect(pieces()).toEqual([])
    await ruleChecker($, 'on')
    await $.classic.Stop(stop('done'))

    expect(pieces()).toEqual([[{ final: 'done', user: [], running: [], waiting: [] }]])
  })

  test('is written to the file of its session beside the other keys there', async ($, on) => {
    const files = { [SETTINGS]: JSON.stringify({ other: { isKept: true } }) }
    const { requests } = world(on, [CLEAN], files)

    await switchOn($)
    // A resumed session checks the stored skills against the three skills of the test plugin.
    await ruleChecker($, 'skills hygiene')
    const stored: unknown = JSON.parse(files[SETTINGS] ?? '')
    expect(stored).toHaveProperty('other', { isKept: true })
    expect(stored).toHaveProperty('ruleChecker.enabled', true)
    await startSession($, OTHER_TRANSCRIPT, 'clear')
    await $.classic.Stop(stop('after the clear'))
    expect(requests).toHaveLength(0)
    await startSession($, TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('after the resume'))

    expect(requests).toHaveLength(1)
  })

  test('sets the model and the skills the command is given', async ($, on) => {
    const { requests } = world(on, [CLEAN])

    await switchOn($)
    await ruleChecker($, `model ${RuleCheckerModel.Sonnet}`)
    await ruleChecker($, 'skills hygiene, code-writing')
    await $.classic.Stop(stop('done'))

    expect(requests[0]?.model).toBe(RuleCheckerModel.Sonnet)
    const rules = requests[0]?.systemBlocks?.[1]?.text
    expect(rules).toContain('workflow-skills:hygiene')
    expect(rules).toContain('workflow-skills:code-writing')
    expect(rules).not.toContain('workflow-skills:todo-md')
  })

  test('reads the rules again when the skills change after a check', async ($, on) => {
    const { requests } = world(on, [CLEAN])
    await switchOn($)

    await $.classic.Stop(stop('one'))
    await ruleChecker($, 'skills hygiene')
    await $.classic.Stop(stop('two'))

    const rulesOf = (index: number) => requests[index]?.systemBlocks?.[1]?.text
    expect(rulesOf(0)).toContain('workflow-skills:todo-md')
    expect(rulesOf(1)).toContain('workflow-skills:hygiene')
    expect(rulesOf(1)).not.toContain('workflow-skills:todo-md')
  })

  test('shows the settings in force without arguments', async ($, on) => {
    world(on, [CLEAN])
    await switchOn($)

    await ruleChecker($, `model ${RuleCheckerModel.Sonnet}`)
    const shown = (await ruleChecker($, '')).text

    expect(shown).toContain(RuleCheckerModel.Sonnet)
    expect(shown).not.toContain(RuleCheckerModel.Haiku)
  })

  test('rejects an unknown argument, model or skill and changes nothing', async ($, on) => {
    const files: Record<string, string> = {}
    const { requests } = world(on, [CLEAN], files)
    await switchOn($)
    await $.classic.Stop(stop('before'))
    const saved = files[SETTINGS]

    for (const args of ['maybe', 'on now', 'model', 'model gpt', 'skills', 'skills hygiene nope']) {
      await ruleChecker($, args)
    }
    await $.classic.Stop(stop('after'))

    expect(files[SETTINGS]).toBe(saved)
    expect(requests[1]?.model).toBe(requests[0]?.model)
    expect(requests[1]?.systemBlocks?.[1]).toEqual(requests[0]?.systemBlocks?.[1])
  })

  test('leaves a file that is not JSON as it is, and the checker off', async ($, on) => {
    const files = { [SETTINGS]: '{ not JSON' }
    const { requests } = world(on, [CLEAN], files)

    await switchOn($)
    await $.classic.Stop(stop('done'))

    expect(files[SETTINGS]).toBe('{ not JSON')
    expect(requests).toHaveLength(0)
  })

  test('leaves a file that is not a JSON object as it is, and the checker off', async ($, on) => {
    const files = { [SETTINGS]: '[]' }
    const { requests } = world(on, [CLEAN], files)

    await switchOn($)
    await $.classic.Stop(stop('done'))

    expect(files[SETTINGS]).toBe('[]')
    expect(requests).toHaveLength(0)
  })

  test('is off with stored settings that are not valid, until the command replaces them', async ($, on) => {
    const files = {
      [SETTINGS]: JSON.stringify({ other: 1, ruleChecker: { enabled: true, model: 'gone' } }),
    }
    const { requests } = world(on, [CLEAN], files)

    await startSession($, TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('while invalid'))
    expect(requests).toHaveLength(0)
    await ruleChecker($, 'on')
    await $.classic.Stop(stop('after the command'))

    expect(requests).toHaveLength(1)
    const stored: unknown = JSON.parse(files[SETTINGS] ?? '')
    expect(stored).toHaveProperty('other', 1)
    expect(stored).toHaveProperty('ruleChecker.enabled', true)
  })

  test('is off with stored skills the plugin does not have, or none', async ($, on) => {
    const files = { [SETTINGS]: storedOn(['hygiene', 'gone']), [OTHER_SETTINGS]: storedOn([]) }
    const { requests } = world(on, [CLEAN], files)

    await startSession($, TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('unknown skill'))
    await startSession($, OTHER_TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('no skills'))

    expect(requests).toHaveLength(0)
  })

  test('is off in a session whose settings file cannot be read', async ($, on) => {
    const files = { [OTHER_SETTINGS]: storedOn(['hygiene']) }
    const { requests } = world(on, [CLEAN], files, path => path === OTHER_SETTINGS)
    await switchOn($)

    await startSession($, OTHER_TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('done'))

    expect(requests).toHaveLength(0)
  })

  test('applies to a session without a transcript without saving', async ($, on) => {
    const files: Record<string, string> = {}
    const { requests } = world(on, [CLEAN], files)

    await startSession($, '', 'startup')
    await ruleChecker($, 'on')
    await $.classic.Stop(stop('done'))

    expect(Object.keys(files)).toEqual([])
    expect(requests).toHaveLength(1)
  })

  test('switches on and off while the skills of the plugin cannot be listed', async ($, on) => {
    const { requests } = world(on, [CLEAN], {}, path => path.endsWith('/skills'))
    await switchOn($)

    await $.classic.Stop(stop('on'))
    await ruleChecker($, 'off')
    await $.classic.Stop(stop('off'))

    expect(requests).toHaveLength(1)
  })

  test('starts the conversation of another session without the prompts of the one before', async ($, on) => {
    const { pieces } = world(on, [CLEAN], { [OTHER_SETTINGS]: storedOn(['hygiene']) })
    await switchOn($)

    await prompt($, 'typed in the first session')
    await startSession($, OTHER_TRANSCRIPT, 'resume')
    await $.classic.Stop(stop('done'))

    expect(pieces()).toEqual([[{ final: 'done', user: [], running: [], waiting: [] }]])
  })

  test('is saved once a prompt gives the transcript path of a session loaded before', async ($, on) => {
    const files: Record<string, string> = {}
    const { requests } = world(on, [CLEAN], files)

    await ruleChecker($, 'on')
    expect(files[SETTINGS]).toBeUndefined()
    await $.classic.UserPromptSubmit({ prompt: 'go', transcript_path: TRANSCRIPT })
    await ruleChecker($, 'on')
    await $.classic.Stop(stop('done'))

    expect(files[SETTINGS]).toBeDefined()
    expect(requests).toHaveLength(1)
  })

  test('starts the checker afresh when it is switched on again', async ($, on) => {
    world(on, [BROKEN])
    await switchOn($)

    await $.classic.Stop(stop('done'))
    expect(await noteOf($)).toBeDefined()
    await ruleChecker($, 'off')
    await ruleChecker($, 'on')

    expect(await noteOf($)).toBeUndefined()
  })
})
