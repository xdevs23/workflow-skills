import { describe, expect, test } from 'bun:test'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fingerprint } from '../tools/fingerprint.js'

const skill = await Bun.file(new URL('../skills/implement-review-verify/SKILL.md', import.meta.url)).text()
const blocks = []
Bun.markdown.render(skill, {
  code(body, { language }) {
    if (language === 'js') blocks.push(body)
    return ''
  },
})
const scripts = new URL('../skills/implement-review-verify/scripts/', import.meta.url)
const skeleton = await Bun.file(new URL('implement-review-verify.js', scripts)).text()
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
// A unit's copy of a shipped script: every model placeholder of the marked block set to a model
// named after its entry, so the model an agent runs on shows which entry it came from.
const filled = script => script.replace(/^(\s+)'?([a-z-]+)'?: \{ model: '<[^']*>'/gm,
  (_, indent, key) => `${indent}'${key}': { model: 'model-${key}'`)
const run = new AsyncFunction('agent', 'phase', 'log', 'args',
  filled(skeleton).replace('export const meta =', 'const meta ='))
const SPEC_PATH = '<main checkout>/.cache/specs/<unit>.yaml'
const TRANSCRIPTS = '<session-dir>'
const mainLaunchValues = args => ({ spec: args.specPath, transcripts: args.transcripts, base: args.base, partialBase: false, tree: '<isolated worktree>' })
const passedCheck = (values, fields = {}, printed = {}) =>
  ({ exitCode: 0, stdout: JSON.stringify({ ...printed, proof: fingerprint(values) }), stderr: '', ...fields })

// The audit seats, each labelled and loading the template of its name.
const AUDIT = ['separation-of-concerns', 'abstraction-quality', 'code-smell', 'type-safety', 'code-cleanliness',
  'missing-gaps', 'domain-leakage', 'smearing', 'runtime-cost']
const readers = ['correctness', 'spec', 'dupes', 'quality', 'inverse', 'rules', 'alternatives', ...AUDIT]
const source = (seat, index = 0) => `${seat}:${index}`
const receipt = { file: 'src/example.js', line: 12, quote: 'catch (error) {}' }
const finding = { file: 'src/example.js', claim: 'The specified error is swallowed.', severity: 'must-fix', receipts: [receipt] }
// The correctness, spec-compliance and duplicate readers point in evidence at the transcript record
// of the words a finding is judged against. No other reader's finding has the field.
const back = f => ({ ...f, evidence: [{ kind: 'transcript', file: 'session.jsonl', line: 9, key: ['message', 'content'] }] })
const backed = back(finding)
const noAbort = { trigger: 'none', reason: '' }
const coverage = [{ what: 'src/example.js', how: 'read in full against the diff' }]
// Stage objects: the cold reader shape, the briefed reader shape (abort), and each seat's own fields.
const cold = (fields = {}) => ({ limitations: [], coverage, findings: [], ...fields })
const briefed = (fields = {}) => ({ abort: noAbort, ...cold(fields) })
const seatObject = {
  correctness: () => briefed(), spec: () => briefed(), dupes: () => briefed(),
  quality: () => cold(), ...Object.fromEntries(AUDIT.map(seat => [seat, () => cold()])),
  inverse: () => briefed(),
  rules: () => briefed({ ruleSources: [{ path: 'CLAUDE.md', read: true }] }),
  alternatives: () => cold({ candidates: [] }),
  roaster: () => cold(),
}
const decision = (ids, fields = {}) => ({
  sourceIds: ids, action: 'approve-fix', severity: 'must-fix',
  ...(fields.action === 'unresolved' ? { problem: unresolved('').problem }
    : { reason: 'The implementation contradicts the required failure behavior.' }),
  evidence: 'src/example.js:12 catches and ignores this error.',
  authority: 'docs/spec.md:8: "Return the error to the caller."',
  correction: 'Return the specified error to the caller.',
  constraints: 'Do not change the success response.',
  acceptance: 'Exercise the failure path and assert the caller receives the error.',
  removal: false,
  receipts: [receipt],
  ...fields,
})
const check = (passed = true, command = 'bun test tests/example.test.js') => ({ command, passed, output: passed ? '2 pass' : '1 fail', truncated: false })
// A run of the check command the marked block of both shipped scripts holds, which only the fixer receives.
const FULL_CHECK = '<the check command>'
const fullCheck = (passed = true) => check(passed, FULL_CHECK)
// Quoted checks of a fixer that reports proofPassed true, none of which proves it: the last quoted run
// of the full check command decides, and a check of another command proves nothing.
const NO_FULL_RUN = 'no check quotes a run of the full check command "<the check command>"'
const FULL_RUN_FAILED = 'the last quoted run of the full check command has passed false where proofPassed is true'
const unprovenFixerChecks = [
  ['no check', [], NO_FULL_RUN],
  ['only a failed check of another command', [check(false)], NO_FULL_RUN],
  ['a passed check of another command and no run of the full check', [check(true)], NO_FULL_RUN],
  ['a failed last full check beside a passed check of another command', [check(true), fullCheck(false)], FULL_RUN_FAILED],
  ['a passed full check followed by a failed one', [fullCheck(true), fullCheck(false)], FULL_RUN_FAILED],
]
// The last run of the full check decides, so a passed rerun after a failed run proves proofPassed true,
// and a failed last run beside a passed check of another command reaches the run as a failed proof.
const provenFixerChecks = [
  ['a failed full check followed by a passed rerun', [fullCheck(false), fullCheck(true)], true],
  ['a failed last full check beside a passed check of another command', [check(true), fullCheck(false)], false],
]
const verification = (decisions = [], fields = {}) => ({
  abort: noAbort, limitations: [], checks: [], decisions, issues: [], specSuggestions: [], ...fields,
})
const fixed = (dispositions = [], fields = {}) => ({
  abort: noAbort, limitations: [], premises: [], specSuggestions: [],
  proofPassed: true, checks: [fullCheck(fields.proofPassed ?? true)], dispositions, ...fields,
})
const disposition = (key = 'fix:0', kind = 'fixed') => ({ key, disposition: kind, reason: 'Checked the approved correction and its acceptance condition.', receipts: [receipt] })
const unresolved = key => ({ key, disposition: 'unresolved', receipts: [receipt], problem: {
  problem: 'The caller has no channel that carries the error back.', why: 'The correction needs one to return the error.',
  whyUnsolved: 'No rule, skill or word of the user says which channel the caller gets.' } })
const openIssue = problem => ({ kind: 'unresolved', problem: { problem, why: 'The finding cannot be judged without it.',
  whyUnsolved: 'No supplied input or rule provides it.' } })

const BASE = 'a'.repeat(40)
const INITIAL = 'b'.repeat(40)
const FIXED = 'c'.repeat(40)
// A snapshot of the one-repository tree the tests run in: its single entry has the path '.'.
const at = sha => [{ path: '.', sha }]
// A writer object whose commits, checks and repository entry agree with the start and snapshot
// fields of its one repository unless overridden. startSha, snapshotSha, clean and git describe that
// repository; repositories replaces the entry outright.
const writer = (fields, subject) => {
  const { startSha, snapshotSha, clean = true, git, repositories, ...rest } = fields
  const r = { abort: noAbort, limitations: [], proofPassed: true, specSuggestions: [], ...rest }
  const moved = snapshotSha !== startSha
  return {
    commits: moved ? [{ sha: snapshotSha, subject, repository: '.' }] : [],
    checks: [check(r.proofPassed)],
    repositories: repositories ?? [{ path: '.', startSha, snapshotSha, clean,
      git: git ?? { head: snapshotSha, status: clean ? '' : ' M src/example.js' } }],
    ...r,
  }
}
const implemented = (fields = {}) => writer({ startSha: BASE, snapshotSha: INITIAL, specCheck: passedCheck(mainLaunchValues(launchArgs())), premises: [],
  senseCheck: { passed: true, recordSilent: true, note: '' }, specFindings: [], artifacts: [], ...fields }, 'implement the change')
const launchArgs = (fields = {}) => ({ base: at(BASE), specPath: SPEC_PATH, transcripts: TRANSCRIPTS, ...fields })
// The scripts address every plugin agent by its qualified name, workflow-skills:<name>, which is
// how the harness lists them. The records keep the bare name, which is what the assertions use.
// The harness hands a script only an object that matches the schema its stage passes. This check
// knows the keywords the shipped schemas use and fails on a schema that uses any other.
const KEYWORDS = new Set(['type', 'required', 'additionalProperties', 'properties', 'items', 'enum', 'minItems', 'maxItems',
  'minimum', 'maxLength', 'pattern', 'description'])
const TYPES = { object: v => v !== null && typeof v === 'object' && !Array.isArray(v), array: Array.isArray,
  string: v => typeof v === 'string', integer: Number.isInteger, boolean: v => typeof v === 'boolean' }
const schemaErrors = (schema, value, path = 'result') => {
  const unknown = Object.keys(schema).filter(keyword => !KEYWORDS.has(keyword))
  if (unknown.length) throw new Error(`${path}: the schema uses ${unknown.join(', ')}, which the test harness does not check`)
  if (schema.enum && !schema.enum.includes(value)) return [`${path}: ${JSON.stringify(value)} is none of ${schema.enum.join(', ')}`]
  if (schema.type && !TYPES[schema.type](value)) return [`${path}: expected ${schema.type}`]
  if (schema.type === 'object') {
    const properties = schema.properties ?? {}
    return [
      ...(schema.required ?? []).filter(key => !Object.hasOwn(value, key)).map(key => `${path}.${key}: missing`),
      ...(schema.additionalProperties === false ? Object.keys(value).filter(key => !Object.hasOwn(properties, key)).map(key => `${path}.${key}: not allowed`) : []),
      ...Object.keys(value).filter(key => Object.hasOwn(properties, key)).flatMap(key => schemaErrors(properties[key], value[key], `${path}.${key}`)),
    ]
  }
  if (schema.type === 'array') {
    return [
      ...(value.length < (schema.minItems ?? 0) ? [`${path}: fewer than ${schema.minItems} items`] : []),
      ...(value.length > (schema.maxItems ?? Infinity) ? [`${path}: more than ${schema.maxItems} items`] : []),
      ...(schema.items ? value.flatMap((item, index) => schemaErrors(schema.items, item, `${path}[${index}]`)) : []),
    ]
  }
  if (schema.type === 'string') {
    return [...(value.length > (schema.maxLength ?? Infinity) ? [`${path}: longer than ${schema.maxLength}`] : []),
      ...(schema.pattern && !new RegExp(schema.pattern).test(value) ? [`${path}: does not match ${schema.pattern}`] : [])]
  }
  if (schema.type === 'integer' && value < (schema.minimum ?? -Infinity)) return [`${path}: below ${schema.minimum}`]
  return []
}
// Wraps a simulated agent so every object it returns is held to the schema its stage passed.
const schemaChecked = agent => async (prompt, opts) => {
  const result = await agent(prompt, opts)
  if (result != null) expect([opts.label, schemaErrors(opts.schema, result)]).toEqual([opts.label, []])
  return result
}
const bare = opts => {
  if (opts.agentType === undefined) return opts
  expect(opts.agentType).toMatch(/^workflow-skills:[a-z-]+$/)
  return { ...opts, agentType: opts.agentType.slice('workflow-skills:'.length) }
}
// seats holds the object each reviewer returns, and harness stands between the script and the
// simulated agents, passing their objects on unchecked unless a test asks for the schema check.
// The message of a stage whose agent failed on all three attempts.
const failedThrice = (label, message) => 'FAIL-FAST: ' + label + ' returned no complete result after 3 attempts: ' + message
async function simulate({ reports = {}, verify = {}, fixes = {}, fail = {}, implementation, specCheck,
  beforeRead = async () => {}, beforeFix = async () => {}, beforeRoast = async () => {},
  args = launchArgs(), calls = [], logs = [], script = run, seats = seatObject, seatLabels = readers, harness = agent => agent } = {}) {
  const completed = new Set(), phases = []
  let fixStart = null
  let currentSha = INITIAL
  let lastWriter = null
  const agent = async (prompt, qualified) => {
    const opts = bare(qualified)
    calls.push({ prompt, ...opts })
    // Each agent runs on its own entry: a review seat on the one keyed by its label.
    expect(opts.model).toBe('model-' + (opts.phase === 'Review' ? opts.label.split(':')[1] : opts.label))
    expect(opts.effort).toBe('high')
    if (fail[opts.label]) throw new Error(fail[opts.label])
    if (opts.label === 'impl') {
      return (lastWriter = { ...(implementation ?? implemented()), specCheck: specCheck ?? passedCheck(mainLaunchValues(args)) })
    }
    if (opts.phase === 'Review') {
      await beforeRead(opts)
      completed.add(opts.label)
      return { ...seats[opts.label.split(':')[1]](), ...reports[opts.label] }
    }
    if (opts.phase === 'Verify') {
      for (const seat of seatLabels) expect(completed.has(`review:${seat}`)).toBe(true)
      return { repositories: [{ path: '.', snapshotSha: currentSha, clean: true, git: { head: currentSha, status: '' } }],
        writerScope: lastWriter.commits.map(c => ({ repository: c.repository, sha: c.sha, ok: true, note: '' })),
        ...(verify[opts.label] ?? verification()) }
    }
    if (opts.agentType === 'roaster') {
      const snapshots = at(fixStart ?? currentSha)
      await beforeRoast(opts)
      completed.add(opts.label)
      return { snapshots, ...cold(), ...reports[opts.label] }
    }
    if (opts.agentType === 'fixer') {
      const startSha = fixStart ?? currentSha   // a retried attempt starts where the first one did
      fixStart = startSha
      await beforeFix(opts)
      const { shouldCommit: commitsOverride, ...response } = fixes[opts.label] ?? fixed()
      const shouldCommit = commitsOverride ?? response.dispositions.length > 0
      const result = writer({ startSha,
        snapshotSha: response.snapshotSha ?? (shouldCommit ? FIXED : startSha),
        ...response }, 'apply the approved corrections')
      currentSha = result.snapshotSha
      lastWriter = result
      completed.add(opts.label)
      return result
    }
    throw new Error(`Unexpected call: ${opts.label}`)
  }
  const result = await script(harness(agent), name => phases.push(name), line => logs.push(line), args)
  return { result, calls, phases, logs }
}
const oneReport = { 'review:correctness': { findings: [backed] } }
const approveOne = { 'verify': verification([decision([source('correctness')])]) }

// These tests execute the documented skeleton with deterministic fake stage results.
// They do not launch workflows or make model calls.
describe('workflow verification and consolidation', () => {
  test('cycle completion leaves root acceptance and project integration pending', async () => {
    const { result } = await simulate()
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.acceptance).toBe('pending-root-checks')
  })

  test('the size gate compares unrounded additions at the 20:1 boundary', () => {
    const helper = blocks.find(code => code.includes('const assessSize ='))
    expect(helper).toBeDefined()
    const assess = new Function('metrics', helper + '\nreturn assessSize(metrics)')
    expect(assess({ specLines: 100, codeAdded: 1999 }).status).toBe('within-limit')
    expect(assess({ specLines: 100, codeAdded: 2000 })).toEqual({
      specLines: 100, codeAdded: 2000, ratio: '20.0:1', status: 'within-limit',
    })
    expect(assess({ specLines: 100, codeAdded: 2001, codeDeleted: 5000 })).toEqual({
      specLines: 100, codeAdded: 2001, ratio: '20.0:1', status: 'root-review-required',
    })
    expect(assess({ specLines: 100, codeAdded: 5000 }).status).toBe('root-review-required')
    expect(assess({ specLines: 1, codeAdded: 0 }).ratio).toBe('0.0:1')
    for (const invalid of [undefined, null, -1, 1.5, NaN, Infinity, '100', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assess({ specLines: invalid, codeAdded: 1 })).toThrow()
      expect(() => assess({ specLines: 1, codeAdded: invalid })).toThrow()
    }
    expect(() => assess({ specLines: 0, codeAdded: 0 })).toThrow()
  })

  test('every main stage receives the execution boundary without orchestration tools', async () => {
    const { result, calls } = await simulate()
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    for (const { prompt } of calls) {
      expect(prompt).toContain('you are one assigned stage, not the orchestrator')
      expect(prompt).toContain('Do not launch workflows or subagents, directly or through skills or shell commands')
      expect(prompt).toContain('those checks have NOT already passed')
      expect(prompt).toContain('Missing orchestration tools alone do not block')
      expect(prompt).toContain('Report genuinely missing assignment capabilities/instructions, authorization or conflicting applicable requirements')
    }
    const types = new Set(calls.map(c => c.agentType).filter(Boolean))
    expect(types.size).toBeGreaterThan(0)
    for (const type of types) {
      const template = await Bun.file(new URL(`../agents/${type}.md`, import.meta.url)).text()
      const tools = type === 'roaster' ? 'Bash'
        : ['implementer', 'fixer'].includes(type) ? 'Read, Grep, Glob, Bash, Edit, Write'
        : 'Read, Grep, Glob, Bash'
      expect(template).toContain(`\ntools: ${tools}\n---\n`)
      // The audit templates stay as they are; their stages receive the boundary in the prompt, checked above.
      if (!AUDIT.includes(type)) expect(template).toContain('Execution boundary: perform only your assigned stage')
    }
  })

  test('fixer and mandatory roaster overlap, with an immutable pre-fix snapshot', async () => {
    const roastEntered = Promise.withResolvers(), releaseRoast = Promise.withResolvers()
    let fixerSawRoaster = false
    const execution = simulate({
      reports: oneReport, verify: { ...approveOne },
      fixes: { 'fix': fixed([disposition()]) },
      beforeFix: async () => { await roastEntered.promise; fixerSawRoaster = true },
      beforeRoast: async () => { roastEntered.resolve(); await releaseRoast.promise },
    })
    await roastEntered.promise
    await new Promise(resolve => setImmediate(resolve))
    expect(fixerSawRoaster).toBe(true)
    releaseRoast.resolve()
    const { result, calls } = await execution
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    const roast = calls.find(c => c.agentType === 'roaster')
    expect(roast.prompt).toContain('IMMUTABLE COMMIT IDS, per repository of the tree as path: base..snapshot:\n.: ' + BASE + '..' + INITIAL)
    expect(roast.prompt).toContain('fix:0')
    expect(roast.prompt).toContain('planned, not completed')
    expect(roast.prompt).toContain('ONLY through Git objects')
    expect(roast.prompt).not.toContain('SPEC (authority)')
    expect(roast.prompt).not.toContain(FIXED)
    expect(result.snapshots).toEqual(at(FIXED))
  })

  for (const error of ['failed', 'wrong snapshot']) {
    test(`a ${error} mandatory roast prevents completion but preserves the fixer result`, async () => {
      const { result } = await simulate({
        reports: { ...oneReport, ...(error === 'wrong snapshot' ? { 'roast': { snapshots: at(BASE) } } : {}) },
        verify: approveOne, fixes: { 'fix': fixed([disposition()]) },
        fail: error === 'failed' ? { 'roast': 'roaster unavailable' } : {},
      })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.snapshots).toEqual(at(FIXED))
      expect(result.remaining.some(r => r.item.approved?.key === 'fix:0')).toBe(true)
      expect(result.remaining.some(r => r.kind === 'stage-failure' && r.item.label === 'roast')).toBe(true)
    })
  }

  for (const fields of [{ clean: false }, { snapshotSha: 'HEAD' }, { startSha: INITIAL }]) {
    test(`rejects invalid implementation snapshot metadata: ${JSON.stringify(fields)}`, async () => {
      const { result } = await simulate({ implementation: implemented(fields) })
      expect(result.exit).toBe('failed')
      expect(result.detail).toContain('clean immutable snapshot')
    })
  }

  test('a stage error with an unrelated exit property returns a failed run record', async () => {
    const { result } = await simulate({ beforeRead: async ({ label }) => {
      if (label === 'review:correctness') {
        throw Object.assign(new Error('provider unavailable'), { exit: 'provider-error' })
      }
    } })
    const message = failedThrice('review:correctness', 'provider unavailable')
    expect([result.exit, result.detail]).toEqual(['failed', message])
    expect(result.remaining).toEqual([{
      kind: 'stage-failure', severity: 'CRITICAL',
      item: { label: 'review:correctness', message, refused: [] },
    }])
  })

  test('a stage whose agent call fails is retried, and the run goes on when a later attempt returns', async () => {
    let failures = 0
    const { result, calls } = await simulate({ beforeRead: async ({ label }) => {
      if (label === 'review:correctness' && failures++ === 0) throw new Error('provider unavailable')
    } })
    const attempts = calls.filter(c => c.label === 'review:correctness')
    expect([attempts.length, attempts[1].prompt.endsWith('HOW YOUR PREVIOUS ATTEMPT FAILED, plainly: provider unavailable')]).toEqual([2, true])
    expect(result.exit).not.toBe('failed')
  })

  test('requires a launch base list of immutable commits, one per repository, not a branch name', async () => {
    for (const [base, message] of [
      [undefined, 'args.base must be a non-empty list'], [[], 'args.base must be a non-empty list'],
      [at('main'), 'args.base carries no full immutable commit ID for .'],
      [[{ path: 'api', sha: BASE }, { path: 'api', sha: INITIAL }], 'args.base names the path api twice'],
      [[{ path: '../api', sha: BASE }], 'args.base names a path of another form: "../api"'],
      [[{ path: "it's", sha: BASE }], 'args.base names a path of another form'],
    ]) await expect(simulate({ args: launchArgs({ base }) })).rejects.toThrow(message)
  })

  test('a roaster that read only the repositories the change moved is accepted, and one that misses a moved repository is refused', async () => {
    const API = 'd'.repeat(40), API_NEW = 'e'.repeat(40)
    const base = [{ path: 'api', sha: API }, { path: 'web', sha: BASE }]
    const repositories = [
      { path: 'api', startSha: API, snapshotSha: API_NEW, clean: true, git: { head: API_NEW, status: '' } },
      { path: 'web', startSha: BASE, snapshotSha: BASE, clean: true, git: { head: BASE, status: '' } }]
    const implementation = implemented({ repositories, commits: [{ sha: API_NEW, subject: 'implement the change', repository: 'api' }] })
    const unmoved = repositories.map(r => ({ ...r, startSha: r.snapshotSha }))
    const roastedAt = async snapshots => (await simulate({ args: launchArgs({ base }), implementation, fixes: { fix: fixed([], { repositories: unmoved }) },
      verify: { verify: verification([], { repositories: repositories.map(({ path, snapshotSha, clean, git }) => ({ path, snapshotSha, clean, git })) }) },
      reports: { roast: { snapshots, findings: [finding] } } })).result
    const refused = result => result.remaining.some(r => r.kind === 'stage-failure' && /wrong snapshot/.test(r.item.message))
    const onlyMoved = await roastedAt([{ path: 'api', sha: API_NEW }])
    expect([onlyMoved.exit, refused(onlyMoved), onlyMoved.remaining.filter(r => r.kind === 'roast-finding').length]).toEqual(['follow-up', false, 1])
    expect(refused(await roastedAt([{ path: 'api', sha: API_NEW }, { path: 'web', sha: BASE }]))).toBe(false)
    for (const [refusal, snapshots] of [['moved repository missing', [{ path: 'web', sha: BASE }]], ['wrong commit', [{ path: 'api', sha: API }]],
      ['repository twice', [{ path: 'api', sha: API_NEW }, { path: 'api', sha: API_NEW }]]]) {
      expect([refusal, refused(await roastedAt(snapshots))]).toEqual([refusal, true])
    }
    const { calls } = await simulate()
    expect(calls.find(c => c.label === 'roast').schema.properties.snapshots.minItems).toBe(1)
  })

  test('a tree of several repositories hands every stage one entry per repository', async () => {
    const API = 'd'.repeat(40), API_NEW = 'e'.repeat(40)
    const base = [{ path: 'api', sha: API }, { path: 'web', sha: BASE }]
    const repositories = [
      { path: 'api', startSha: API, snapshotSha: API_NEW, clean: true, git: { head: API_NEW, status: '' } },
      { path: 'web', startSha: BASE, snapshotSha: BASE, clean: true, git: { head: BASE, status: '' } }]
    const implementation = implemented({ repositories, commits: [{ sha: API_NEW, subject: 'implement the change', repository: 'api' }] })
    const calls = []
    // The proof-only fixer starts every repository where the implementer left it and moves none.
    const unmoved = repositories.map(r => ({ ...r, startSha: r.snapshotSha }))
    const { result } = await simulate({ args: launchArgs({ base }), implementation, calls, fixes: { fix: fixed([], { repositories: unmoved }) },
      verify: { verify: verification([], { repositories: repositories.map(({ path, snapshotSha, clean, git }) => ({ path, snapshotSha, clean, git })) }) },
      reports: { roast: { snapshots: [{ path: 'api', sha: API_NEW }, { path: 'web', sha: BASE }] } } })
    expect([result.exit, result.detail]).toEqual(['clean', 'The pass completed with passing proof.'])
    expect(result.snapshots).toEqual([{ path: 'api', sha: API_NEW }, { path: 'web', sha: BASE }])
    expect(calls.find(c => c.label === 'impl').prompt).toContain('START SHAS, per repository: api ' + API + ', web ' + BASE)
    const diff = calls.find(c => c.label === 'review:correctness').prompt
    expect(diff).toContain('api: ' + API + '..' + API_NEW)
    expect(diff).not.toContain('web: ' + BASE + '..')
    expect(diff).toContain('Every repository must remain clean at its snapshot: api ' + API_NEW + ', web ' + BASE + '.')
    // A roaster may name a repository by its path inside the worktree; a path of another repository is refused.
    const roastedAt = async snapshots => (await simulate({ args: launchArgs({ base }), implementation, fixes: { fix: fixed([], { repositories: unmoved }) },
      verify: { verify: verification([], { repositories: repositories.map(({ path, snapshotSha, clean, git }) => ({ path, snapshotSha, clean, git })) }) },
      reports: { roast: { snapshots } } })).result
    expect((await roastedAt([{ path: '<isolated worktree>/api/', sha: API_NEW }, { path: './web', sha: BASE }])).exit).toBe('clean')
    expect((await roastedAt([{ path: '<isolated worktree>/other', sha: API_NEW }, { path: 'web', sha: BASE }])).remaining
      .some(r => r.kind === 'stage-failure' && /wrong snapshot/.test(r.item.message))).toBe(true)
    // The verifier may name a repository by its path inside the worktree too; a path of another repository is refused.
    const verifiedAt = async paths => (await simulate({ args: launchArgs({ base }), implementation, fixes: { fix: fixed([], { repositories: unmoved }) },
      verify: { verify: verification([], { repositories: repositories.map(({ snapshotSha, clean, git }, i) => ({ path: paths[i], snapshotSha, clean, git })) }) },
      reports: { roast: { snapshots: [{ path: 'api', sha: API_NEW }, { path: 'web', sha: BASE }] } } })).result
    expect((await verifiedAt(['<isolated worktree>/api', '<isolated worktree>/web/'])).exit).toBe('clean')
    expect((await verifiedAt(['<isolated worktree>/other', 'web'])).remaining
      .some(r => r.kind === 'stage-failure' && /repository in repositories/.test(r.item.message))).toBe(true)
    // A writer that leaves a repository out, or moves one without a commit in it, is refused.
    const apiCommit = [{ sha: API_NEW, subject: 'implement the change', repository: 'api' }]
    for (const [fields, message] of [[{ repositories: repositories.slice(0, 1), commits: apiCommit }, 'exactly one entry per repository of the list'],
      [{ repositories, commits: [{ sha: API_NEW, subject: 'implement the change', repository: 'web' }] }, 'the new snapshot of api needs commits in it']]) {
      const refused = await simulate({ args: launchArgs({ base }), implementation: implemented(fields) })
      expect([refused.result.exit, refused.result.detail]).toEqual(['failed', expect.stringContaining(message)])
    }
  })

  test('a dirty fixer result, or one on the wrong commit, cannot become the next snapshot', async () => {
    for (const fields of [{ clean: false }, { snapshotSha: 'HEAD' }, { startSha: BASE }]) {
      const response = fixed([disposition()], { ...fields,
        checks: [{ ...fullCheck(), output: 'fixer proof' }],
      })
      const rejectedFix = writer({ startSha: INITIAL, snapshotSha: fields.snapshotSha ?? FIXED,
        ...response }, 'apply the approved corrections')
      const implementation = implemented()
      const { result } = await simulate({ implementation,
        reports: oneReport, verify: approveOne, fixes: { 'fix': response },
      })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.remaining.some(r => r.item.approved?.key === 'fix:0')).toBe(true)
      expect(result.proof).toEqual({ checks: implementation.checks })
      expect(result.snapshots).toEqual(at(INITIAL))
      expect(result.remaining.find(r => r.kind === 'stage-failure').item).toEqual({
        ...rejectedFix, label: 'fix',
        message: 'Writer did not return a clean immutable snapshot of . from its expected start SHA',
      })
    }
  })

  test('verifier-reported drift or dirty state blocks writing', async () => {
    for (const [sha, clean] of [[INITIAL, false], [BASE, true]]) {
      const repositories = [{ path: '.', snapshotSha: sha, clean, git: { head: sha, status: clean ? '' : ' M src/example.js' } }]
      const { result, calls } = await simulate({ verify: { 'verify': verification([], { repositories }) } })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(calls.some(c => c.agentType === 'fixer')).toBe(false)
    }
  })

  test('writer commit permission is not granted to readers', async () => {
    const { calls } = await simulate()
    for (const call of calls.filter(c => ['implementer', 'fixer'].includes(c.agentType))) {
      expect(call.prompt).toContain('NARROW COMMIT PERMISSION')
      expect(call.prompt).not.toContain('GIT READ-ONLY:')
    }
    for (const call of calls.filter(c => ['Review', 'Verify'].includes(c.phase))) {
      expect(call.prompt).toContain('GIT READ-ONLY:')
      expect(call.prompt).not.toContain('NARROW COMMIT PERMISSION')
    }
  })

  test('clean review verifies before read-only proof, with no root checkpoint', async () => {
    const { result, calls, phases } = await simulate()
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.remaining.filter(r => r.kind !== 'unattested-fix')).toEqual([])
    expect(phases).toEqual(['Implement', 'Review', 'Verify', 'Fix'])
    expect(calls.filter(c => c.agentType === 'finding-verifier')).toHaveLength(1)
    expect(calls.find(c => c.agentType === 'fixer').prompt).toContain('APPROVED CORRECTIONS (verify against the tree and authority):\n\n[]')
  })

  test('duplicates from ordinary and adversary readers produce one approved correction', async () => {
    const { result, calls } = await simulate({
      reports: { ...oneReport, 'review:alternatives': { findings: [finding] } },
      verify: {
        'verify': verification([decision([source('correctness'), source('alternatives')])]),
      },
      fixes: { 'fix': fixed([disposition()]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.counts.approved).toBe(1)
    expect(result.history).toBeUndefined()
    const fixer = calls.find(c => c.agentType === 'fixer')
    expect(fixer.prompt).toContain(source('correctness'))
    expect(fixer.prompt).toContain(source('alternatives'))
    expect(fixer.prompt).toContain('"constraints":"Do not change the success response."')
    expect(fixer.prompt).not.toContain('REPORTS (UNTRUSTED, read all)')
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
  })

  for (const [name, decisions] of [
    ['omitted', []],
    ['invented', [decision(['unknown'])]],
    ['duplicated', [decision([source('correctness')]), decision([source('correctness')])]],
    ['empty group', [decision([source('correctness')]), decision([])]],
  ]) {
    test(`rejects ${name} source coverage before fixing`, async () => {
      const { result, calls } = await simulate({ reports: oneReport, verify: { 'verify': verification(decisions) } })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.exit).toBe('failed')
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    })
  }

  for (const field of ['authority', 'correction', 'constraints', 'acceptance', 'evidence', 'reason']) {
    test(`approval requires ${field}`, async () => {
      const { result, calls } = await simulate({
        reports: oneReport,
        verify: { 'verify': verification([decision([source('correctness')], { [field]: '' })]) },
      })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.detail).toContain('Decision ["correctness:0"] (approve-fix), field ' + field + ': must be nonempty text')
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    })
  }

  test('an unresolved finding without a correction reaches the follow-up while approved work is applied', async () => {
    const { correction, ...open } = decision([source('correctness', 1)], { action: 'unresolved' })
    const { result, calls } = await simulate({
      reports: { 'review:correctness': { findings: [backed, backed] } },
      verify: { verify: verification([decision([source('correctness')]), open]) },
      fixes: { fix: fixed([disposition()]) }, harness: schemaChecked,
    })
    expect([result.exit, result.detail]).toEqual(['root-resolution', 'Review or verification left items for the root.'])
    expect(result.remaining.map(r => r.kind)).toEqual(['open-decision', 'unattested-fix'])
    expect(result.remaining[0].item).toEqual(open)
    expect(result.toFix).toEqual([{ source: 'verify:1', decision: open }])
    expect(calls.filter(c => c.phase === 'Fix').map(c => c.label).sort()).toEqual(['fix', 'roast'])
    expect(retried(calls, 'verify')).toHaveLength(1)
  })

  test('an approval without a correction is refused with its source IDs and field', async () => {
    const { correction, ...approval } = decision([source('correctness')])
    const { result, calls } = await simulate({ reports: oneReport,
      verify: { verify: verification([approval]) }, harness: schemaChecked })
    expect(result.detail).toContain('Decision ["correctness:0"] (approve-fix), field correction: must be nonempty text')
    expect([result.exit, retried(calls, 'verify').length, calls.some(c => c.phase === 'Fix')]).toEqual(['failed', 3, false])
  })

  test('an unresolved report missing part of its problem is refused with its source IDs and field', async () => {
    const open = decision([source('correctness')], { action: 'unresolved', correction: '' })
    for (const field of ['problem', 'why', 'whyUnsolved']) {
      const { result, calls } = await simulate({ reports: oneReport,
        verify: { verify: verification([{ ...open, problem: { ...open.problem, [field]: '' } }]) }, harness: schemaChecked })
      expect(result.detail).toContain('Decision ["correctness:0"] (unresolved), field problem.' + field + ': must be nonempty text')
      expect([result.exit, calls.some(c => c.phase === 'Fix')]).toEqual(['failed', false])
    }
  })

  test('a verifier issue is not lost when the findings list is empty', async () => {
    const { result, calls } = await simulate({
      verify: { 'verify': verification([], { issues: [openIssue('The authority document is unavailable.')] }) },
    })
    expect(result.exit).toBe('root-resolution')
    expect(result.remaining.map(r => r.kind)).toEqual(['verifier-issue'])
    // With no approved correction the fixer runs the checks only, and the roast still runs.
    expect(calls.filter(c => c.phase === 'Fix').map(c => c.label).sort()).toEqual(['fix', 'roast'])
  })

  test('a verifier issue without its full problem statement is refused by its index and field', async () => {
    const issue = openIssue('The authority document is unavailable.')
    const { result, calls } = await simulate({
      verify: { verify: verification([], { issues: [{ ...issue, problem: { ...issue.problem, whyUnsolved: ' ' } }] }) },
    })
    expect(result.detail).toContain('Issue issue:0 (unresolved), field problem.whyUnsolved: must be nonempty text')
    expect([result.exit, calls.some(c => c.phase === 'Fix')]).toEqual(['failed', false])
  })

  test('a suggested spec edit does not block implementation, normal reviews or proof', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:spec': { findings: [{
        file: 'docs/spec.md', claim: 'The optional example could explain the error response more clearly.',
        severity: 'nit', receipts: [{ file: 'docs/spec.md', line: 8, quote: 'Return the error to the caller.' }],
        evidence: [{ kind: 'transcript', file: 'session.jsonl', line: 9, key: ['message', 'content'] }],
      }] } },
      verify: { 'verify': verification([decision([source('spec')], {
        action: 'record', severity: 'nit',
        reason: 'The implementation satisfies the existing requirements; clearer examples are optional.',
        evidence: 'The error response matches the specified contract and its tests pass.',
        correction: 'Report the optional documentation improvement for the root without editing the spec.',
      })]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.remaining.filter(r => r.kind !== 'unattested-fix')).toEqual([])
    expect(result.counts.recorded).toBe(1)
    for (const seat of readers) expect(calls.some(c => c.label === `review:${seat}`)).toBe(true)
    for (const type of ['implementer', 'fixer', 'finding-verifier']) {
      const prompt = calls.find(c => c.agentType === type).prompt
      expect(prompt).toContain('Implement the spec AS WRITTEN')
      expect(prompt).toContain('Suggested spec edits do not block executable work or normal reviews')
    }
    expect(calls.some(c => c.agentType === 'roaster')).toBe(true)
  })

  test('critical findings cannot silently become advisory records', async () => {
    const { result } = await simulate({
      reports: oneReport,
      verify: { 'verify': verification([decision([source('correctness')], { action: 'record', severity: 'CRITICAL' })]) },
    })
    expect(result.detail).toContain('Blocking defect cannot be recorded as advisory')
  })

  test('an inverse-spec finding cannot be approved at a downgraded severity', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse': { findings: [finding] } },
      verify: { 'verify': verification([decision([source('inverse')], { severity: 'should-fix' })]) },
    })
    expect(result.detail).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding cannot be rejected at a downgraded severity either', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse': { findings: [finding] } },
      verify: { 'verify': verification([decision([source('inverse')], {
        action: 'reject', severity: 'nit', reason: 'Reads as a stylistic nit.', evidence: 'No behavior changed.',
      })]) },
    })
    expect(result.detail).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('a consolidated group with one inverse-spec source still requires CRITICAL severity', async () => {
    const { result } = await simulate({
      reports: { ...oneReport, 'review:inverse': { findings: [finding] } },
      verify: { 'verify': verification([decision([source('correctness'), source('inverse')], { severity: 'must-fix' })]) },
    })
    expect(result.detail).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding tagged CRITICAL can still be approved and fixed', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse': { findings: [finding] } },
      verify: {
        'verify': verification([decision([source('inverse')], { severity: 'CRITICAL' })]),
      },
      fixes: { 'fix': fixed([disposition()]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.counts.approved).toBe(1)
    expect(calls.find(c => c.agentType === 'finding-verifier').prompt).toContain(source('inverse'))
  })

  test('an inverse-spec finding cannot be dispositioned as cleanup', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse': { findings: [finding] } },
      verify: { 'verify': verification([decision([source('inverse')], {
        action: 'cleanup', severity: 'CRITICAL',
        correction: 'Record it for later scheduling.',
      })]) },
    })
    expect(result.detail).toContain('Inverse-spec finding cannot be dispositioned as cleanup; it goes to the follow-up run')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('inverseSpecDecisions defaults to empty with no inverse-spec findings', async () => {
    const { result } = await simulate()
    expect(result.inverseSpecDecisions).toEqual([])
  })

  test('an approve-fix and a rejected inverse-spec decision both stay in the root handoff after completion', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse': { findings: [finding, { ...finding, file: 'src/other.js' }] } },
      verify: {
        'verify': verification([
          decision([source('inverse')], { severity: 'CRITICAL' }),
          decision([source('inverse', 1)], {
            action: 'reject', severity: 'CRITICAL',
            reason: 'The cited excess is already required by an existing directive.',
            evidence: 'docs/spec.md:20 already authorizes this exact mechanism.',
          }),
        ]),
      },
      fixes: { 'fix': fixed([disposition()]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.remaining.filter(r => r.kind !== 'unattested-fix')).toEqual([])
    expect(result.inverseSpecDecisions).toHaveLength(2)
    expect(result.inverseSpecDecisions.map(d => d.action).sort()).toEqual(['approve-fix', 'reject'])
  })

  test('a mixed-source group carrying an inverse-spec ID still surfaces in the root handoff', async () => {
    const { result } = await simulate({
      reports: { ...oneReport, 'review:inverse': { findings: [finding] } },
      verify: {
        'verify': verification([decision([source('correctness'), source('inverse')], { severity: 'CRITICAL' })]),
      },
      fixes: { 'fix': fixed([disposition()]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.inverseSpecDecisions).toHaveLength(1)
    expect(result.inverseSpecDecisions[0].sourceIds).toEqual([source('correctness'), source('inverse')])
  })

  test('an inverse-spec decision goes to the next fix run also when the fixer fixed or rejected it', async () => {
    const fromInverse = decision([source('inverse')], { severity: 'CRITICAL' })
    const mixed = decision([source('correctness'), source('inverse', 1)], { severity: 'CRITICAL' })
    const plain = decision([source('correctness', 1)])
    const { result } = await simulate({
      reports: { 'review:correctness': { findings: [backed, backed] }, 'review:inverse': { findings: [finding, finding] } },
      verify: { verify: verification([fromInverse, mixed, plain]) },
      fixes: { fix: fixed([disposition('fix:0'), disposition('fix:1', 'rejected'), disposition('fix:2')]) },
    })
    expect(result.inverseSpecDecisions).toEqual([fromInverse, mixed])
    expect(result.toFix).toEqual([{ source: 'verify:0', decision: { ...fromInverse, disposition: disposition('fix:0') } },
      { source: 'verify:1', decision: { ...mixed, disposition: disposition('fix:1', 'rejected') } }])
  })

  test('a project-benefit decision of any reviewer goes to the next fix run with its kind-bearing findings, also when the fixer fixed or rejected it', async () => {
    const patched = benefit([source('quality')])
    const disputed = benefit([source('alternatives'), source('correctness')])
    const plain = decision([source('correctness', 1)])
    const { result } = await simulate({
      reports: { ...report('review:quality', [bandAid]), ...report('review:alternatives', [{ ...bandAid, kind: 'longer-route' }]),
        'review:correctness': { findings: [backed, backed] } },
      verify: { verify: verification([patched, disputed, plain]) },
      fixes: { fix: fixed([disposition('fix:0'), disposition('fix:1', 'rejected'), disposition('fix:2')]) },
    })
    const flagged = (seat, kind) => ({ id: source(seat), seat, kind, file: bandAid.file, claim: bandAid.claim })
    expect(result.inverseSpecDecisions).toEqual([])
    expect(result.toFix).toEqual([
      { source: 'verify:0', decision: { ...patched, projectBenefit: [flagged('quality', 'band-aid')], disposition: disposition('fix:0') } },
      { source: 'verify:1', decision: { ...disputed, projectBenefit: [flagged('alternatives', 'longer-route')],
        disposition: disposition('fix:1', 'rejected') } }])
    expect(result.decisions).toEqual([patched, disputed, plain])
  })

  test('a reader abort object aborts before verify or fix, in one call, with its whole object in remaining', async () => {
    const abort = { trigger: 'directive-conflict', reason: 'the diff contradicts a recorded directive' }
    const { result, calls } = await simulate({ reports: { 'review:inverse': { abort, findings: [finding] } } })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
    expect(result.detail).toContain('Hard flag from review:inverse')
    expect(result.remaining[0].item.abort).toEqual(abort)
    expect(result.remaining[0].item.findings[0].claim).toBe(finding.claim)
    expect(calls.filter(c => c.label === 'review:inverse')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a verifier abort object aborts before fix, whatever its decisions say', async () => {
    const { result, calls } = await simulate({
      reports: oneReport,
      verify: { 'verify': verification([decision([source('correctness')])], {
        abort: { trigger: 'directive-conflict', reason: 'the spec contradicts a recorded directive' },
      }) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
    expect(result.detail).toContain('Hard flag from verify')
    expect(result.detail).toContain('the spec contradicts a recorded directive')
    expect(calls.filter(c => c.label === 'verify')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('ordinary rejection and out-of-scope cleanup without a correction retain their evidence', async () => {
    const { correction, ...cleanup } = decision([source('rules', 1)], { action: 'cleanup' })
    const { result } = await simulate({
      reports: { 'review:rules': { findings: [{ ...finding, scope: 'in-change' }, { ...finding, scope: 'beside' }] } },
      verify: { verify: verification([
        decision([source('rules')], { action: 'reject', reason: 'The caller already propagates the error.', evidence: 'src/caller.js:30 returns the error.' }),
        cleanup,
      ]) }, harness: schemaChecked,
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.remaining.filter(r => r.kind !== 'unattested-fix')).toEqual([])
    expect(result.cleanup).toEqual([cleanup])
    expect(result.counts.rejected).toBe(1)
  })

  test('critical adjacent cleanup retains its receipts without entering the current fix list', async () => {
    const cleanup = decision([source('rules', 1)], {
      action: 'cleanup', severity: 'CRITICAL',
      reason: 'An existing violation is outside this unit’s repair scope.',
      evidence: 'src/legacy.js:20 violates docs/rules.md:6; the legacy helper predates this change.',
      authority: 'docs/rules.md:6: "Propagate errors to the caller."',
      correction: 'Record legacy-helper-error in local untracked TODO.md and schedule its correction promptly.',
    })
    const { result, calls } = await simulate({
      reports: { 'review:rules': { findings: [finding, { ...finding, file: 'src/legacy.js' }] } },
      verify: {
        'verify': verification([decision([source('rules')], { severity: 'CRITICAL' }), cleanup]),
      },
      fixes: { 'fix': fixed([disposition()]) },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(result.counts.approved).toBe(1)
    expect(result.cleanup).toEqual([cleanup])
    expect(result.cleanup[0].severity).toBe('CRITICAL')
    expect(calls.find(c => c.phase === 'Fix').prompt).not.toContain('legacy-helper-error')
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
  })

  test('cleanup handoff survives an incomplete run that needs a decision', async () => {
    const cleanup = decision([source('rules')], { action: 'cleanup', severity: 'CRITICAL' })
    const { result, calls } = await simulate({
      reports: { 'review:rules': { findings: [finding] } },
      verify: { 'verify': verification([cleanup], {
        issues: [openIssue('The required retention policy is undefined, so deletion safety cannot be checked.')],
      }) },
    })
    expect(result.exit).toBe('root-resolution')
    expect(result.cleanup).toEqual([cleanup])
    expect(calls.some(c => c.phase === 'Fix')).toBe(true)
  })

  test('a fixer rejection closes its approved correction, stays in dispositions and leaves nothing to fix', async () => {
    const rejection = disposition('fix:0', 'rejected')
    const { result, calls } = await simulate({ reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([rejection], { shouldCommit: false }) } })
    expect([result.exit, result.remaining, result.dispositions, result.toFix]).toEqual(['clean', [], [rejection], []])
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
  })

  test('a premise the fixer reported false returns as a must-fix item with its label, and a run it alone leaves open ends follow-up', async () => {
    const rejection = disposition('fix:0', 'rejected')
    const holding = { claim: 'The tree holds src/example.js.', holds: true, note: 'It does.' }
    const premise = { claim: 'The prompt says src/example.js already returns the error.', holds: false, note: 'src/example.js:12 still catches it.' }
    const { result } = await simulate({ reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([rejection], { shouldCommit: false, premises: [holding, premise] }) } })
    expect([result.exit, result.remaining, result.toFix])
      .toEqual(['follow-up', [{ kind: 'false-premise', severity: 'must-fix', item: { ...premise, label: 'fix' } }], []])
  })

  test('a narrowing limitation of the fixer returns with its label, and its spec suggestions return in the result', async () => {
    const limitation = { what: 'The integration suite needs a database this tree does not start.', effect: 'narrows' }
    const suggestion = 'Name the error the spec expects for an empty file.'
    const { result } = await simulate({ reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([disposition('fix:0', 'rejected')], { shouldCommit: false, limitations: [limitation], specSuggestions: [suggestion] }) } })
    expect([result.exit, result.remaining, result.specSuggestions])
      .toEqual(['clean', [{ kind: 'fix-limitation', severity: 'should-fix', item: { ...limitation, label: 'fix' } }], [suggestion]])
  })

  test('an unresolved approval returns to the root and reaches the follow-up run with the fixer\'s problem statement beside it', async () => {
    const left = unresolved('fix:0')
    const { result, calls } = await simulate({ reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([left], { shouldCommit: false }) } })
    expect([result.exit, result.detail]).toEqual(['root-resolution', 'The fixer left an approved correction unresolved.'])
    expect(result.remaining.map(r => r.kind)).toEqual(['unfixed-approval'])
    expect(result.remaining[0].item.response).toEqual(left)
    expect(result.toFix).toEqual([{ source: 'verify:0', decision: { ...approveOne.verify.decisions[0], disposition: left } }])
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
  })

  test('a fix reported without a commit leaves its approval unfixed and reaches the next fix list with the fixer\'s disposition beside it', async () => {
    const uncommitted = disposition('fix:0')
    const { result } = await simulate({ reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([uncommitted], { shouldCommit: false }) } })
    expect([result.exit, result.remaining.map(r => r.kind)]).toEqual(['follow-up', ['unfixed-approval']])
    expect(result.remaining[0].item.response).toEqual(uncommitted)
    expect(result.toFix).toEqual([{ source: 'verify:0', decision: { ...approveOne.verify.decisions[0], disposition: uncommitted } }])
  })

  for (const answers of [[], [disposition('unknown')], [disposition(), disposition()]]) {
    test(`invalid fixer answers preserve unfixed approvals: ${JSON.stringify(answers)}`, async () => {
      const { result } = await simulate({ reports: oneReport, verify: approveOne, fixes: { 'fix': fixed(answers) } })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.remaining.some(r => r.item.approved?.key === 'fix:0')).toBe(true)
    })
  }

  test('a missing required adversary stops verification and fixing', async () => {
    const { result, calls } = await simulate({ fail: { 'review:alternatives': 'provider unavailable' } })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
    expect(calls.some(c => ['Verify', 'Fix'].includes(c.phase))).toBe(false)
  })

  test('a reader failure still awaits the other readers before returning control', async () => {
    const entered = Promise.withResolvers(), release = Promise.withResolvers()
    let finished = false
    const execution = simulate({
      fail: { 'review:alternatives': 'reader failed' },
      beforeRead: async opts => {
        if (opts.label === 'review:quality') {
          entered.resolve()
          await release.promise
        }
      },
    }).then(value => { finished = true; return value })
    await entered.promise
    await new Promise(resolve => setImmediate(resolve))
    expect(finished).toBe(false)
    release.resolve()
    const { result } = await execution
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
  })

  test('an abort with an empty reason is retried with the failure named and then thrown', async () => {
    const { result, calls, logs } = await simulate({
      reports: { 'review:inverse': { abort: { trigger: 'directive-conflict', reason: ' ' } } },
    })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
    expect(calls.filter(c => c.label === 'review:inverse')).toHaveLength(3)
    expect(calls.filter(c => c.label === 'review:inverse')[1].prompt).toContain('HOW YOUR PREVIOUS ATTEMPT FAILED, plainly: abort.trigger is set but abort.reason is empty')
    expect(result.detail).toContain('FAIL-FAST: review:inverse returned no complete result after 3 attempts: abort.trigger is set but abort.reason is empty')
    expect(logs.filter(line => line.startsWith('incomplete result from review:inverse'))).toHaveLength(3)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('an implementer abort object with an unchanged tree returns in one call, not a completeness retry', async () => {
    const calls = []
    const abort = { trigger: 'directive-conflict', reason: 'the requested change contradicts a recorded scope directive.' }
    const { result } = await simulate({ implementation: implemented({ snapshotSha: BASE, proofPassed: false, abort }), calls })
    expect(result.exit).toBe('aborted')
    expect(result.remaining[0].item.abort).toEqual(abort)
    expect(calls.filter(c => c.label === 'impl')).toHaveLength(1)
  })

  test('an implementer no-words abort ends the run as aborted with its whole object in remaining', async () => {
    const calls = []
    const abort = { trigger: 'no-words', reason: 'the private directive record holds no quotation attributed to the user.' }
    const { result } = await simulate({ implementation: implemented({ snapshotSha: BASE, proofPassed: false, abort }), calls })
    expect([result.exit, result.detail]).toEqual(['aborted', 'Hard flag from impl: ' + abort.reason])
    expect(result.remaining).toEqual([{ kind: 'abort', severity: 'CRITICAL', item: { ...implemented({ snapshotSha: BASE, proofPassed: false, abort }), label: 'impl' } }])
    expect(calls.map(c => c.label)).toEqual(['impl'])
  })

  test('an implementer invalid-spec abort ends the run as aborted before any review', async () => {
    const calls = []
    const abort = { trigger: 'invalid-spec', reason: 'session.jsonl:44 speculates: it calls a cause likely, which no record verifies.' }
    const { result } = await simulate({ implementation: implemented({ snapshotSha: BASE, proofPassed: false, abort }), calls })
    expect([result.exit, result.detail]).toEqual(['aborted', 'Hard flag from impl: ' + abort.reason])
    expect(result.remaining).toEqual([{ kind: 'abort', severity: 'CRITICAL', item: { ...implemented({ snapshotSha: BASE, proofPassed: false, abort }), label: 'impl' } }])
    expect(calls.map(c => c.label)).toEqual(['impl'])
  })

  test('an empty quality findings list with its coverage is a complete result', async () => {
    const { result, calls } = await simulate({ reports: { 'review:quality': { findings: [] } } })
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(true)
    expect(calls.filter(c => c.label === 'review:quality')).toHaveLength(1)
  })

  test('distinct defects in one file remain separate, and partial disagreement preserves unattested fixes', async () => {
    const { result } = await simulate({
      reports: { 'review:correctness': { findings: [backed, { ...backed, claim: 'The success response omits its identifier.' }] } },
      verify: { 'verify': verification([
        decision([source('correctness')]),
        decision([source('correctness', 1)], { correction: 'Restore the required success identifier.' }),
      ]) },
      fixes: { 'fix': fixed([disposition(), unresolved('fix:1')]) },
    })
    expect(result.counts.approved).toBe(2)
    expect(result.remaining.some(r => r.item.approved?.key === 'fix:0')).toBe(true)
    expect(result.remaining.find(r => r.kind === 'unfixed-approval').item.approved.key).toBe('fix:1')
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
  })

  test('fixer stage failure preserves unreached approvals', async () => {
    const { result } = await simulate({
      reports: oneReport, verify: approveOne, fail: { 'fix': 'writer interrupted' },
    })
    expect(result.remaining.some(r => r.item.approved?.key === 'fix:0')).toBe(true)
    expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
  })

  test('proof failure and proof-only edits cannot claim completion', async () => {
    for (const response of [fixed([], { proofPassed: false }), fixed([], { snapshotSha: FIXED })]) {
      const { result } = await simulate({ fixes: { 'fix': response } })
      expect(['clean', 'follow-up'].includes(result.exit)).toBe(false)
      expect(result.remaining).not.toHaveLength(0)
    }
  })

  test('input isolation holds at the review barrier', async () => {
    const { calls } = await simulate({
      reports: oneReport,
      verify: { ...approveOne },
      fixes: { 'fix': fixed([disposition()]) },
    })
    const quality = calls.filter(c => c.agentType === 'quality')
    expect(quality).toHaveLength(1)
    expect(quality[0].prompt).toContain(INITIAL)
    for (const c of quality) {
      expect(c.prompt).not.toContain('SPEC')
      expect(c.prompt).not.toContain('AUTHORITY')
      expect(c.prompt).not.toContain('UNTRUSTED implementer')
    }
    for (const c of calls.filter(c => c.phase === 'Review')) {
      expect(c.prompt).not.toContain('PRIOR DECISIONS')
      expect(c.prompt).not.toContain('PENDING FIXES')
    }
    const spec = calls.find(c => c.agentType === 'reviewer-spec-compliance').prompt
    expect(spec).not.toContain('UNTRUSTED implementer')
    expect(spec).toContain('FINDINGS AGAINST THE SPEC')
    for (const type of ['reviewer-inverse-spec', 'project-rule-reader']) {
      const prompt = calls.find(c => c.agentType === type).prompt
      expect(prompt).not.toContain('FINDINGS AGAINST THE SPEC')
      expect(prompt).toContain('.cache/specs/<unit>.yaml')
    }
    expect(calls.find(c => c.agentType === 'cold-alternatives').prompt).not.toContain('SPEC')
  })
})

const bandAid = { ...finding, kind: 'band-aid', severity: 'CRITICAL', claim: 'A guard around the caller compensates for the callee the change should have fixed.' }
const benefit = (ids, fields = {}) => decision(ids, { severity: 'CRITICAL', authority: 'recorded decision: the compatibility shim is removed once the new client ships', ...fields })
const rejectShape = ids => benefit(ids, { action: 'reject', reason: 'The simpler shape breaks the ordering invariant.', evidence: 'src/example.js:4 orders by arrival.' })
const report = (label, findings) => ({ [label]: { findings } })
// Wording checks compare whitespace-normalized prose so a rewrap never changes the checked rule.
const flat = text => text.replace(/\s+/g, ' ')
const template = async name => flat(await Bun.file(new URL(`../agents/${name}.md`, import.meta.url)).text())
// The verifier prompt carries the source findings serialized; the expected list is serialized the same way.
const handedTo = (calls, label, findings) =>
  expect(calls.find(c => c.label === label).prompt).toContain('SOURCE FINDINGS:\n\n' + JSON.stringify(findings))

describe('coder sense check and project-benefit review', () => {
  test('the finding schemas enum-lock kind, with unbacked-choice for the briefed readers only', async () => {
    const { calls } = await simulate()
    const unbriefed = ['quality', ...AUDIT, 'cold-alternatives', 'roaster']
    const readerCalls = calls.filter(c => c.phase === 'Review' || c.agentType === 'roaster')
    expect(readerCalls).toHaveLength(17)
    for (const call of readerCalls) {
      const kinds = unbriefed.includes(call.agentType) ? ['band-aid', 'longer-route'] : ['band-aid', 'longer-route', 'unbacked-choice']
      expect([call.agentType, call.schema.properties.findings.items.properties.kind]).toEqual([call.agentType, { enum: kinds }])
      // The three seats that judge the change against the spec name in evidence where each finding's backing stands.
      const backing = ['reviewer-correctness', 'reviewer-spec-compliance', 'duplicate-checker'].includes(call.agentType)
      expect(call.schema.properties.findings.items.required).toEqual(['file', 'claim', 'severity', 'receipts',
        ...(call.agentType === 'project-rule-reader' ? ['scope'] : []), ...(backing ? ['evidence'] : [])])
      expect([call.agentType, 'evidence' in call.schema.properties.findings.items.properties, 'words' in call.schema.properties.findings.items.properties,
        'verdicts' in call.schema.properties]).toEqual([call.agentType, backing, false, false])
      if (backing) {
        const pointer = call.schema.properties.findings.items.properties.evidence
        expect([pointer.minItems, pointer.items.required, pointer.items.properties.kind]).toEqual([1, ['kind', 'file', 'line', 'key'], { enum: ['transcript', 'rule'] }])
      }
      expect(call.schema.properties.findings.items.properties.receipts.minItems).toBe(1)
    }
  })

  test('a kind-bearing source finding is set to CRITICAL at intake, for readers and roasts alike', async () => {
    const { severity, ...unmarked } = bandAid
    const reader = await simulate({ reports: report('review:dupes', [back({ ...bandAid, severity: 'must-fix' })]),
      verify: { 'verify': verification([rejectShape([source('dupes')])]) } })
    expect(reader.logs).toContain('Project-benefit finding from dupes with kind band-aid set to severity CRITICAL')
    handedTo(reader.calls, 'verify', [{ ...back(bandAid), id: source('dupes'), seat: 'dupes', snapshots: at(INITIAL) }])
    const roast = await simulate({ reports: report('roast', [{ ...unmarked, kind: 'longer-route' }]) })
    expect(roast.logs).toContain('Project-benefit finding from roaster with kind longer-route set to severity CRITICAL')
    expect(roast.result.remaining).toEqual([{ kind: 'roast-finding', severity: 'CRITICAL', item: {
      ...unmarked, kind: 'longer-route', severity: 'CRITICAL', id: source('roaster'), seat: 'roaster', snapshots: at(INITIAL),
    } }])
    const plain = await simulate({ reports: oneReport, verify: { ...approveOne },
      fixes: { 'fix': fixed([disposition()]) } })
    handedTo(plain.calls, 'verify', [{ ...backed, id: source('correctness'), seat: 'correctness', snapshots: at(INITIAL) }])
    expect([plain.result.exit, plain.logs]).toEqual(['follow-up', []])
  })

  test('a decision on a kind-bearing finding throws on a non-CRITICAL severity, cleanup, record or an empty authority', async () => {
    for (const [fields, message] of [
      [{ severity: 'must-fix' }, 'Project-benefit finding must keep CRITICAL severity'],
      [{ action: 'cleanup', correction: 'Record it.' }, 'cannot be dispositioned as cleanup or record'],
      [{ action: 'record', correction: 'Record it.' }, 'cannot be dispositioned as cleanup or record'],
      [{ action: 'reject', authority: ' ' }, 'field authority: must be nonempty text'],
    ]) {
      const { result, calls } = await simulate({ reports: report('review:quality', [bandAid]),
        verify: { 'verify': verification([benefit([source('quality')], fields)]) } })
      expect(result.detail).toContain(message)
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    }
  })

  test('projectBenefitDecisions retains kind-bearing sources and separate cleanup', async () => {
    const approval = benefit([source('inverse')])
    const rejected = rejectShape([source('alternatives')])
    const cleanup = decision([source('rules')], { action: 'cleanup', severity: 'CRITICAL' })
    const { result } = await simulate({
      reports: { ...report('review:inverse', [bandAid]), ...report('review:alternatives', [bandAid]),
        ...report('review:rules', [finding]) },
      verify: { verify: verification([approval, rejected, cleanup]) }, fixes: { fix: fixed([disposition()]) },
    })
    expect(result.exit).toBe('follow-up')
    expect(result.cleanup).toEqual([cleanup])
    expect(result.inverseSpecDecisions).toEqual([approval])
    expect(result.projectBenefitDecisions.map(d => d.decision)).toEqual([approval, rejected])
    expect(result.projectBenefitDecisions.map(d => d.findings[0].id)).toEqual([source('inverse'), source('alternatives')])
  })

  test("an unbriefed reviewer's kind-bearing finding on a mechanism the record is silent about reaches the root unresolved", async () => {
    const silent = benefit([source('quality')], { action: 'unresolved', authority: 'The recorded words hold nothing about the retry wrapper.',
      correction: '' })
    const { result, calls } = await simulate({ reports: report('review:quality', [bandAid]), verify: { 'verify': verification([silent]) } })
    expect([result.exit, result.remaining]).toEqual(['root-resolution', [{ kind: 'open-decision', severity: 'CRITICAL', item: silent }]])
    expect(result.projectBenefitDecisions).toEqual([{ decision: silent,
      findings: [{ id: source('quality'), seat: 'quality', kind: 'band-aid', file: bandAid.file, claim: bandAid.claim }] }])
    expect(calls.some(c => c.phase === 'Fix')).toBe(true)
  })

  test('an implementer sense-check flag aborts before review with its reason preserved', async () => {
    const calls = []
    const abort = { trigger: 'sense-check', reason: 'the request extends the retry wrapper, which the recorded words describe as deleted and rewritten as a direct call.' }
    const { result } = await simulate({ implementation: implemented({ abort, snapshotSha: BASE, proofPassed: false,
      senseCheck: { passed: false, recordSilent: false, note: 'the retry wrapper' } }), calls })
    expect(result.exit).toBe('aborted')
    expect(result.remaining[0].item.abort).toEqual(abort)
    expect(calls.map(c => c.label)).toEqual(['impl'])
  })

  test('a fixer sense-check flag in a valid FIX object ends the run with its structured result preserved', async () => {
    const abort = { trigger: 'sense-check', reason: 'the approved correction patches the compatibility shim the recorded words describe as deleted.' }
    const { result, calls } = await simulate({ reports: report('review:correctness', [backed, { ...backed, claim: 'A second defect.' }]),
      verify: { 'verify': verification([decision([source('correctness')]), decision([source('correctness', 1)])]) },
      fixes: { 'fix': fixed([disposition(), disposition('fix:1', 'blocked')], { abort }) } })
    expect(result.exit).toBe('aborted')
    expect(result.detail).toContain(abort.reason)
    expect(result.remaining.find(r => r.kind === 'abort').item.dispositions[1].key).toBe('fix:1')
    expect(result.remaining.filter(r => r.kind === 'unfixed-approval')).toHaveLength(1)
    expect(result.remaining.filter(r => r.kind === 'unattested-fix')).toHaveLength(1)
    expect(calls.filter(c => c.phase === 'Verify')).toHaveLength(1)
  })

  test('the coder and verifier templates, law 8 and the shared authority constant state the four triggers and the kind rules', async () => {
    for (const [name, phrases] of [
      ['implementer', ['In a main run, sense check before any edit: read the spec and ask two questions.', 'Words that say nothing about the mechanism rule nothing out: the check passes and senseCheck records recordSilent true.',
        'Hard-flag and stop on one of four triggers, with one abort field and one disposition',
        'or to invalid-spec for an invalid spec, and abort.reason to the reason.',
        "After a sense-check flag the unit continues only on the user's answer, which a new run receives in a copy of the spec with that answer added.",
        'A spec without the user\'s words is not a silent one.', 'set abort.trigger to no-words with the reason in abort.reason and leave the tree unmodified',
        'holds no entry of author user', "An entry of author assistant, a paraphrase, a summary or a design document's decision list is not the user's words."]],
      ['fixer', ['Bounded sense check before your first write, on every approved correction', "itself a band-aid on a mechanism the user's words in the spec do not call for, where they describe deletion or a rewrite",
        "no agent's justification and no root statement substitutes for it", "You do not repeat the implementer's request-level sense check",
        'holds no entry of author user sets abort.trigger to no-words before your first write']],
      ['finding-verifier', ['is CRITICAL, and neither cleanup nor record is available for it', "supply the quote yourself for an unbriefed seat's finding (quality, cold alternatives, an audit seat)",
        'Where the spec holds no words of the user about the mechanism, state that silence in plain words in the authority field',
        "Approve-fix a project-benefit finding for the deletion or rewrite the user's words describe, or for a deletion or rewrite that improves code quality without changing anything the spec specifies.",
        'the authority field also names the rule of this template on corrections that improve code quality, and the evidence field quotes the reviewer\'s rule or the project rule the correction serves.',
        "Keeping the flagged shape of a project-benefit finding needs the user's word"]],
    ]) { const text = await template(name); for (const phrase of phrases) expect(text).toContain(phrase) }
    for (const stale of ['approve-fix is then unavailable', 'Approve-fix only for the deletion or rewrite']) expect(await template('finding-verifier')).not.toContain(stale)
    const flatSkill = flat(skill)
    expect(flatSkill).toContain('8. **HARD-FLAG SEMANTICS.** A hard flag (agent stops, script aborts) has exactly four triggers.')
    expect(flatSkill).toContain('**Four triggers, one field, one disposition**')
    for (const phrase of ['exactly one trigger', 'One trigger, one field', 'one trigger only', 'single abort condition',
      'exactly two triggers', 'Two triggers, one field', 'two triggers, one abort field', 'abort on two triggers']) expect(flatSkill).not.toContain(phrase)
    const { calls } = await simulate()
    for (const type of ['implementer', 'fixer', 'finding-verifier', 'reviewer-inverse-spec']) {
      expect(flat(calls.find(c => c.agentType === type).prompt)).toContain('has FOUR triggers, one abort field, one disposition. First:')
      expect(calls.find(c => c.agentType === type).prompt).toContain('Second, WRITING SEATS ONLY: a failed sense')
      expect(calls.find(c => c.agentType === type).prompt).toContain('Third, WRITING SEATS ONLY: no-words.')
      expect(calls.find(c => c.agentType === type).prompt).toContain('Never report that gap as a limitation and proceed.')
      expect(calls.find(c => c.agentType === type).prompt).toContain('Fourth, EVERY STAGE THAT READS THE SPEC: invalid-spec.')
      expect(calls.find(c => c.agentType === type).prompt).not.toContain('is a root-action limitation')
    }
    for (const type of ['quality', ...AUDIT, 'cold-alternatives', 'roaster']) expect(calls.find(c => c.agentType === type).prompt).not.toContain('sense check')
  })
})

// Field names every template must name (the gap-finder names none: the caller's schema defines its object).
const BRIEFED = ['implementer', 'fixer', 'finding-verifier', 'reviewer-correctness', 'reviewer-spec-compliance', 'duplicate-checker', 'reviewer-inverse-spec', 'project-rule-reader']
const retried = (calls, label) => calls.filter(c => c.label === label)
const FAILED = 'HOW YOUR PREVIOUS ATTEMPT FAILED, plainly: '

describe('spec provenance instructions and routing', () => {

  test('only the fixer receives the check command, and the implementer runs focused checks', async () => {
    const { calls } = await simulate()
    const fixers = calls.filter(c => c.agentType === 'fixer')
    expect(fixers.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect([call.label, call.prompt.includes('CHECK COMMAND')]).toEqual([call.label, fixers.includes(call)])
      expect([call.label, call.prompt.includes('<the check command>')]).toEqual([call.label, fixers.includes(call)])
      expect([call.label, call.prompt.includes('FOCUSED CHECKS')]).toEqual([call.label, call.label === 'impl'])
    }
    const impl = flat(calls.find(c => c.label === 'impl').prompt)
    expect(impl).toContain('FOCUSED CHECKS, implementer only: after your last write, run only the checks that cover what you changed,' +
      ' bare and once: its tests, and its type check or build where the project has one. Never run the full check:' +
      ' the fixer runs it once after its corrections, and a full run here goes stale when the fixer changes a file.')
    expect(flat(fixers[0].prompt)).toContain('CHECK COMMAND, the last writer of the run only (run bare after your last write, and quote' +
      ' each run in checks with the command exactly as written here): <the check command>')
  })

  test('authority-aware templates trace authority to an entry of author user, and no template or schema knows a criterion', async () => {
    for (const name of ['reviewer-spec-compliance', 'reviewer-inverse-spec', 'finding-verifier']) {
      const prose = flat(await template(name))
      expect([name, prose.includes('entry of author user')]).toEqual([name, true])
      for (const phrase of ['item id', 'ordinal', 'args.criteriaCount', '{ ordinal, id }', 'criterion']) {
        expect([name, phrase, prose.includes(phrase)]).toEqual([name, phrase, false])
      }
    }
    const { calls } = await simulate()
    for (const call of calls) expect([call.label, 'verdicts' in (call.schema.properties ?? {})]).toEqual([call.label, false])
  })

})

describe('structured stage output', () => {
  test('no stage schema declares a prose field, every root is closed, and only briefed stages declare abort', async () => {
    const { calls } = await simulate()
    expect(calls.every(c => c.schema)).toBe(true)
    for (const { schema, agentType, label } of calls) {
      const briefed = BRIEFED.includes(agentType)
      expect([label, schema.properties.report, schema.additionalProperties, schema.required.includes('abort'), 'abort' in schema.properties])
        .toEqual([label, undefined, false, briefed, briefed])
      if (briefed) expect(schema.properties.abort.properties.trigger).toEqual({ enum: ['none', 'directive-conflict', 'sense-check', 'no-words', 'invalid-spec'] })
    }
    const seats = calls.filter(c => c.phase === 'Review' || c.agentType === 'roaster')
    expect(new Set(seats.map(c => c.schema)).size).toBe(8)
    // The audit reviewers return the object quality returns, under its schema.
    for (const seat of AUDIT) expect([seat, calls.find(c => c.agentType === seat).schema]).toEqual([seat, calls.find(c => c.agentType === 'quality').schema])
    for (const seat of seats) expect(seat.schema.properties.coverage.items.required).toEqual(['what', 'how'])
    expect(calls.find(c => c.label === 'impl').schema.properties.checks.items.properties.output).toEqual({ type: 'string', maxLength: 6000 })
    const [implSchema, fixSchema] = ['implementer', 'fixer'].map(type => calls.find(c => c.agentType === type).schema)
    expect(fixSchema.required).toContain('premises')
    expect(fixSchema.properties.premises).toEqual(implSchema.properties.premises)
    const verify = calls.find(c => c.phase === 'Verify').schema.properties
    for (const field of ['writerScope', 'decisions', 'issues']) expect([field, verify[field].items.additionalProperties]).toEqual([field, false])
  })

  test('a finding of a concern seat without evidence is retried with the cause named, then thrown, and the run needs no count', async () => {
    const { evidence, ...unquoted } = backed
    const missing = 'Missing the evidence the finding rests on: ' + finding.claim
    for (const seat of ['correctness', 'spec', 'dupes']) {
      const { result, calls } = await simulate({ reports: { ['review:' + seat]: { findings: [unquoted] } } })
      expect([seat, ['clean', 'follow-up'].includes(result.exit), retried(calls, 'review:' + seat).length]).toEqual([seat, false, 3])
      expect(retried(calls, 'review:' + seat)[2].prompt).toContain(FAILED + missing)
      expect(result.detail).toContain('FAIL-FAST: review:' + seat + ' returned no complete result after 3 attempts: ' + missing)
      expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    }
    // The other seats owe no quote, and a launch without a criteria count runs.
    const { result } = await simulate({ reports: { 'review:rules': { findings: [{ ...unquoted, scope: 'in-change' }] } }, args: launchArgs(),
      verify: { verify: verification([decision([source('rules')])]) }, fixes: { fix: fixed([disposition()]) } })
    expect([result.exit, result.detail]).toEqual(['follow-up', 'The pass completed with items requiring follow-up.'])
    expect('criteriaCount' in launchArgs()).toBe(false)
  })

  for (const [name, seat, fields, message] of [
    ['a backed finding without a receipt', 'spec', { findings: [{ ...backed, receipts: [] }] }, 'finding without a receipt'],
    ['a backed finding whose transcript evidence names no key', 'dupes', { findings: [{ ...backed, evidence: [{ kind: 'transcript', file: 'session.jsonl', line: 9, key: [] }] }] },
      'Missing the JSON key path of the transcript evidence of'],
    ['a backed finding whose evidence names no file', 'spec', { findings: [{ ...backed, evidence: [{ kind: 'rule', file: '', line: 3, key: [] }] }] },
      'Missing the file of the evidence of'],
    ['a backed finding whose rule evidence names a key', 'correctness', { findings: [{ ...backed, evidence: [{ kind: 'rule', file: 'CLAUDE.md', line: 3, key: ['message'] }] }] },
      'A rule evidence entry takes an empty key path'],
    ['a finding without a receipt', 'quality', { findings: [{ ...finding, receipts: [] }] }, 'finding without a receipt'],
  ]) {
    test(`${name} is retried and then thrown`, async () => {
      const { result, calls } = await simulate({ reports: { [`review:${seat}`]: fields } })
      expect([['clean', 'follow-up'].includes(result.exit), retried(calls, `review:${seat}`).length, calls.some(c => c.phase === 'Verify')]).toEqual([false, 3, false])
      expect(result.detail).toContain(message)
    })
  }

  test('a reviewer whose concern has nothing to judge in the change is accepted with empty coverage', async () => {
    const { result, calls } = await simulate({ reports: { 'review:type-safety': { coverage: [], findings: [], limitations: [] } } })
    expect([['clean', 'follow-up'].includes(result.exit), retried(calls, 'review:type-safety').length]).toEqual([true, 1])
  })

  for (const [name, fields, message] of [
    ['a new snapshot without a commit', { commits: [] }, 'the new snapshot of . needs commits in it'],
    ['clean disagreeing with its status output', { git: { head: INITIAL, status: ' M src/example.js' } }, 'clean disagrees with git.status in .'],
    ['an empty git.head', { git: { head: '', status: '' } }, 'git.head "" of . differs from snapshotSha "' + INITIAL + '"'],
    ['git.head disagreeing with snapshotSha', { git: { head: BASE, status: '' } }, 'git.head "' + BASE + '" of . differs from snapshotSha "' + INITIAL + '"'],
    ['no quoted check', { checks: [] }, 'no check is quoted'],
    ['proofPassed true and a failed check', { checks: [check(false)] }, 'proofPassed is true, but the last quoted run of "bun test tests/example.test.js" failed'],
    ['proofPassed true, a passed type check and failed focused tests', { checks: [check(true, 'tsc --noEmit'), check(false)] },
      'proofPassed is true, but the last quoted run of "bun test tests/example.test.js" failed'],
    ['proofPassed true and a passed run followed by a failed rerun', { checks: [check(true), check(false)] },
      'proofPassed is true, but the last quoted run of "bun test tests/example.test.js" failed'],
    ['proofPassed false and every last run passed', { proofPassed: false, checks: [check(false), check(true)] },
      'proofPassed is false, but the last quoted run of every check command passed'],
  ]) {
    test(`an implementer with ${name} is retried and then thrown`, async () => {
      const calls = []
      const { result } = await simulate({ implementation: implemented(fields), calls })
      expect(result.exit).toBe('failed')
      expect(result.detail).toContain(message)
      expect([retried(calls, 'impl').length, calls.some(c => c.phase === 'Review')]).toEqual([3, false])
    })
  }

  // The last run of each focused check command decides that command, so a passed rerun supersedes a
  // failure, and a failed command beside a passed one reaches the run as a failed proof.
  for (const [name, checks, proofPassed] of [
    ['a failed check followed by a passed rerun', [check(false), check(true)], true],
    ['a passed type check and failed focused tests', [check(true, 'tsc --noEmit'), check(false)], false],
    ['a passed type check and focused tests whose last rerun failed', [check(true, 'tsc --noEmit'), check(true), check(false)], false],
  ]) {
    test(`an implementer with ${name} is accepted on the first attempt`, async () => {
      const calls = []
      const { result } = await simulate({ implementation: implemented({ checks, proofPassed }), calls })
      expect(retried(calls, 'impl')).toHaveLength(1)
      expect([result.exit, result.remaining.map(r => r.kind)]).toEqual(proofPassed ? ['clean', []] : ['root-resolution', ['failed-proof']])
    })
  }

  for (const [name, checks, message] of unprovenFixerChecks) {
    test(`a proof-only fixer, or one that committed a correction, with ${name} is retried and then thrown`, async () => {
      for (const options of [{}, { reports: oneReport, verify: approveOne, dispositions: [disposition()] }]) {
        const calls = []
        const { result } = await simulate({ ...options, fixes: { fix: fixed(options.dispositions, { checks }) }, calls })
        expect([result.exit, retried(calls, 'fix').length]).toEqual(['failed', 3])
        expect(result.detail).toContain(message)
      }
    })
  }

  // The stage-failure item keeps each refused fixer object with its quoted checks and commits, and
  // the run accepts none of them: snapshots and proof stay the implementer's, and no approval closes.
  for (const [name, checks, message] of unprovenFixerChecks) {
    test(`a fixer refused three times for ${name} leaves its refused objects in the stage-failure item`, async () => {
      for (const [dispositions, commits] of [[[], []],
        [[disposition()], [{ sha: FIXED, subject: 'apply the approved corrections', repository: '.' }]]]) {
        const implementation = implemented()
        const options = dispositions.length ? { reports: oneReport, verify: approveOne } : {}
        const { result } = await simulate({ ...options, implementation, fixes: { fix: fixed(dispositions, { checks }) } })
        const failure = result.remaining.find(r => r.kind === 'stage-failure').item
        expect([failure.label, failure.message]).toEqual(['fix', failedThrice('fix', message)])
        expect(failure.refused.map(({ failure, result }) => ({ failure, checks: result.checks, commits: result.commits, dispositions: result.dispositions })))
          .toEqual(Array(3).fill({ failure: message, checks, commits, dispositions }))
        expect([result.snapshots, result.proof]).toEqual([at(INITIAL), { checks: implementation.checks }])
        expect(result.remaining.filter(r => r.kind === 'unfixed-approval').map(r => r.item.approved.key)).toEqual(dispositions.map(d => d.key))
        expect(result.remaining.some(r => r.kind === 'unattested-fix')).toBe(false)
      }
    })
  }

  for (const [name, checks, proofPassed] of provenFixerChecks) {
    test(`a fixer with ${name} is accepted on the first attempt`, async () => {
      const calls = []
      const { result } = await simulate({ fixes: { fix: fixed([], { checks, proofPassed }) }, calls })
      expect(retried(calls, 'fix').length).toBe(1)
      expect([result.exit, result.remaining.map(r => r.kind)]).toEqual(proofPassed ? ['clean', []] : ['root-resolution', ['failed-proof']])
    })
  }

  test('an implementer that committed nothing owes no check, so a blocking spec finding needs none quoted', async () => {
    const limitation = { what: 'The joint-impossibility finding leaves the spec unbuildable as written.', effect: 'blocks' }
    const { result, calls } = await simulate({ implementation: implemented({ snapshotSha: BASE, checks: [], limitations: [limitation],
      specFindings: [specFinding([9, 11], 'joint-impossibility')] }) })
    expect([retried(calls, 'impl').length, result.exit, result.detail]).toEqual([1, 'root-resolution', 'Blocking limitation from impl.'])
  })

  test('blocking limitations from every stage but the reading seats return their label; narrowing ones continue', async () => {
    const limitation = { what: 'a required resource is unavailable', effect: 'blocks' }
    for (const label of ['impl', 'verify', 'fix', 'roast']) {
      const { result, calls } = await simulate({
        implementation: label === 'impl' ? implemented({ limitations: [limitation] }) : undefined,
        reports: { [label]: { limitations: [limitation] } },
        verify: label === 'verify' ? { verify: verification([], { limitations: [limitation] }) } : {},
        fixes: label === 'fix' ? { fix: fixed([], { limitations: [limitation] }) } : {},
      })
      expect(result.exit).toBe('root-resolution')
      expect(result.remaining).toContainEqual({ kind: 'blocking-limitation', severity: 'CRITICAL', item: { ...limitation, label } })
      if (label === 'impl') expect(calls.map(c => c.label)).toEqual(['impl'])
      if (label === 'verify') expect(calls.some(c => c.phase === 'Fix')).toBe(true)
    }
    const { result } = await simulate({ reports: { 'review:rules': { limitations: [{ ...limitation, effect: 'narrows' }] } } })
    expect(result.exit).toBe('clean')
  })

  test('a reading seat\'s blocking limitation reaches the verifier and the root only as the verifier\'s issue', async () => {
    const limitation = { what: 'the integration service is unreachable from this seat', effect: 'blocks' }
    const issue = openIssue('Reach the integration service: ' + limitation.what)
    for (const seat of readers) {
      const label = 'review:' + seat
      const { result, calls } = await simulate({
        reports: { ...oneReport, [label]: { ...oneReport[label], limitations: [limitation] } },
        verify: { verify: verification([decision([source('correctness')])], { issues: [issue] }) },
        fixes: { fix: fixed([disposition()]) },
      })
      expect([result.exit, result.detail]).toEqual(['root-resolution', 'Review or verification left items for the root.'])
      expect(result.remaining.map(r => r.kind)).toEqual(['verifier-issue', 'unattested-fix'])
      expect(result.remaining[0]).toEqual({ kind: 'verifier-issue', severity: 'CRITICAL', item: issue })
      expect(calls.find(c => c.label === 'verify').prompt).toContain(limitation.what)
      expect(calls.filter(c => c.phase === 'Fix').map(c => c.label).sort()).toEqual(['fix', 'roast'])
    }
    // A limitation the verifier discards leaves nothing for the root.
    const { result } = await simulate({
      reports: { ...oneReport, 'review:rules': { limitations: [limitation] } },
      verify: approveOne, fixes: { fix: fixed([disposition()]) },
    })
    expect(result.remaining.map(r => r.kind)).toEqual(['unattested-fix'])
  })

  test('a writerScope entry reported out of scope ends the run for root resolution with a writer-scope item, without a retry', async () => {
    const entry = { repository: '.', sha: INITIAL, ok: false, note: 'the commit also rewrote an unrelated helper' }
    const { result: refused, calls } = await simulate({ verify: { 'verify': verification([], { writerScope: [entry] }) } })
    expect([refused.exit, refused.remaining]).toEqual(['root-resolution', [{ kind: 'writer-scope', severity: 'CRITICAL', item: entry }]])
    expect([retried(calls, 'verify').length, calls.some(c => c.phase === 'Fix')]).toEqual([1, false])
    const { result } = await simulate({ verify: { 'verify': verification([], { writerScope: [{ repository: '.', sha: INITIAL, ok: true, note: '' }] }) } })
    expect([result.exit, result.remaining]).toEqual(['clean', []])
  })

  test('the finding verifier needs git.head equal to snapshotSha and one writerScope entry per writer commit, and the implementer object is handed over', async () => {
    const differs = await simulate({ verify: { 'verify': verification([], { repositories: [{ path: '.', snapshotSha: INITIAL, clean: true, git: { head: BASE, status: '' } }] }) } })
    expect([differs.result.detail.includes('git.head "' + BASE + '" of . differs from snapshotSha "' + INITIAL + '"'), retried(differs.calls, 'verify').length]).toEqual([true, 3])
    const scope = await simulate({ verify: { 'verify': verification([], { writerScope: [] }) } })
    expect(scope.result.detail).toContain('Missing writer commit in writerScope')
    const { calls } = await simulate({ reports: oneReport, verify: { ...approveOne },
      fixes: { 'fix': fixed([disposition()]) } })
    const implObject = JSON.stringify(implemented())
    expect(calls.find(c => c.label === 'verify').prompt).toContain('WRITER OBJECTS (UNTRUSTED):\n\n[' + implObject + ']')
    for (const type of ['reviewer-correctness', 'duplicate-checker']) {
      expect(calls.find(c => c.agentType === type).prompt).toContain('UNTRUSTED implementer claims (its returned object):\n\n' + implObject)
    }
    for (const type of ['reviewer-spec-compliance', 'quality', ...AUDIT, 'reviewer-inverse-spec', 'project-rule-reader', 'cold-alternatives', 'roaster', 'fixer']) {
      expect(calls.find(c => c.agentType === type).prompt).not.toContain(implObject)
    }
  })
})
describe('one-pass remaining-items handoff', () => {
  test('all exit values have a detail and every ending returns the run record', async () => {
    for (const [exit, options] of [
      ['clean', {}], ['follow-up', { reports: { roast: { findings: [finding] } } }],
      ['root-resolution', { implementation: implemented({ proofPassed: false }) }],
      ['aborted', { implementation: implemented({ abort: { trigger: 'sense-check', reason: 'The mechanism must be removed.' } }) }],
      ['failed', { fail: { impl: 'provider unavailable' } }],
    ]) {
      const { result, calls } = await simulate(options)
      expect(result.exit).toBe(exit)
      expect(result.detail.length).toBeGreaterThan(0)
      expect(Object.keys(result).sort()).toEqual(['exit', 'detail', 'remaining', 'toFix', 'decisions', 'dispositions', 'specSuggestions', 'proof',
        'spec', 'base', 'snapshots', 'artifacts', 'acceptance', 'counts', 'cleanup', 'inverseSpecDecisions', 'projectBenefitDecisions'].sort())
      expect(calls.filter(c => c.phase === 'Verify').length).toBeLessThanOrEqual(1)
    }
  })

  test('roast findings and limitations return intact without reaching a verifier', async () => {
    const limitation = { what: 'Integration service unavailable.', effect: 'narrows' }
    const blocking = { what: 'Required source object unavailable.', effect: 'blocks' }
    for (const severity of ['nit', 'should-fix', 'must-fix', 'CRITICAL']) {
      const { result, calls } = await simulate({ reports: { roast: {
        findings: [{ ...finding, severity }], limitations: [blocking, limitation],
      } } })
      expect(result.exit).toBe('root-resolution')
      expect(result.remaining).toEqual([
        { kind: 'roast-finding', severity, item: {
          ...finding, severity, id: 'roaster:0', seat: 'roaster', snapshots: at(INITIAL),
        } },
        { kind: 'roast-limitation', severity: 'should-fix', item: limitation },
        { kind: 'blocking-limitation', severity: 'CRITICAL', item: { ...blocking, label: 'roast' } },
      ])
      const verifiers = calls.filter(c => c.phase === 'Verify')
      expect(verifiers).toHaveLength(1)
      expect(verifiers[0].prompt).not.toContain('roaster:0')
      expect(verifiers[0].schema.properties.closures).toBeUndefined()
      expect(calls.map(c => c.label)).toEqual(['impl', ...readers.map(s => 'review:' + s), 'verify', 'fix', 'roast'])
    }
  })

  test('failed writer proofs return checks with the writer label', async () => {
    for (const label of ['impl', 'fix']) {
      const { result, calls } = await simulate(label === 'impl'
        ? { implementation: implemented({ proofPassed: false }) }
        : { fixes: { fix: fixed([], { proofPassed: false }) } })
      expect(result.exit).toBe('root-resolution')
      const checks = [label === 'impl' ? check(false) : fullCheck(false)]
      expect(result.remaining).toEqual([{ kind: 'failed-proof', severity: 'CRITICAL', item: { label, checks } }])
      expect(result.proof.checks).toEqual(checks)
      if (label === 'impl') expect(calls.map(c => c.label)).toEqual(['impl'])
    }
  })

  test('an implementer that ends the run returns its false premises with its label; one that goes on hands them to the verifier', async () => {
    const holding = { claim: 'The tree holds src/example.js.', holds: true, note: 'It does.' }
    const premise = { claim: 'The prompt says src/example.js already returns the error.', holds: false, note: 'src/example.js:12 still catches it.' }
    const limitation = { what: 'A required resource is unavailable.', effect: 'blocks' }
    for (const [ending, fields] of [['failed-proof', { proofPassed: false }], ['blocking-limitation', { limitations: [limitation] }]]) {
      const { result, calls } = await simulate({ implementation: implemented({ ...fields, premises: [holding, premise] }) })
      expect([ending, result.exit, calls.map(c => c.label)]).toEqual([ending, 'root-resolution', ['impl']])
      expect([ending, result.remaining.map(r => r.kind)]).toEqual([ending, [ending, 'false-premise']])
      expect([ending, result.remaining[1]]).toEqual([ending, { kind: 'false-premise', severity: 'must-fix', item: { ...premise, label: 'impl' } }])
    }
    const { result, calls } = await simulate({ implementation: implemented({ premises: [holding, premise] }) })
    expect([result.exit, result.remaining]).toEqual(['clean', []])
    expect(calls.find(c => c.phase === 'Verify').prompt).toContain(premise.note)
  })

  test('an implementer that ends the run returns its narrowing limitations with its label; one that goes on hands them to the verifier', async () => {
    const narrows = { what: 'The integration check could read only the request handlers.', effect: 'narrows' }
    const blocks = { what: 'A required resource is unavailable.', effect: 'blocks' }
    for (const [ending, fields] of [['failed-proof', { proofPassed: false, limitations: [narrows] }],
      ['blocking-limitation', { limitations: [blocks, narrows] }]]) {
      const { result, calls } = await simulate({ implementation: implemented(fields) })
      expect([ending, result.exit, calls.map(c => c.label)]).toEqual([ending, 'root-resolution', ['impl']])
      expect([ending, result.remaining.map(r => r.kind)]).toEqual([ending, [ending, 'impl-limitation']])
      expect([ending, result.remaining[1]]).toEqual([ending, { kind: 'impl-limitation', severity: 'should-fix', item: { ...narrows, label: 'impl' } }])
    }
    const { result, calls } = await simulate({ implementation: implemented({ limitations: [narrows] }) })
    expect([result.exit, result.remaining]).toEqual(['clean', []])
    expect(calls.find(c => c.phase === 'Verify').prompt).toContain(narrows.what)
  })

  test('verifier issues retain their full objects beside the approvals the fixer applied', async () => {
    const issue = openIssue('Required evidence is unavailable.')
    const approval = decision([source('correctness')])
    const { result } = await simulate({ reports: oneReport, verify: { verify: verification([approval], { issues: [issue] }) },
      fixes: { fix: fixed([disposition()]) } })
    expect(result.exit).toBe('root-resolution')
    expect(result.remaining[0]).toEqual({ kind: 'verifier-issue', severity: 'CRITICAL', item: issue })
    expect(result.remaining[1].kind).toBe('unattested-fix')
    expect(result.remaining[1].item.approved).toEqual({ ...approval, key: 'fix:0', pointers: backed.evidence })
    expect(result.remaining).toHaveLength(2)
  })

  const toFixIssue = openIssue('Required evidence is unavailable.')
  const toFixRoastFinding = { ...finding, claim: 'The retry loop never ends.' }
  const toFixDecisions = [decision([source('correctness', 0)]), decision([source('correctness', 1)], { action: 'unresolved', correction: '' }),
    decision([source('correctness', 2)]), decision([source('correctness', 3)])]
  const approvalAnswers = [disposition('fix:0'), disposition('fix:1', 'rejected'), disposition('fix:2', 'blocked')]
  const simulateToFix = fix => simulate({ implementation: implemented({ specFindings: [specFinding([20], 'reality-drift')] }),
    specCheck: passedCheck(mainLaunchValues(launchArgs()), {}, { spec: SPEC_PATH, sha256: 'e'.repeat(64), specLines: 4 }),
    reports: { 'review:correctness': { findings: [backed, backed, backed, backed] }, roast: { findings: [toFixRoastFinding] } },
    verify: { verify: verification(toFixDecisions, { issues: [toFixIssue] }) }, fixes: { fix } })

  test('the run returns to be fixed every spec finding, every decision and issue of the verifier and every roast finding, apart from an approval its accepted fixer fixed or disproved, beside the spec its check passed on', async () => {
    const { result } = await simulateToFix(fixed(approvalAnswers))
    expect(result.toFix).toEqual([{ source: 'impl:0', finding: specFinding([20], 'reality-drift') },
      { source: 'verify:1', decision: toFixDecisions[1] }, { source: 'verify:3', decision: { ...toFixDecisions[3], disposition: approvalAnswers[2] } },
      { source: 'issue:0', issue: toFixIssue },
      { source: 'roaster:0', finding: { ...toFixRoastFinding, id: 'roaster:0', seat: 'roaster', snapshots: at(INITIAL) } }])
    expect(result.spec).toEqual({ path: SPEC_PATH, sha256: 'e'.repeat(64), lines: 4 })
  })

  test('the answers of a fixer that aborted close no approval, and the run returns every decision to be fixed', async () => {
    const abort = { trigger: 'sense-check', reason: 'The correction patches a mechanism the user\'s words describe as removed.' }
    const { result } = await simulateToFix(fixed(approvalAnswers, { abort, shouldCommit: false }))
    expect([result.exit, result.toFix.map(item => item.source)])
      .toEqual(['aborted', ['impl:0', 'verify:0', 'verify:1', 'verify:2', 'verify:3', 'issue:0', 'roaster:0']])
  })

  test('a writer commit outside its scope still keeps the fixer from running', async () => {
    const entry = { repository: '.', sha: INITIAL, ok: false, note: 'the commit also rewrote an unrelated helper' }
    const approval = decision([source('correctness')])
    const { result, calls } = await simulate({ reports: oneReport,
      verify: { verify: verification([approval], { writerScope: [entry] }) } })
    expect(result.exit).toBe('root-resolution')
    expect(result.remaining.map(r => r.kind)).toEqual(['writer-scope', 'unfixed-approval'])
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('even a low-severity fixed key is unattested with its approval and commit evidence', async () => {
    const approval = decision([source('correctness')], { severity: 'nit' })
    const { result, calls } = await simulate({ reports: oneReport, verify: { verify: verification([approval]) },
      fixes: { fix: fixed([disposition()]) } })
    expect(result.exit).toBe('follow-up')
    expect(result.remaining).toEqual([{ kind: 'unattested-fix', severity: 'nit', item: {
      approved: { ...approval, key: 'fix:0', pointers: backed.evidence }, disposition: disposition(), snapshots: at(FIXED),
      commits: [{ sha: FIXED, subject: 'apply the approved corrections', repository: '.' }],
    } }])
    expect(calls.filter(c => c.phase === 'Verify')).toHaveLength(1)
  })

  test('a failed fixer preserves the settled roast and unreached approvals', async () => {
    const { result } = await simulate({ reports: { ...oneReport, roast: { findings: [finding] } },
      verify: approveOne, fail: { fix: 'writer interrupted' } })
    expect(result.exit).toBe('failed')
    expect(result.remaining.map(r => r.kind)).toEqual(['stage-failure', 'roast-finding', 'unfixed-approval'])
    expect(result.remaining[0].item).toEqual({ label: 'fix', message: failedThrice('fix', 'writer interrupted'), refused: [] })
    expect(result.remaining[1].item.snapshots).toEqual(at(INITIAL))
  })

  test('a reader hard flag remains an abort beside a peer limitation', async () => {
    const abort = { trigger: 'directive-conflict', reason: 'The requested scope contradicts the record.' }
    const { result } = await simulate({ reports: {
      'review:correctness': { limitations: [{ what: 'Required service unavailable.', effect: 'blocks' }] },
      'review:inverse': { abort },
    } })
    expect([result.exit, result.detail]).toEqual([
      'aborted', 'Hard flag from review:inverse: ' + abort.reason,
    ])
    expect(result.remaining.map(r => r.kind)).toEqual(['abort'])
    expect(result.remaining[0].item.abort).toEqual(abort)
  })

  test('a fixer proof failure names the cause when the roaster aborts', async () => {
    const abort = { trigger: 'directive-conflict', reason: 'The scope contradicts the record.' }
    const { result } = await simulate({
      fixes: { fix: fixed([], { proofPassed: false }) }, reports: { roast: { abort } },
    })
    expect([result.exit, result.detail]).toEqual([
      'root-resolution', 'Required checks failed in fix.',
    ])
    expect(result.remaining.map(r => r.kind)).toEqual(['failed-proof', 'abort'])
    expect(result.remaining[0].item).toEqual({ label: 'fix', checks: [fullCheck(false)] })
    expect(result.remaining[1].item.abort).toEqual(abort)
    expect(result.remaining[1].item.label).toBe('roast')
  })

  test('both concurrent failures survive, with the fixer naming the cause', async () => {
    const { result } = await simulate({ fail: { fix: 'writer unavailable', roast: 'roaster unavailable' } })
    expect([result.exit, result.detail]).toEqual(['failed', failedThrice('fix', 'writer unavailable')])
    expect(result.remaining).toEqual(['fix', 'roast'].map(label => ({ kind: 'stage-failure', severity: 'CRITICAL',
      item: { label, message: failedThrice(label, label === 'fix' ? 'writer unavailable' : 'roaster unavailable'), refused: [] } })))
  })

  test('an aborting fixer keeps the settled roast and its whole abort object', async () => {
    const abort = { trigger: 'sense-check', reason: 'The approved correction extends a rejected mechanism.' }
    const { result } = await simulate({ reports: { ...oneReport, roast: { findings: [finding] } }, verify: approveOne,
      fixes: { fix: fixed([disposition()], { abort }) } })
    expect(result.exit).toBe('aborted')
    expect(result.remaining.map(r => r.kind)).toEqual(['abort', 'roast-finding', 'unattested-fix'])
    expect(result.remaining[0].item.abort).toEqual(abort)
    expect(result.remaining[0].item.label).toBe('fix')
  })

  test('the writers and the briefed seats name the writing-style and hygiene files under the plugin root, the unbriefed seats and the roaster name none, and nothing tells a stage to load the skill', async () => {
    const required = 'REQUIRED: before you write, read the files <plugin root>/skills/writing-style/SKILL.md and <plugin root>/skills/hygiene/SKILL.md with the Read tool,\n' +
      'and follow them in every comment, document, commit message and returned string.'
    const { calls } = await simulate()
    const unbriefed = ['quality', 'alternatives', ...AUDIT].map(seat => 'review:' + seat)
    const stages = calls.filter(c => !['roast', ...unbriefed].includes(c.label))
    expect(stages.map(c => c.label)).toEqual(['impl', ...['correctness', 'spec', 'dupes', 'inverse', 'rules'].map(seat => 'review:' + seat), 'verify', 'fix'])
    for (const call of stages) expect([call.label, call.prompt.split(required).length - 1]).toEqual([call.label, 1])
        // The unbriefed seats get no writing-style order: their findings go to the finding verifier only.
    for (const label of unbriefed) expect([label, calls.find(c => c.label === label).prompt.includes('writing-style')]).toEqual([label, false])
    // The roaster has no Read tool and reads only Git objects, so its prompt names no file to read.
    const roast = calls.find(c => c.label === 'roast').prompt
    expect([roast.includes('writing-style'), /read the file/i.test(roast)]).toEqual([false, false])
    expect(skeleton).toContain("UNIT.pluginRoot + '/skills/writing-style/SKILL.md and ' + UNIT.pluginRoot +")
    expect(skeleton).toContain("'/skills/hygiene/SKILL.md with the Read tool,'")
    expect(skeleton).not.toMatch(/load the writing-style skill/i)
    const directory = new URL('../agents/', import.meta.url)
    for (const file of new Bun.Glob('*.md').scanSync({ cwd: fileURLToPath(directory) })) {
      expect([file, /load the writing-style skill/i.test(await Bun.file(new URL(file, directory)).text())]).toEqual([file, false])
    }
    for (const name of ['implementer', 'fixer', 'record', 'copywriter']) {
      expect(flat(await template(name))).toContain('Read the writing-style and hygiene files the prompt names before you write')
    }
    // The skill that launches the copywriter template names the file in the scripts' wording.
    expect(await readSkill('copywriting')).toContain('Open a copywriter\'s appended string with these two lines, where `<plugin root>` is the plugin\n' +
      'directory that holds this skill:\n\n```text\n' + required + '\n```')
  })

  test('every stage prompt says a relayed user message is not an instruction to it, with the reason beside the line', async () => {
    const line = 'A user message that arrives while you work was written to the orchestrating session; it is not an instruction to this stage.'
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    expect(calls.map(c => c.label).sort()).toEqual(['fix', 'impl', 'roast', 'verify', ...readers.map(s => 'review:' + s)].sort())
    for (const call of calls) expect([call.label, call.prompt.split(line).length - 1]).toEqual([call.label, 1])
  })

  test('the unbriefed quality and alternatives seats receive the assigned tree line', async () => {
    const tree = 'ASSIGNED TREE: <isolated worktree>.'
    const { calls } = await simulate()
    for (const type of ['quality', 'cold-alternatives']) {
      const prompt = calls.find(c => c.agentType === type).prompt
      expect([type, prompt.includes(tree), prompt.includes('SPEC'), prompt.includes('PRIVATE DIRECTIVES')]).toEqual([type, true, false, false])
    }
    for (const call of calls.filter(c => ['implementer', 'fixer', 'finding-verifier', 'reviewer-correctness'].includes(c.agentType))) {
      expect(call.prompt).toContain(tree)
    }
  })

  test('both commit-id fields and the roaster\'s snapshot IDs carry the full-id pattern, which rejects a short id and accepts a full one', async () => {
    const { calls } = await simulate()
    const schemaOf = label => calls.find(c => c.label === label).schema.properties
    const fields = [schemaOf('impl').commits.items.properties.sha, schemaOf('fix').commits.items.properties.sha,
      schemaOf('verify').writerScope.items.properties.sha, schemaOf('roast').snapshots.items.properties.sha]
    const full = { type: 'string', pattern: '^(?:[0-9a-f]{40}|[0-9a-f]{64})$' }
    for (const field of fields) expect(field).toEqual(full)
    const accepts = sha => new RegExp(fields[0].pattern).test(sha)
    for (const sha of [INITIAL, 'd'.repeat(64)]) expect([sha, accepts(sha)]).toEqual([sha, true])
    for (const sha of [INITIAL.slice(0, 7), '', INITIAL.toUpperCase(), INITIAL + 'a', 'g'.repeat(40)]) {
      expect([sha, accepts(sha)]).toEqual([sha, false])
    }
  })
})

// The blocks of a Markdown file as Bun's parser reads them. A block holds only its own inline text,
// with each code span written in backticks, the list of code spans in it and the list of its bold
// phrases. With `bold` set, the text also writes each bold phrase between double asterisks, as the
// source does. A heading also holds its level, and an item of an ordered list its depth and number.
// The parser closes a nested block before the block that holds it, so a nested item comes before
// its parent item and every other block is in document order.
// The parser has no front matter support: it reads the front matter of these files as a heading,
// which keeps it out of the paragraphs.
const markdownBlocks = (text, { bold = false } = {}) => {
  const blocks = []
  let spans = []
  let strong = []
  const block = kind => (children, meta) => {
    if (children) {
      blocks.push({ kind, text: children, spans, strong, ...(kind === 'heading' && { level: meta.level }),
        ...(kind === 'item' && meta.ordered && { depth: meta.depth, number: meta.start + meta.index }) })
    }
    spans = []
    strong = []
    return ''
  }
  Bun.markdown.render(text, {
    heading: block('heading'), paragraph: block('paragraph'), listItem: block('item'),
    th: block('cell'), td: block('cell'), html: block('html'),
    code: body => { blocks.push({ kind: 'code', text: body, spans: [], strong: [] }); return '' },
    codespan: span => { spans.push(span); return '`' + span + '`' },
    strong: children => { strong.push(children); return bold ? `**${children}**` : children },
  })
  return blocks
}
// A heading as the source writes it: its level in hash marks, then its text.
const headingLabel = block => `${'#'.repeat(block.level)} ${block.text}`
// Headings of levels two to four in document order, so a rule required to sit immediately before
// another is checked by position.
const readSkill = name => Bun.file(new URL(`../skills/${name}/SKILL.md`, import.meta.url)).text()
// The blocks of one section, after its heading and up to the next heading of the same or higher level.
const sectionBlocks = (text, heading, options) => {
  const blocks = markdownBlocks(text, options)
  const start = blocks.findIndex(block => block.kind === 'heading' && headingLabel(block) === heading)
  if (start < 0) throw new Error(`Missing heading: ${heading}`)
  const end = blocks.findIndex((block, i) => i > start && block.kind === 'heading' && block.level <= blocks[start].level)
  return blocks.slice(start + 1, end < 0 ? blocks.length : end)
}
// One section's own text with its bold phrases marked, so a rule that moves to another section
// stops satisfying the criterion that names this one.
const sectionText = (text, heading) => flat(sectionBlocks(text, heading, { bold: true }).map(block => block.text).join(' '))
// The one item of a section that opens with the given words, so a rule is checked in the item that states it.
// One numbered law's own item, with its bold phrases marked.
const lawText = (text, number) => {
  const law = sectionBlocks(text, '## Laws', { bold: true })
    .find(block => block.kind === 'item' && block.depth === 0 && block.number === number)
  if (!law) throw new Error(`Missing law: ${number}`)
  return flat(law.text)
}

const checkFirst = (heading, command) => heading + ', before anything else and before any edit: run this exact command once with the' +
  " Bash tool, with no change, retry or fix:\ncd '<isolated worktree>' && " + command + '\nReturn its exit code, its stdout and its stderr' +
  ' in specCheck, unchanged. When its exit code is not 0, make no edit and\nreturn your object with every repository at its start SHA.'
const SPEC_CHECK_SCHEMA = { type: 'object', required: ['exitCode', 'stdout', 'stderr'], additionalProperties: false,
  properties: { exitCode: { type: 'integer' }, stdout: { type: 'string' }, stderr: { type: 'string' } } }

describe('spec check and shipped scripts', () => {
  const command = "bun '<plugin root>/tools/check-spec.ts' '" + SPEC_PATH + "' --transcripts '" + TRANSCRIPTS + "' --json --base '" +
    JSON.stringify(at(BASE)) + "' --proof '" + fingerprint(mainLaunchValues(launchArgs())) + "'"

  test('the implementer runs the spec check before anything else its prompt asks, and returns what the tool printed', async () => {
    const { calls, phases } = await simulate()
    const impl = calls[0]
    expect([impl.label, impl.agentType, impl.phase]).toEqual(['impl', 'implementer', 'Implement'])
    expect(impl.prompt.startsWith(checkFirst('SPEC CHECK', command) + '\n\n')).toBe(true)
    expect(impl.prompt).not.toContain('--check-render')
    expect([impl.schema.required[0], impl.schema.properties.specCheck]).toEqual(['specCheck', SPEC_CHECK_SCHEMA])
    expect(phases[0]).toBe('Implement')
    expect(calls.filter(c => c.prompt.includes('check-spec.ts')).map(c => c.label)).toEqual(['impl'])
  })

  const launched = mainLaunchValues(launchArgs())
  for (const [name, specCheck, printed] of [
    ['an output without a proof', passedCheck(launched, { stdout: '{}' }), null],
    ['a proof that is no fingerprint', passedCheck(launched, { stdout: JSON.stringify({ proof: 'I ran the command and it passed.' }) }),
      'I ran the command and it passed.'],
    ['an output that is no JSON', passedCheck(launched, { stdout: 'not json at all' }), null],
    ['the proof of a run without the base list', passedCheck({ ...launched, base: null }), fingerprint({ ...launched, base: null })],
    ['the proof of another spec', passedCheck({ ...launched, spec: '<main checkout>/.cache/specs/other.yaml' }),
      fingerprint({ ...launched, spec: '<main checkout>/.cache/specs/other.yaml' })],
    ['the proof of a check in another tree', passedCheck({ ...launched, tree: '<main checkout>' }), fingerprint({ ...launched, tree: '<main checkout>' })],
    ['a non-zero exit', passedCheck(launched, { exitCode: 1, stdout: '', stderr: "unit.yaml: entries: no entry has author user: a spec needs the user's words" }), null],
  ]) {
    test(`${name} from the implementer's spec check ends the run as failed, quoting stderr, without another attempt or a later stage`, async () => {
      const calls = []
      const { result } = await simulate({ specCheck, calls })
      const message = 'the spec check did not pass: exit ' + specCheck.exitCode + ', proof ' + JSON.stringify(printed) +
        ' where the launch values give ' + fingerprint(launched) + ', stderr: ' + specCheck.stderr
      expect([result.exit, result.detail]).toEqual(['failed', message])
      expect(result.remaining).toEqual([{ kind: 'stage-failure', severity: 'CRITICAL', item: { ...implemented({ specCheck }), label: 'impl', message } }])
      expect(calls.map(c => c.label)).toEqual(['impl'])
    })
  }

  test('an implementer whose spec check failed is not asked again, even when the rest of its object is incomplete', async () => {
    const calls = []
    const { result } = await simulate({ calls, specCheck: passedCheck(launched, { exitCode: 1, stdout: '' }),
      implementation: implemented({ snapshotSha: BASE, git: { head: 'HEAD', status: '' } }) })
    expect(result.exit).toBe('failed')
    expect(calls.map(c => c.label)).toEqual(['impl'])
  })

  test('the fingerprint of the launch values passes whoever computed it, because the comparison sees values and no run of the tool', async () => {
    const { result } = await simulate({ specCheck: { exitCode: 0, stdout: JSON.stringify({ proof: fingerprint(launched) }), stderr: '' } })
    expect(result.exit).toBe('clean')
  })

  test('a spec path that is not YAML, or a missing transcript directory, throws before any stage', async () => {
    for (const fields of [{ specPath: '<main checkout>/.cache/specs/<unit>.md' }, { specPath: undefined }, { specPath: '' }]) {
      const calls = []
      await expect(simulate({ args: launchArgs(fields), calls })).rejects.toThrow('args.specPath must name the unit spec YAML file')
      expect(calls).toEqual([])
    }
    const calls = []
    await expect(simulate({ args: launchArgs({ transcripts: undefined }), calls })).rejects.toThrow('args.transcripts must name the transcript directory')
    expect(calls).toEqual([])
  })

  test('no shipped script passes a private record to the spec tool, and no stage prompt names one', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne })
    const command = calls.find(c => c.label === 'impl').prompt.split('\n').find(line => line.includes('check-spec.ts'))
    expect(command.includes('--record')).toBe(false)
    for (const call of calls) {
      for (const stale of ['.cache/directives/', 'PRIVATE DIRECTIVES', 'private directive record', 'approves field', 'ORCHESTRATOR SCOPING']) {
        expect([call.label, stale, call.prompt.includes(stale)]).toEqual([call.label, stale, false])
      }
    }
  })

  test('the scripts read only the proof field of what the tool printed, and use no random value', async () => {
    const launched = mainLaunchValues(launchArgs())
    const printed = JSON.stringify({ sha256: 'not checked', spec: 'other.yaml', proof: fingerprint(launched) })
    const { result } = await simulate({ specCheck: passedCheck(launched, { stdout: printed }) })
    expect(result.exit).toBe('clean')
    expect(skeleton).not.toContain('Math.random')
  })

  test('the shipped script carries the placeholder name and description, and a copy sets its own', async () => {
    // Evaluating the meta literal returns the object the workflow list reads.
    const metaOf = script => new AsyncFunction(script.replace('export const meta =', 'return'))()
    const meta = await metaOf(skeleton)
    expect([meta.name, meta.description]).toEqual(['kebab-name', 'one line'])
    // A copy replaces both values and keeps the phases.
    const copy = await metaOf(skeleton.replace("name: 'kebab-name'", "name: 'return-the-error'")
      .replace("description: 'one line'", "description: 'returns the swallowed error to the caller'"))
    expect([copy.name, copy.description, copy.phases]).toEqual(['return-the-error', 'returns the swallowed error to the caller', meta.phases])
    const rule = sectionText(skill, "### Every unit's script is a copy of the shipped one, edited in one block")
    for (const phrase of ['A copy of the script changes only its marked block and two values outside it',
      '`meta.name`', '`meta.description`',
      'The shipped script carries `kebab-name` and `one line` as the values a copy replaces',
    ]) expect([phrase, rule.includes(phrase)]).toEqual([phrase, true])
    expect(rule).not.toContain('edits only its marked block')
    // The marked block does not claim to hold the two values a main-script copy sets above it.
    expect(rule).not.toContain('holds everything a unit sets')
  })
})

const labels = calls => calls.map(c => c.label)
const TREE = realpathSync(fileURLToPath(new URL('../', import.meta.url)))

// The two scratch rules as the scripts write them: the writers' rule points at the local-cache
// skill, the readers' rule forbids every write except a command's output to the system temporary directory.
const WRITE_SCRATCH = 'SCRATCH: put scratch files where the workflow-skills:local-cache skill says for a writing stage. A local-cache skill\n' +
  'without the plugin prefix takes precedence; otherwise read <plugin root>/skills/local-cache/SKILL.md with the Read tool.'
const WRITE_NOTHING = 'WRITE NOTHING: no copies of files and no notes. Only the output of a command that cannot be read directly may be written, to the system temporary directory.'
// The input paths a stage reads, which sit in the project cache and are no place to write.
const INPUT_PATHS = [SPEC_PATH]
// A code span holding a command starts with a program name followed by its arguments.
const command = span => /^[a-z][\w-]* /.test(span)

describe('the project cache, the todo record and scratch files by role', () => {
  test('every writing stage is pointed at local-cache and every reading stage writes nothing', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    expect(labels(calls).sort()).toEqual(['fix', 'impl', 'roast', 'verify', ...readers.map(s => 'review:' + s)].sort())
    for (const call of calls) {
      const role = ['impl', 'fix'].includes(call.label) ? 'writer' : 'reader'
      const count = line => call.prompt.split(line).length - 1
      expect([call.label, count(WRITE_SCRATCH), count(WRITE_NOTHING)]).toEqual([call.label, role === 'writer' ? 1 : 0, role === 'reader' ? 1 : 0])
      expect([call.label, /global temp/i.test(call.prompt)]).toEqual([call.label, false])
      if (role === 'writer') continue
      const rest = INPUT_PATHS.reduce((text, path) => text.split(path).join(''), call.prompt)
      expect([call.label, rest.includes('.cache'), /scratch/i.test(rest), rest.includes('local-cache')]).toEqual([call.label, false, false, false])
    }
  })
})

// The rule every reading stage receives about what it may report as a limitation, as the scripts
// write it and as the templates state it.
const LIMITS_RULE = 'a limitation is only something you were supposed to check and could not. An act your own rules forbid,\n' +
  'such as running tests, builds or the spec tool as a reading stage, and input you are not given by design, such as\n' +
  'the private spec for an unbriefed stage, are never limitations and are not reported.\n' +
  'COVERAGE lists only what you checked and how. Leave out what your concern has nothing to judge in.\n' +
  'Something you were supposed to check and could not is a limitation, never a coverage entry.'
const LIMITS_LINE = 'LIMITATIONS: ' + LIMITS_RULE

describe('what a limitation is', () => {
  test('every reading stage receives the limitation rule once, and no writer does', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    expect(calls).toHaveLength(20)
    for (const call of calls) {
      const reader = !['impl', 'fix'].includes(call.label)
      expect([call.label, call.prompt.split(LIMITS_LINE).length - 1]).toEqual([call.label, reader ? 1 : 0])
    }
  })

  test('a writer with two commits reaches the fix stage when the verifier accepts each commit', async () => {
    const FIRST = 'd'.repeat(40)
    const implementation = implemented({
      commits: [{ sha: FIRST, subject: 'add the error helper', repository: '.' }, { sha: INITIAL, subject: 'return the error through the helper', repository: '.' }],
    })
    const { result, calls } = await simulate({ implementation, reports: oneReport, verify: approveOne,
      fixes: { fix: fixed([disposition()]) } })
    expect(calls.find(c => c.label === 'verify').prompt).toContain('WRITER OBJECTS (UNTRUSTED):\n\n[' + JSON.stringify(implementation) + ']')
    expect(calls.filter(c => c.phase === 'Fix').map(c => c.label).sort()).toEqual(['fix', 'roast'])
    expect(result.remaining.map(r => r.kind)).toEqual(['unattested-fix'])
  })
})

// A finding about a choice that no words of the user back, and the decisions that may answer it.
const unbacked = { ...finding, kind: 'unbacked-choice', severity: 'CRITICAL', claim: 'The upload retries three times, and no words of the user ask for retries.' }
const rejectUnbacked = (authority, seat = 'correctness') => benefit([source(seat)], { action: 'reject', authority,
  reason: 'The entry asks for three attempts on a failed upload, which is the retry the finding names.',
  evidence: 'src/example.js:12 retries the upload three times.' })
const backing = 'spec entry session.jsonl:42: "Before you start: if the upload fails, try it three times and then stop and tell me."'
const lower = text => flat(text).toLowerCase()

describe('the user\'s words reach every stage', () => {
  test('an unbacked-choice decision answered with record or cleanup fails the verifier checks', async () => {
    for (const fields of [{ action: 'record', correction: 'Record it.' }, { action: 'cleanup', correction: 'Record it.' }]) {
      const { result, calls } = await simulate({ reports: report('review:inverse', [unbacked]),
        verify: { verify: verification([benefit([source('inverse')], fields)]) } })
      expect(result.detail).toContain('Unbacked-choice finding allows only unresolved, reject or a removal approve-fix, never ' + fields.action)
      expect([retried(calls, 'verify').length, calls.some(c => c.phase === 'Fix')]).toEqual([3, false])
    }
  })

  test('an approve-fix on an unbacked-choice finding that is no removal on the removal rule fails the verifier checks', async () => {
    // An addition, a change of the choice and an approval that keeps the choice all arrive without the removal mark.
    for (const correction of ['Add a backoff delay between the three upload retries.', 'Retry the upload five times instead of three.',
      'Keep the three retries and document them.']) {
      const { result, calls } = await simulate({ reports: report('review:inverse', [unbacked]),
        verify: { verify: verification([benefit([source('inverse')], { correction })]) } })
      expect([correction, result.detail.includes('Unbacked-choice finding allows approve-fix only for a removal on the removal rule, marked removal true')])
        .toEqual([correction, true])
      expect([retried(calls, 'verify').length, calls.some(c => c.phase === 'Fix')]).toEqual([3, false])
    }
    // The removal mark belongs to an approve-fix alone.
    const marked = benefit([source('correctness')], { action: 'unresolved', authority: 'No recorded words back the three retries.',
      correction: '', removal: true })
    const { result, calls } = await simulate({ reports: report('review:correctness', [back(unbacked)]), verify: { verify: verification([marked]) } })
    expect(result.detail).toContain('Only an approve-fix carries removal true, never unresolved')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a removal of an unbacked choice on the removal rule reaches the fixer, alone and in a group with other source kinds', async () => {
    const removal = { authority: 'The removal rule of the finding verifier\'s template. The record holds no words about upload retries.',
      evidence: 'src/example.js:12 retries the upload three times, and no record entry asks for retries.',
      correction: 'Delete the retry loop so a failed upload fails once.', removal: true }
    const alone = benefit([source('correctness')], removal)
    const grouped = benefit([source('correctness'), source('inverse'), source('rules')], removal)
    for (const [reports, approved] of [[report('review:correctness', [back(unbacked)]), alone],
      [{ ...report('review:correctness', [back(unbacked)]), ...report('review:inverse', [bandAid]), ...report('review:rules', [finding]) }, grouped]]) {
      const { result, calls } = await simulate({ reports, verify: { verify: verification([approved]) }, fixes: { fix: fixed([disposition()]) } })
      expect(retried(calls, 'verify')).toHaveLength(1)
      expect(calls.find(c => c.label === 'fix').prompt).toContain('APPROVED CORRECTIONS (verify against the tree and authority):\n\n' +
        JSON.stringify([{ ...approved, key: 'fix:0', pointers: backed.evidence }]))
      expect([result.exit, result.remaining.map(r => r.kind)]).toEqual(['follow-up', ['unattested-fix']])
      expect(result.projectBenefitDecisions.map(d => d.decision)).toEqual([approved])
    }
  })

  test('an unresolved unbacked-choice finding reaches the root as an open decision', async () => {
    const open = benefit([source('correctness')], { action: 'unresolved', authority: 'No recorded words back the three retries.',
      correction: '' })
    const { result, calls } = await simulate({ reports: report('review:correctness', [back(unbacked)]), verify: { verify: verification([open]) } })
    expect([result.exit, result.remaining]).toEqual(['root-resolution', [{ kind: 'open-decision', severity: 'CRITICAL', item: open }]])
    expect(calls.some(c => c.phase === 'Fix')).toBe(true)
  })

  test('a rejection closes an unbacked-choice finding only on a spec entry named by its file and line, with its quoted context', async () => {
    for (const authority of ['The user asked for retries.', 'spec entry session.jsonl:42', 'spec entry: "try it three times"',
      '"if the upload fails, try it three times"', 'spec entry session.jsonl:0: "try it three times"', 'spec entry session.jsonl:42: " "',
      'record entry retry-policy: "try it three times"']) {
      const { result, calls } = await simulate({ reports: report('review:correctness', [back(unbacked)]),
        verify: { verify: verification([rejectUnbacked(authority)]) } })
      expect([authority, result.detail.includes('Unbacked-choice rejection must cite in authority the spec entry by its file and line')]).toEqual([authority, true])
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    }
    const closed = rejectUnbacked(backing)
    const { result } = await simulate({ reports: report('review:correctness', [back(unbacked)]), verify: { verify: verification([closed]) } })
    expect([result.exit, result.remaining, result.counts.rejected]).toEqual(['clean', [], 1])
    expect(result.projectBenefitDecisions.map(d => d.decision)).toEqual([closed])
  })

  test('the briefed readers report an unbacked choice by kind, and the unbriefed ones never hear of it', async () => {
    const rule = 'A choice in the spec, the prompt or the diff that no words of the user back is a finding with kind unbacked-choice and severity CRITICAL.'
    for (const name of ['reviewer-correctness', 'reviewer-spec-compliance', 'duplicate-checker', 'reviewer-inverse-spec', 'project-rule-reader']) {
      expect([name, (await template(name)).includes(rule)]).toEqual([name, true])
    }
    expect(await template('reviewer-inverse-spec')).toContain('A missing-decision finding carries kind unbacked-choice.')
    for (const name of ['quality', 'cold-alternatives', 'roaster', 'gap-finder']) {
      expect([name, (await template(name)).includes('unbacked-choice')]).toEqual([name, false])
    }
    const line = 'A READING STAGE reports a choice in the spec, this prompt or the diff that no words of the user back as a finding with kind unbacked-choice.'
    const { calls } = await simulate()
    for (const call of calls) {
      const briefed = BRIEFED.includes(call.agentType)
      expect([call.label, flat(call.prompt).includes(line)]).toEqual([call.label, briefed])
    }
  })

  test('an assistant entry is context, and a contradiction with what the user answered yes to is a contradiction with the user\'s words', async () => {
    const context = 'an entry of author assistant is context'
    const contradiction = 'a contradiction with what the user answered yes to'
    const main = await simulate()
    const texts = [['main AUTHORITY', main.calls.find(c => c.label === 'impl').prompt], ['skill', skill]]
    for (const name of ['implementer', 'fixer', 'finding-verifier']) texts.push([name, await template(name)])
    for (const [name, text] of texts) {
      const plain = lower(text).replaceAll('`', '')
      expect([name, plain.includes(context), plain.includes(contradiction)]).toEqual([name, true, true])
      expect([name, lower(text).includes('approves field')]).toEqual([name, false])
    }
    expect(lawText(skill, 6)).toContain('this hierarchy and the directive-conflict hard flag of law 8 treat a contradiction with what the user answered yes to like a contradiction with the user\'s own sentence')
  })
})

// Every file under a directory of the plugin, read as text, keyed by its path relative to the plugin root.

// The template each review seat loads, by the label its stage carries.
const SEAT_TEMPLATES = [['correctness', 'reviewer-correctness'], ['spec', 'reviewer-spec-compliance'], ['dupes', 'duplicate-checker'],
  ['quality', 'quality'], ['inverse', 'reviewer-inverse-spec'], ['rules', 'project-rule-reader'], ['alternatives', 'cold-alternatives'],
  ...AUDIT.map(seat => [seat, seat])]
// The removed seat's template name, built so that no file of the tree spells it out.
const REMOVED = ['reviewer', 'cleanliness'].join('-')
// Every file under a directory of the tree, as paths relative to the tree root.
// A run of a copy that must stop before its first agent: the error it throws and the agents it started.
const stopsBeforeAnyAgent = async (script, args) => {
  const calls = []
  const copy = new AsyncFunction('agent', 'phase', 'log', 'args', script.replace('export const meta =', 'const meta ='))
  const error = await copy(async (prompt, opts) => { calls.push(opts); throw new Error('no agent runs') }, () => {}, () => {}, args)
    .then(() => null, error => error)
  return { message: error?.message, calls }
}

describe('fixed review seats and a model for every agent', () => {
  test('the review stage runs exactly its fixed reviewers, each on the template of its name', async () => {
    const { calls } = await simulate()
    const review = calls.filter(c => c.phase === 'Review').map(c => [c.label.slice('review:'.length), c.agentType])
    expect(review).toEqual(SEAT_TEMPLATES)
    for (const [, name] of SEAT_TEMPLATES) expect([name, await Bun.file(new URL(`../agents/${name}.md`, import.meta.url)).exists()]).toEqual([name, true])
    expect(await Bun.file(new URL(`../agents/${REMOVED}.md`, import.meta.url)).exists()).toBe(false)
  })

  test('the audit reviewers receive the hygiene floor and the diff and nothing else', async () => {
    const { calls } = await simulate()
    const quality = calls.find(c => c.label === 'review:quality').prompt
    const [floor, diff, ...rest] = quality.split('\n\n')
    expect([floor.startsWith('EXECUTION CONTEXT'), floor.endsWith('No background waits.'), diff.startsWith('DIFFS,'), rest]).toEqual([true, true, true, []])
    expect(floor).toContain('GIT READ-ONLY:')
    expect(diff).toContain('.: ' + BASE + '..' + INITIAL)
    for (const seat of AUDIT) {
      const prompt = calls.find(c => c.label === 'review:' + seat).prompt
      expect([seat, prompt]).toEqual([seat, quality])
      for (const briefing of ['AUTHORITY', 'SPEC', 'PRIVATE DIRECTIVES', 'UNTRUSTED implementer', 'REQUIRED INVARIANTS', 'ACCEPTANCE CRITERIA']) {
        expect([seat, briefing, prompt.includes(briefing)]).toEqual([seat, briefing, false])
      }
    }
  })

  test('an audit seat\'s finding reaches the verifier under a source ID of its label', async () => {
    const { calls } = await simulate({ reports: report('review:code-smell', [finding]),
      verify: { verify: verification([decision([source('code-smell')])]) }, fixes: { fix: fixed([disposition()]) } })
    handedTo(calls, 'verify', [{ ...finding, id: source('code-smell'), seat: 'code-smell', snapshots: at(INITIAL) }])
    const seatObjects = calls.find(c => c.label === 'verify').prompt.split('SEAT OBJECTS (UNTRUSTED):\n\n')[1].split('\n\nWRITER OBJECTS')[0]
    expect(JSON.parse(seatObjects).map(r => r.seat)).toEqual(readers)
  })

  test('a copy whose seat list leaves out, adds or repeats a seat, or gives one another template, stops before its first agent', async () => {
    const line = "  { type: 'code-smell', label: 'code-smell', ...unbriefed },\n"
    const copy = filled(skeleton)
    expect(copy.split(line)).toHaveLength(2)
    const extra = line + "  { type: 'roaster', label: 'extra', ...unbriefed },\n"
    const retemplated = "  { type: 'quality', label: 'code-smell', ...unbriefed },\n"
    for (const edited of [copy.replace(line, ''), copy.replace(line, line + line), copy.replace(line, extra),
      copy.replace("  { type: 'reviewer-correctness', label: 'correctness',", "  { type: 'reviewer-correctness', label: 'correct',"),
      copy.replace(line, retemplated)]) {
      expect(edited).not.toBe(copy)
      const { message, calls } = await stopsBeforeAnyAgent(edited, launchArgs())
      expect([message?.startsWith('The review stage runs exactly the seats correctness on reviewer-correctness, ' +
        'spec on reviewer-spec-compliance, dupes on duplicate-checker,'), calls]).toEqual([true, []])
    }
    const retemplatedRun = await stopsBeforeAnyAgent(copy.replace(line, retemplated), launchArgs())
    expect(retemplatedRun.message).toContain('and the seat list holds correctness on reviewer-correctness')
    expect(retemplatedRun.message).toContain('code-smell on quality')
    expect(skeleton).toContain("  correctness: 'reviewer-correctness', spec: 'reviewer-spec-compliance', dupes: 'duplicate-checker',")
  })

  test('each review seat runs on its own model entry, keyed by its label', async () => {
    const { calls } = await simulate()
    const review = calls.filter(c => c.phase === 'Review')
    expect(review.map(c => c.model)).toEqual(readers.map(seat => 'model-' + seat))
    expect(new Set(review.map(c => c.model)).size).toBe(16)
    const block = skeleton.slice(skeleton.indexOf('// ---- UNIT VALUES.'), skeleton.indexOf('// ---- END OF UNIT VALUES ----'))
    for (const seat of readers) {
      const key = seat.includes('-') ? `'${seat}'` : seat
      expect([seat, block.includes(`      ${key}: { model: '<explicit>', effort: 'high' },`)]).toEqual([seat, true])
    }
  })

  test('a model entry that is missing, still a placeholder or named for no agent stops the run before its first agent', async () => {
    const cases = [
      [skeleton, launchArgs(), 'UNIT.models.impl.model must be set by the root, not "<explicit>"'],
      [filled(skeleton).replace("      'code-smell': { model: 'model-code-smell', effort: 'high' },\n", ''), launchArgs(),
        'UNIT.models.review.code-smell.model must be set by the root, not undefined'],
      [filled(skeleton).replace("model: 'model-verify'", "model: '<explicit>'"), launchArgs(), 'UNIT.models.verify.model must be set by the root, not "<explicit>"'],
      [filled(skeleton).replace("{ model: 'model-impl', effort: 'high' }", "{ model: 'model-impl', effort: '' }"), launchArgs(),
        'UNIT.models.impl.effort must be set by the root, not ""'],
      [filled(skeleton).replace("    'impl': {", "    gate: { model: 'model-gate', effort: 'low' },\n    'impl': {"), launchArgs(),
        'UNIT.models.gate names no agent this run starts'],
      [filled(skeleton).replace("    review: {", "    review: {\n      cleanliness: { model: 'model-cleanliness', effort: 'high' },"), launchArgs(),
        'UNIT.models.review.cleanliness names no agent this run starts'],
      [filled(skeleton).replace("    'roast': {", "    audit: { model: 'model-audit', effort: 'high' },\n    'roast': {"), launchArgs(),
        'UNIT.models.audit names no agent this run starts'],
      [filled(skeleton).replace("{ model: 'model-code-smell', effort: 'high' }", "{ model: 'model-code-smell', effort: 'high', agentType: 'workflow-skills:quality' }"),
        launchArgs(), 'UNIT.models.review.code-smell holds agentType, and an entry holds only a model and an effort'],
      [filled(skeleton).replace("{ model: 'model-impl', effort: 'high' }", "{ model: 'model-impl', effort: 'high', agentType: 'workflow-skills:quality' }"),
        launchArgs(), 'UNIT.models.impl holds agentType, and an entry holds only a model and an effort'],
    ]
    for (const [script, args, expected] of cases) {
      // Each case edits its copy; an edit that matched nothing would leave a script that runs.
      expect([expected, script === skeleton || filled(skeleton) !== script])
        .toEqual([expected, true])
      const { message, calls } = await stopsBeforeAnyAgent(script, args)
      expect([expected, message, calls]).toEqual([expected, expected, []])
    }
  })
})

// Wording that sends the root to a review of the spec before the main run. The patterns are written
// so that this file does not match itself; the inverse-spec reviewer is a stage of the main run.
const SPEC_FINDING_CLASSES = ['joint-impossibility', 'missing-contract', 'reality-drift', 'unbacked-entry']
// A spec finding points at the transcript record of every spec entry it concerns, here by line.
const specFinding = (lines, kind) => ({ evidence: lines.map(line => ({ kind: 'transcript', file: 'session.jsonl', line, key: ['message', 'content'] })),
  class: kind, claim: 'The entries named here are ' + kind + '.', receipts: [receipt] })

describe('the implementer checks the spec, and every stage reads only words said about this unit', () => {

  test('every repository entry says its path is the listed one, and its head the commit ID alone', async () => {
    const { calls } = await simulate()
    const writers = calls.filter(c => ['impl', 'verify', 'fix'].includes(c.label))
    expect(writers.map(c => c.label)).toEqual(['impl', 'verify', 'fix'])
    for (const { label, schema } of writers) {
      const entry = schema.properties.repositories.items.properties
      expect([label, entry.path.description]).toEqual([label, 'The path of the repository exactly as the base list names it, such as ., never an absolute path.'])
      expect([label, entry.git.properties.head.description]).toEqual([label, expect.stringContaining('The commit ID that git rev-parse --verify HEAD^{commit} printed, and nothing else')])
      expect([label, entry.git.properties.status.description]).toEqual([label, expect.stringContaining('the empty string on a clean tree')])
    }
  })

  test('the implementer schema carries specFindings, one entry per finding with evidence pointers, enum-locked class, claim and receipts', async () => {
    const { calls } = await simulate()
    const schema = calls.find(c => c.label === 'impl').schema
    expect(schema.required).toContain('specFindings')
    const entry = schema.properties.specFindings.items
    expect([entry.required, entry.additionalProperties, entry.properties.class, entry.properties.receipts.minItems])
      .toEqual([['evidence', 'class', 'claim', 'receipts'], false, { enum: SPEC_FINDING_CLASSES }, 1])
    // The entry points at its spec entries with the evidence shape of the concern seats, and quotes no words.
    const concern = calls.find(c => c.label === 'review:correctness').schema.properties.findings.items.properties.evidence
    expect([entry.properties.evidence, 'words' in entry.properties, 'items' in entry.properties]).toEqual([concern, false, false])
    // Only the implementer returns spec findings.
    for (const call of calls.filter(c => c.label !== 'impl')) expect([call.label, 'specFindings' in call.schema.properties]).toEqual([call.label, false])
  })

  test('a later entry replaces what it corrects only where it says it corrects it, in every stage that reads the spec', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    const rule = 'A later one replaces what it corrects in an earlier one only where its own words present it as a correction of it:' +
      ' it says to do it differently instead, that something else was meant, adds to what was said because of it, or forbids what was' +
      ' asked before. A later user entry that contradicts an earlier one without such words conflicts with it: report it.'
    for (const call of calls) {
      expect([call.label, flat(call.prompt).includes(rule)]).toEqual([call.label, call.prompt.includes('SPEC (authority)')])
    }
    expect(await template('implementer')).toContain('cannot both hold, the later one not correcting the earlier one as the authority block of' +
      ' your prompt defines;')
    expect(flat(skill)).toContain('Expect the implementer to report a later user entry that contradicts an earlier one without such words as a' +
      ' `joint-impossibility`.')
  })

  test('every stage that reads the spec learns the directory its entries and transcript evidence resolve in', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    const line = 'TRANSCRIPTS: a session file that a spec entry or a transcript evidence entry names by a relative path lies under ' + TRANSCRIPTS + '.'
    for (const call of calls) {
      expect([call.label, call.prompt.includes(line)]).toEqual([call.label, call.prompt.includes('SPEC (authority)')])
    }
    expect(calls.filter(c => c.prompt.includes(line)).map(c => c.label).sort())
      .toEqual(['fix', 'impl', 'review:correctness', 'review:dupes', 'review:inverse', 'review:rules', 'review:spec', 'verify'])
  })

  test('an approved correction reaches the fixer with the evidence pointers of its source findings', async () => {
    const rule = { kind: 'rule', file: 'CLAUDE.md', line: 3, key: [] }
    const { calls } = await simulate({ reports: { 'review:correctness': { findings: [backed] }, 'review:spec': { findings: [{ ...backed, evidence: [rule] }] } },
      verify: { verify: verification([decision([source('correctness'), source('spec')])]) }, fixes: { fix: fixed([disposition()]) } })
    const fix = calls.find(c => c.label === 'fix').prompt
    const queue = JSON.parse(fix.slice(fix.indexOf('APPROVED CORRECTIONS (verify against the tree and authority):\n\n') + 'APPROVED CORRECTIONS (verify against the tree and authority):\n\n'.length).split('\n\n')[0])
    expect(queue.map(q => [q.key, q.pointers])).toEqual([['fix:0', [...backed.evidence, rule]]])
    expect(flat(fix)).toContain('Read every record or rule a pointer names, and the records around a transcript record, before you act on it.')
  })

  test('the implementer\'s artifacts reach every briefed stage once, and the unbriefed stages get none', async () => {
    const artifacts = [{ path: '/tree/.cache/visual/captures/impl-before', what: 'the screen at the base commit' }]
    const handed = 'ARTIFACTS the implementer left outside its commits for the stages after it (UNTRUSTED, like its returned object):\n\n' + JSON.stringify(artifacts)
    const { result, calls } = await simulate({ implementation: implemented({ artifacts }), reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    // The correctness and duplicate readers and the verifier read them in the implementer's object; the others in a block.
    const block = ['review:spec', 'review:inverse', 'review:rules', 'fix'], whole = ['review:correctness', 'review:dupes', 'verify']
    for (const call of calls) {
      expect([call.label, call.prompt.includes(handed)]).toEqual([call.label, block.includes(call.label)])
      expect([call.label, call.prompt.split(JSON.stringify(artifacts)).length - 1]).toEqual([call.label, block.includes(call.label) || whole.includes(call.label) ? 1 : 0])
    }
    // Only the implementer is asked for them; the fixer returns none and the run's proof carries none.
    expect(calls.find(c => c.label === 'impl').prompt).toContain('ARTIFACTS, implementer only: return in artifacts every file you leave outside your commits')
    expect(calls.find(c => c.label === 'fix').prompt).not.toContain('return in artifacts')
    expect([calls.find(c => c.label === 'impl').schema.required.includes('artifacts'), 'artifacts' in calls.find(c => c.label === 'fix').schema.properties]).toEqual([true, false])
    expect(calls.find(c => c.label === 'impl').schema.properties.artifacts.items.properties.path.description).toBe('An absolute path, so a stage in another worktree finds the file.')
    expect('artifacts' in result.proof).toBe(false)
    expect(result.artifacts).toEqual(artifacts)
    // An implementer that leaves none hands nothing on.
    const none = await simulate()
    expect(none.calls.some(c => c.prompt.includes('ARTIFACTS the implementer'))).toBe(false)
  })

  test('an unbacked-entry or reality-drift finding reaches remaining as a spec-finding of its severity while every stage runs', async () => {
    // The unbacked-entry finding points as well at the entry that cannot be built without its words.
    const specFindings = [specFinding([12, 14], 'unbacked-entry'), specFinding([20], 'reality-drift')]
    const implementation = implemented({ specFindings })
    const { result, calls } = await simulate({ implementation })
    expect(calls.map(c => c.label)).toEqual(['impl', ...readers.map(s => 'review:' + s), 'verify', 'fix', 'roast'])
    expect([result.exit, result.detail]).toEqual(['follow-up', 'The pass completed with items requiring follow-up.'])
    expect(result.remaining).toEqual([{ kind: 'spec-finding', severity: 'CRITICAL', item: specFindings[0] },
      { kind: 'spec-finding', severity: 'must-fix', item: specFindings[1] }])
    expect(result.remaining.map(r => r.item.evidence.map(e => e.line))).toEqual([[12, 14], [20]])
    // The finding verifier receives them with the implementer's object.
    expect(calls.find(c => c.label === 'verify').prompt).toContain('WRITER OBJECTS (UNTRUSTED):\n\n[' + JSON.stringify(implementation) + ']')
    // They also reach the root when the run ends early.
    const abort = { trigger: 'directive-conflict', reason: 'the prompt contradicts the user\'s words in the spec.' }
    const aborted = await simulate({ implementation: implemented({ snapshotSha: BASE, proofPassed: false, abort, specFindings: specFindings.slice(0, 1) }) })
    expect([aborted.result.exit, aborted.result.remaining.map(r => [r.kind, r.severity])])
      .toEqual(['aborted', [['abort', 'CRITICAL'], ['spec-finding', 'CRITICAL']]])
  })

  test('every stage that reads the spec receives the definition of an invalid spec and hard-aborts on one', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    const rule = 'A SPEC IS INVALID when a question an entry asks has no answer in a later entry, when an entry holds speculation or an' +
      ' unverified assertion, such as a cause or a fix called likely, probable, almost certain or assumed, when an entry of author' +
      ' assistant quotes a Write call that no later user entry answers yes to, or when an entry of author assistant decides a product' +
      ' or architecture question that no user entry decides.'
    const trigger = 'Fourth, EVERY STAGE THAT READS THE SPEC: invalid-spec. An invalid spec sets abort.trigger to invalid-spec before anything' +
      ' else, a writer before any edit, with every entry that makes it invalid and the rule it breaks in abort.reason.'
    for (const call of calls) {
      const briefed = call.prompt.includes('SPEC (authority)')
      expect([call.label, flat(call.prompt).includes(rule), flat(call.prompt).includes(trigger)]).toEqual([call.label, briefed, briefed])
    }
    const implementer = await template('implementer')
    for (const phrase of ['An entry of class joint-impossibility or missing-contract blocks the run',
      'An invalid spec is not one to build. Before any edit, check the spec against the definition of an invalid spec in the authority block of your prompt.',
      'On an invalid spec, set abort.trigger to invalid-spec, name in abort.reason every entry that makes it invalid, by its session file and line, and the rule it breaks, and leave the tree unmodified.',
      'Block only on an actual impossibility, with evidence, not on a preference for different requirements. The hard flag above, with its four triggers, is the only gate; do not add another.',
      'In a main run, the same sense check flags an entry whose words are ambiguous or do not match this unit, and so have no meaning on their own, as class unbacked-entry.']) {
      expect([phrase, implementer.includes(phrase)]).toEqual([phrase, true])
    }
  })

  test('a blocking spec finding with a blocking limitation and unmoved snapshots ends the run after the implement stage', async () => {
    for (const [kind, lines] of [['joint-impossibility', [9, 11]], ['missing-contract', [30]]]) {
      const entry = specFinding(lines, kind)
      const limitation = { what: 'The ' + kind + ' finding leaves the spec unbuildable as written.', effect: 'blocks' }
      const { result, calls } = await simulate({ implementation: implemented({ snapshotSha: BASE, limitations: [limitation], specFindings: [entry] }) })
      expect([kind, calls.map(c => c.label), calls.some(c => c.phase === 'Review')]).toEqual([kind, ['impl'], false])
      expect([kind, result.exit, result.detail]).toEqual([kind, 'root-resolution', 'Blocking limitation from impl.'])
      expect([kind, result.remaining]).toEqual([kind, [{ kind: 'blocking-limitation', severity: 'CRITICAL', item: { ...limitation, label: 'impl' } },
        { kind: 'spec-finding', severity: 'must-fix', item: entry }]])
    }
  })

  test('a blocking spec finding without a blocking limitation, or with moved snapshots, is refused', async () => {
    const limitation = { what: 'The spec cannot be built as written.', effect: 'blocks' }
    for (const kind of ['joint-impossibility', 'missing-contract']) {
      const entry = specFinding([9, 11], kind)
      const unpaired = await simulate({ implementation: implemented({ snapshotSha: BASE, specFindings: [entry] }) })
      expect([kind, unpaired.result.exit, unpaired.result.detail])
        .toEqual([kind, 'failed', expect.stringContaining('a ' + kind + ' spec finding needs a limitation of effect blocks')])
      expect([kind, unpaired.calls.some(c => c.phase === 'Review')]).toEqual([kind, false])
      const moved = await simulate({ implementation: implemented({ limitations: [limitation], specFindings: [entry] }) })
      expect([kind, moved.result.exit, moved.result.detail])
        .toEqual([kind, 'failed', expect.stringContaining('a ' + kind + ' spec finding leaves every repository at its start SHA, but moved: .')])
    }
    // An unbacked-entry or reality-drift finding lets the run go on, with or without a limitation.
    const { result } = await simulate({ implementation: implemented({ specFindings: [specFinding([12], 'unbacked-entry'), specFinding([20], 'reality-drift')] }) })
    expect(result.exit).toBe('follow-up')
    // A spec finding whose evidence breaks the pointer rules is refused like a concern seat's.
    for (const [evidence, message] of [[[], 'Missing the evidence the finding rests on'],
      [[{ kind: 'transcript', file: 'session.jsonl', line: 9, key: [] }], 'Missing the JSON key path of the transcript evidence of'],
      [[{ kind: 'rule', file: 'CLAUDE.md', line: 3, key: ['message'] }], 'A rule evidence entry takes an empty key path']]) {
      const refused = await simulate({ implementation: implemented({ specFindings: [{ ...specFinding([12], 'reality-drift'), evidence }] }) })
      expect([message, refused.result.exit, refused.result.detail]).toEqual([message, 'failed', expect.stringContaining(message)])
    }
  })
})

describe('review seats are critics, and no stage asks the user a question', () => {
  const TEMPLATES = ['reviewer-correctness', 'reviewer-spec-compliance', 'duplicate-checker', 'quality', 'reviewer-inverse-spec',
    'project-rule-reader', 'cold-alternatives', ...AUDIT].map((type, index) => readers[index] + ': <plugin root>/agents/' + type + '.md')
  const REVIEWER_RULES_LINE = 'REVIEWER RULES: the review seats of this run, each by the label its object carries, with its template. The templates are the\n' +
    "reviewers' rules, what each seat looks for, and the review seats are critics without authority:"
  const RULE_SOURCES = 'RULE SOURCES: <applicable project, directory and global rule paths>.'

  test('the finding verifier\'s prompt names the template of every review seat and the rule sources', async () => {
    const { calls } = await simulate()
    const prompt = calls.find(c => c.label === 'verify').prompt
    expect(prompt).toContain(REVIEWER_RULES_LINE + '\n' + TEMPLATES.join('\n'))
    expect(prompt).toContain(RULE_SOURCES)
    expect(TEMPLATES).toHaveLength(16)
  })

})

describe('the stages receive the quoted discussion and no words of the orchestrating session', () => {
  test('the implementer\'s task is the discussion the spec quotes, with no scoping, invariant or note beside it', async () => {
    const { calls } = await simulate()
    const impl = calls.find(c => c.label === 'impl').prompt
    expect(impl.endsWith('\n\nImplement what the following discussion arrived at:\nthe spec at ' + SPEC_PATH + '.')).toBe(true)
    for (const stale of ['ORCHESTRATOR SCOPING', 'REQUIRED INVARIANTS', 'Implement, run focused checks, and commit only scoped changes.']) {
      expect([stale, impl.includes(stale)]).toEqual([stale, false])
    }
  })

  test('the three concern seats receive the order to quote the user\'s words, and no other stage does', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    const concern = ['review:correctness', 'review:spec', 'review:dupes']
    for (const call of calls) {
      expect([call.label, call.prompt.includes('FINDINGS AGAINST THE SPEC')]).toEqual([call.label, concern.includes(call.label)])
    }
  })

  test('every authority-aware stage reads the spec as the discussion: user entries are the authority, assistant entries are context', async () => {
    const { calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { fix: fixed([disposition()]) } })
    const briefed = calls.filter(c => BRIEFED.includes(c.agentType))
    expect(briefed.length).toBe(BRIEFED.length)
    for (const call of briefed) {
      expect([call.label, flat(call.prompt).includes('THE SPEC is the discussion of its unit, quoted verbatim, and nothing else')]).toEqual([call.label, true])
      expect([call.label, flat(call.prompt).includes("An entry of author user is the user's words and the authority. An entry of author assistant is context and never authority")])
        .toEqual([call.label, true])
    }
  })
})

// A review-only copy of a filled script leaves out the model entries of the two reviewers that judge
// a change against its spec.
const SPEC_SEAT_MODELS = ["      'spec': { model: 'model-spec', effort: 'high' },\n", "      'inverse': { model: 'model-inverse', effort: 'high' },\n"]
const withoutSpecSeats = source => SPEC_SEAT_MODELS.reduce((copy, line) => copy.replace(line, ''), source)
const withoutStageModels = (source, names) =>
  names.reduce((copy, name) => copy.replace(`    '${name}': { model: 'model-${name}', effort: 'high' },\n`, ''), source)
const reviewOnly = source => withoutSpecSeats(withoutStageModels(source.replace("  mode: 'main',", "  mode: 'review',"),
  ['impl', 'verify', 'fix', 'roast']))
const reviewRun = new AsyncFunction('agent', 'phase', 'log', 'args', reviewOnly(filled(skeleton)).replace('export const meta =', 'const meta ='))
const REVIEW = 'Review the commits ' + BASE + '..' + INITIAL + ' of the repository at the tree root.'
const reviewArgs = (fields = {}) => ({ review: REVIEW, ...fields })
const reviewSeats = readers.filter(seat => !['spec', 'inverse'].includes(seat))
// Without a spec the correctness reviewer, the duplicate checker and the rule reader return no abort.
const specFreeSeats = { ...seatObject, correctness: () => cold(), dupes: () => cold(),
  rules: () => cold({ ruleSources: [{ path: 'CLAUDE.md', read: true }] }) }
const simulateReview = (options = {}) =>
  simulate({ script: reviewRun, args: reviewArgs(), seats: specFreeSeats, harness: schemaChecked, ...options })
const NO_SPEC_LINE = 'NO SPEC: this change was made without a spec. Read none, and judge the change by the code and the rule sources.'

describe('review-only runs', () => {
  test('a review-only run starts the reviewers that need no spec on its request, and no other stage', async () => {
    const { result, calls, phases } = await simulateReview()
    expect(calls.map(c => c.label)).toEqual(reviewSeats.map(seat => 'review:' + seat))
    expect(phases).toEqual(['Review'])
    for (const call of calls) {
      expect([call.label, call.prompt.endsWith('REVIEW REQUEST, from the session that started this review: ' + REVIEW)]).toEqual([call.label, true])
      expect([call.label, call.prompt.includes('implementer claims'), call.prompt.includes('ARTIFACTS the implementer')]).toEqual([call.label, false, false])
      expect([call.label, call.prompt.includes('check-spec.ts'), call.prompt.includes('SPEC (authority)'), 'abort' in call.schema.properties])
        .toEqual([call.label, false, false, false])
    }
    expect([result.exit, result.remaining, result.snapshots, result.proof]).toEqual(['clean', [], null, null])
  })

  test('a review request in any form reaches every reviewer as the session wrote it', async () => {
    const review = [{ path: '.', from: BASE, to: INITIAL }, { path: 'web', note: 'the uncommitted edit of the login form' }]
    const { calls } = await simulateReview({ args: reviewArgs({ review }) })
    for (const call of calls) expect([call.label, call.prompt.endsWith(JSON.stringify(review))]).toEqual([call.label, true])
  })

  test('the reviewers that read the spec in a main run are told that the change has none, and the rule reader keeps its rule sources', async () => {
    const { calls } = await simulateReview()
    const main = await simulate()
    for (const call of calls) {
      const briefed = main.calls.find(c => c.label === call.label).prompt.includes('SPEC (authority)')
      expect([call.label, call.prompt.split(NO_SPEC_LINE).length - 1]).toEqual([call.label, briefed ? 1 : 0])
    }
    const rules = calls.find(c => c.label === 'review:rules')
    expect(rules.prompt).toContain('RULE SOURCES: ')
    expect([rules.schema.required, rules.schema.properties.findings.items.properties.kind])
      .toEqual([['limitations', 'coverage', 'findings', 'ruleSources'], { enum: ['band-aid', 'longer-route'] }])
    for (const label of ['review:correctness', 'review:dupes']) {
      expect([label, calls.find(c => c.label === label).schema]).toEqual([label, calls.find(c => c.label === 'review:quality').schema])
    }
  })

  test('the findings and limitations of a review-only run go to the root as the reviewers returned them', async () => {
    const bandAid = { ...finding, kind: 'band-aid', severity: 'should-fix', claim: 'The catch block hides a defect of the reader.' }
    const narrows = { what: 'the integration suite', effect: 'narrows' }
    const { result } = await simulateReview({ reports: {
      'review:correctness': { findings: [finding] }, 'review:quality': { findings: [bandAid] },
      'review:code-smell': { limitations: [narrows] } } })
    expect([result.exit, result.detail]).toEqual(['follow-up', 'The pass completed with items requiring follow-up.'])
    expect(result.remaining.map(r => [r.kind, r.severity, r.item.id ?? r.item.what])).toEqual([
      ['review-finding', 'must-fix', 'correctness:0'], ['review-finding', 'CRITICAL', 'quality:0'],
      ['review-limitation', 'should-fix', 'the integration suite']])
    expect(result.remaining.filter(r => r.kind === 'review-limitation').map(r => r.item.label)).toEqual(['review:code-smell'])
    // A should-fix finding alone leaves the run clean with the finding in remaining.
    const minor = await simulateReview({ reports: { 'review:quality': { findings: [{ ...finding, severity: 'should-fix' }] } } })
    expect([minor.result.exit, minor.result.remaining.map(r => r.kind)]).toEqual(['clean', ['review-finding']])
    // A blocking limitation of a reviewer ends the run for the root.
    const blocked = await simulateReview({ reports: { 'review:rules': { limitations: [{ what: 'CLAUDE.md', effect: 'blocks' }] } } })
    expect([blocked.result.exit, blocked.result.detail]).toEqual(['root-resolution', 'Blocking limitation from review:rules.'])
  })

  test('a review-only run returns the findings of every reviewer to be fixed, each under its reviewer, and no spec', async () => {
    const bandAid = { ...finding, kind: 'band-aid', severity: 'should-fix', claim: 'The catch block hides a defect of the reader.' }
    const { result } = await simulateReview({ reports: { 'review:correctness': { findings: [finding] }, 'review:quality': { findings: [bandAid] } } })
    expect(result.spec).toBeNull()
    expect(result.toFix).toEqual([
      { source: 'review:correctness:0', finding: { ...finding, id: 'correctness:0', seat: 'correctness', snapshots: null } },
      { source: 'review:quality:0', finding: { ...bandAid, severity: 'CRITICAL', id: 'quality:0', seat: 'quality', snapshots: null } }])
  })

  test('a reviewer that fails ends a review-only run, and the others\' findings still reach the root', async () => {
    const failing = await simulateReview({ reports: { 'review:correctness': { findings: [finding] } },
      fail: { 'review:code-smell': 'model unavailable' } })
    expect([failing.result.exit, failing.result.remaining.map(r => [r.kind, r.item.label ?? r.item.id])])
      .toEqual(['failed', [['stage-failure', 'review:code-smell'], ['review-finding', 'correctness:0']]])
  })

  test('the review mode, its request and every model entry are checked before any agent', async () => {
    const reviewSource = reviewOnly(filled(skeleton))
    for (const [source, args, message] of [
      [reviewSource, reviewArgs({ review: undefined }), 'args.review must say what to review'],
      [reviewSource, reviewArgs({ base: at(BASE) }), 'a review pass takes args.review alone: leave args.base out'],
      [filled(skeleton).replace("  mode: 'main',", "  mode: 'review-only',"), launchArgs(), 'UNIT.mode must be one of main, review, follow-up'],
      [reviewSource, reviewArgs({ specPath: SPEC_PATH, transcripts: TRANSCRIPTS }), 'a review pass takes args.review alone: leave args.specPath, args.transcripts out'],
      [reviewOnly(filled(skeleton).replace(SPEC_SEAT_MODELS[0], SPEC_SEAT_MODELS[0] + SPEC_SEAT_MODELS[0])), reviewArgs(),
        'UNIT.models.review.spec names no agent this run starts'],
      [reviewSource.replace("    review: {", "    impl: { model: 'model-impl', effort: 'high' },\n    review: {"), reviewArgs(),
        'UNIT.models.impl names no agent this run starts'],
    ]) {
      const seen = []
      const script = new AsyncFunction('agent', 'phase', 'log', 'args', source.replace('export const meta =', 'const meta ='))
      await expect(script(async prompt => { seen.push(prompt) }, () => {}, () => {}, args)).rejects.toThrow(message)
      expect([message, seen]).toEqual([message, []])
    }
  })
})

const followUpSource = withoutStageModels(filled(skeleton).replace("  mode: 'main',", "  mode: 'follow-up',"), ['fix', 'roast'])
const followUpRun = new AsyncFunction('agent', 'phase', 'log', 'args', followUpSource.replace('export const meta =', 'const meta ='))
const followUpWithoutSpec = new AsyncFunction('agent', 'phase', 'log', 'args',
  withoutSpecSeats(followUpSource).replace('export const meta =', 'const meta ='))
const PARENT_CHECKED = { path: SPEC_PATH, sha256: 'd'.repeat(64), lines: 9 }
const ENTRIES = [{ source: 'verify:0', decision: decision([source('correctness')]) },
  { source: 'roaster:0', finding: { ...finding, claim: 'The retry loop never stops.' } }]
const parentOf = (fields = {}) => ({ spec: PARENT_CHECKED, toFix: ENTRIES, artifacts: [], snapshots: at(BASE), ...fields })
const followUpArgs = (fields = {}) => ({ base: at(BASE), transcripts: TRANSCRIPTS, parent: parentOf(), ...fields })
const followUpValues = args => args.parent.spec
  ? { spec: args.parent.spec.path, transcripts: args.transcripts, base: args.base, partialBase: false, tree: '<isolated worktree>',
    sha256: args.parent.spec.sha256 }
  : { base: args.base, partialBase: false, tree: '<isolated worktree>' }
const followUpCheck = (args, printed = {}) => passedCheck(followUpValues(args), {}, args.parent.spec
  ? { spec: args.parent.spec.path, sha256: args.parent.spec.sha256, specLines: args.parent.spec.lines, ...printed } : { base: args.base })
const followUpImplementation = (dispositions, fields = {}) => writer({ startSha: BASE, snapshotSha: INITIAL, premises: [], artifacts: [],
  checks: [fullCheck()], dispositions, ...fields }, 'resolve the entries')
const simulateFollowUp = ({ args = followUpArgs(), answers, implementation, ...options } = {}) => simulate({ args,
  script: args.parent.spec === null ? followUpWithoutSpec : followUpRun, specCheck: followUpCheck(args),
  implementation: implementation ?? followUpImplementation(answers ?? args.parent.toFix.map(entry => disposition(entry.source))), ...options })

describe('follow-up runs', () => {
  test('a follow-up run resolves what its parent run returned, under the spec that run checked, with no fixer after its verifier', async () => {
    const args = followUpArgs()
    const { result, calls, phases } = await simulateFollowUp({ args, harness: schemaChecked })
    const impl = calls[0]
    const command = "bun '<plugin root>/tools/check-spec.ts' '" + SPEC_PATH + "' --transcripts '" + TRANSCRIPTS + "' --json --base '" +
      JSON.stringify(at(BASE)) + "' --sha256 '" + PARENT_CHECKED.sha256 + "' --proof '" + fingerprint(followUpValues(args)) + "'"
    expect([impl.label, impl.agentType, impl.prompt.startsWith(checkFirst('SPEC CHECK', command) + '\n\n')]).toEqual(['impl', 'implementer', true])
    expect(impl.prompt.endsWith('ENTRIES (UNTRUSTED claims, verify them against the tree and the authority):\n\n' + JSON.stringify(ENTRIES))).toBe(true)
    expect([impl.prompt.includes('<the check command>'), impl.prompt.includes('FOCUSED CHECKS'), 'senseCheck' in impl.schema.properties])
      .toEqual([true, false, false])
    expect(phases).toEqual(['Implement', 'Review', 'Verify'])
    expect(calls.some(c => ['fixer', 'roaster'].includes(c.agentType))).toBe(false)
    const work = 'WORK OF THIS FOLLOW-UP RUN, the entries its implementer resolved, as the parent run returned them (UNTRUSTED claims):\n\n' +
      JSON.stringify(ENTRIES)
    for (const call of calls.slice(1)) {
      expect([call.label, call.prompt.includes(work)]).toEqual([call.label, ['review:correctness', 'review:dupes', 'review:inverse', 'verify'].includes(call.label)])
    }
    expect([result.exit, result.remaining, 'toFix' in result, result.spec]).toEqual(['clean', [], false, PARENT_CHECKED])
  })

  test('a follow-up run whose spec changed since its parent checked it ends before any later stage', async () => {
    const stderr = "the spec's sha256 is " + 'e'.repeat(64) + ', and the run expects the spec its parent run checked, of sha256 ' + PARENT_CHECKED.sha256
    const { result, calls } = await simulateFollowUp({ specCheck: { exitCode: 1, stdout: '', stderr } })
    expect([result.exit, result.detail.endsWith('stderr: ' + stderr), labels(calls)]).toEqual(['failed', true, ['impl']])
  })

  test('when its review does not complete, a follow-up run keeps its entries open and records what the other reviewers found', async () => {
    const { result } = await simulateFollowUp({ reports: oneReport, fail: { 'review:code-smell': 'model unavailable' } })
    expect([result.exit, result.remaining.map(r => [r.kind, r.item.label ?? r.item.id ?? r.item.entry.source])]).toEqual(['failed', [
      ['stage-failure', 'review:code-smell'], ['unfixed-entry', 'verify:0'], ['unfixed-entry', 'roaster:0'], ['review-finding', 'correctness:0']]])
  })

  test('an unresolved entry returns with its problem statement for the user, a rejection closes its entry, and a fix without a commit does not', async () => {
    const left = await simulateFollowUp({ answers: [unresolved('verify:0'), disposition('roaster:0', 'rejected')] })
    expect([left.result.exit, left.result.detail]).toEqual(['root-resolution', 'An entry came back unresolved.'])
    expect(left.result.remaining).toEqual([{ kind: 'unresolved-entry', severity: 'CRITICAL',
      item: { entry: ENTRIES[0], problem: unresolved('verify:0').problem, receipts: [receipt] } }])
    expect(left.result.dispositions).toEqual([unresolved('verify:0'), disposition('roaster:0', 'rejected')])
    // An implementer that committed nothing leaves the tree at its base, where the verifier finds it.
    const unmoved = verification([], { repositories: [{ path: '.', snapshotSha: BASE, clean: true, git: { head: BASE, status: '' } }] })
    const uncommitted = await simulateFollowUp({ implementation: followUpImplementation(ENTRIES.map(entry => disposition(entry.source)), { snapshotSha: BASE }),
      verify: { verify: unmoved } })
    expect(uncommitted.result.remaining.map(r => [r.kind, r.item.entry.source, r.item.response.disposition]))
      .toEqual([['unfixed-entry', 'verify:0', 'fixed'], ['unfixed-entry', 'roaster:0', 'fixed']])
  })

  for (const [name, answer, message] of [
    ['no answer', null, 'Missing entry key'],
    ['an unresolved answer with a reason', { ...unresolved('verify:0'), reason: 'Which channel should it use?' },
      'Answer verify:0 (unresolved), field reason: an unresolved result states its problem in problem and carries no reason'],
    ['a fix with a problem', { ...disposition('verify:0'), problem: unresolved('verify:0').problem }, 'Answer verify:0 (fixed), field problem: only an unresolved result carries a problem statement'],
    ['a problem without its reason for being unsolved', { ...unresolved('verify:0'), problem: { ...unresolved('verify:0').problem, whyUnsolved: '' } },
      'Answer verify:0 (unresolved), field problem.whyUnsolved: must be nonempty text'],
  ]) {
    test(`a follow-up implementer whose answers hold ${name} is retried and then fails the run`, async () => {
      const answers = [...answer ? [answer] : [], disposition('roaster:0')]
      const { result, calls } = await simulateFollowUp({ answers })
      expect([result.exit, result.detail.includes(message), labels(calls)]).toEqual(['failed', true, ['impl', 'impl', 'impl']])
    })
  }

  test('what the verifier of a follow-up run approves returns unfixed at its severity, and nothing runs after it', async () => {
    const { result, calls } = await simulateFollowUp({ reports: oneReport, verify: approveOne })
    expect(result.remaining.map(r => [r.kind, r.severity, r.item.approved.key])).toEqual([['unfixed-approval', 'must-fix', 'fix:0']])
    expect([result.exit, calls.some(c => c.phase === 'Fix')]).toEqual(['follow-up', false])
  })

  test('a follow-up run of a change made without a spec checks its base list, runs the reviewers that need none, and judges by the rules', async () => {
    const review = { source: 'review:quality:0', finding: { ...finding, id: 'quality:0', seat: 'quality', snapshots: null } }
    const args = followUpArgs({ transcripts: undefined, parent: parentOf({ spec: null, snapshots: null, toFix: [review] }) })
    const { result, calls } = await simulateFollowUp({ args, seats: specFreeSeats, seatLabels: reviewSeats, harness: schemaChecked })
    const command = "bun '<plugin root>/tools/check-spec.ts' --json --base '" + JSON.stringify(at(BASE)) + "' --proof '" +
      fingerprint(followUpValues(args)) + "'"
    expect(calls[0].prompt.startsWith(checkFirst('BASE CHECK', command) + '\n\n')).toBe(true)
    expect(calls[0].schema.properties.abort.properties.trigger.enum).toEqual(['none', 'directive-conflict', 'sense-check'])
    for (const call of [calls[0], calls.find(c => c.label === 'verify')]) {
      expect([call.label, call.prompt.includes(NO_SPEC_LINE), call.prompt.includes('SPEC (authority)')]).toEqual([call.label, true, false])
    }
    expect(calls.filter(c => c.phase === 'Review').map(c => c.label)).toEqual(reviewSeats.map(seat => 'review:' + seat))
    // Its two code reviewers still compare each change with the entry it answers.
    for (const call of calls.filter(c => c.phase === 'Review')) {
      expect([call.label, call.prompt.includes('WORK OF THIS FOLLOW-UP RUN'), call.prompt.includes('implementer claims')])
        .toEqual([call.label, ...Array(2).fill(['review:correctness', 'review:dupes'].includes(call.label))])
    }
    expect([result.exit, result.spec]).toEqual(['clean', null])
  })

  test('a size breach joins the entries after what the parent run returned, beside the spec lines that run counted', async () => {
    const size = { codeAdded: 400, repositories: [{ path: '.', base: BASE, candidate: INITIAL }] }
    const breach = { source: 'size', size: { specLines: PARENT_CHECKED.lines, ...size } }
    const { calls } = await simulateFollowUp({ args: followUpArgs({ size }), answers: [...ENTRIES, breach].map(entry => disposition(entry.source)) })
    expect(calls[0].prompt.endsWith('\n\n' + JSON.stringify([...ENTRIES, breach]))).toBe(true)
  })

  test('an unresolved verifier report travels unchanged from a main run through an accepted follow-up', async () => {
    const printed = { spec: SPEC_PATH, sha256: PARENT_CHECKED.sha256, specLines: PARENT_CHECKED.lines }
    const { correction, ...open } = decision([source('correctness', 1)], { action: 'unresolved' })
    const { result } = await simulate({ specCheck: passedCheck(mainLaunchValues(launchArgs()), {}, printed),
      reports: { 'review:correctness': { findings: [backed, backed] } },
      verify: { verify: verification([decision([source('correctness')]), open]) },
      fixes: { fix: fixed([disposition()]) }, harness: schemaChecked })
    const parent = { spec: result.spec, toFix: result.toFix, artifacts: result.artifacts, snapshots: result.snapshots }
    const snapshotSha = parent.snapshots[0].sha
    const args = { base: parent.snapshots, transcripts: TRANSCRIPTS, parent }
    const answers = parent.toFix.map(entry => disposition(entry.source, 'rejected'))
    const followed = await simulateFollowUp({ args,
      implementation: followUpImplementation(answers, { startSha: snapshotSha, snapshotSha }),
      verify: { verify: verification([], { repositories: [{ path: '.', snapshotSha, clean: true, git: { head: snapshotSha, status: '' } }] }) },
      harness: schemaChecked })
    expect(parent.toFix).toEqual([{ source: 'verify:1', decision: open }])
    expect(followed.calls[0].prompt.endsWith('\n\n' + JSON.stringify(parent.toFix))).toBe(true)
    expect([followed.result.exit, followed.result.remaining, followed.result.dispositions]).toEqual(['clean', [], answers])
  })

  test('launch values a follow-up run cannot start from stop it before any agent', async () => {
    const size = { codeAdded: 400, repositories: [{ path: '.', base: BASE, candidate: INITIAL }] }
    for (const [args, expected] of [
      [followUpArgs({ parent: undefined }), "args.parent must hold exactly the spec, toFix, artifacts, snapshots fields of the parent run's result"],
      [followUpArgs({ parent: { ...parentOf(), exit: 'clean' } }), "args.parent must hold exactly the spec, toFix, artifacts, snapshots fields"],
      [followUpArgs({ parent: parentOf({ spec: { path: SPEC_PATH, lines: 9 } }) }), 'args.parent.spec must be null or the spec the parent run checked'],
      [followUpArgs({ parent: parentOf({ toFix: [{ source: 'entry:0', entry: {} }] }) }), 'args.parent.toFix holds an item of another form: "entry:0"'],
      [followUpArgs({ parent: parentOf({ toFix: [ENTRIES[0], ENTRIES[0]] }) }), 'args.parent.toFix holds the source verify:0 twice'],
      [followUpArgs({ base: at(INITIAL) }), 'args.base must be the final snapshots the parent run returned'],
      [followUpArgs({ transcripts: undefined }), 'args.transcripts must name the transcript directory'],
      [followUpArgs({ specPath: SPEC_PATH }), 'a follow-up run reads the spec its parent run checked: leave args.specPath out'],
      [followUpArgs({ parent: parentOf({ toFix: [] }) }), 'a follow-up run needs work'],
      [followUpArgs({ size: { codeAdded: -1, repositories: [] } }), 'args.size must hold codeAdded'],
      [followUpArgs({ size, parent: parentOf({ spec: null }) }), 'args.size needs the spec lines of its parent run'],
    ]) {
      const { message, calls } = await stopsBeforeAnyAgent(args.parent?.spec === null ? withoutSpecSeats(followUpSource) : followUpSource, args)
      expect([expected, message?.includes(expected), calls]).toEqual([expected, true, []])
    }
  })
})
