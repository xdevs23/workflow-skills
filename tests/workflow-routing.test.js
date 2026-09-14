import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

const skill = await Bun.file(new URL('../skills/implement-review-verify/SKILL.md', import.meta.url)).text()
const blocks = []
Bun.markdown.render(skill, {
  code(body, { language }) {
    if (language === 'js') blocks.push(body)
    return ''
  },
})
const skeleton = blocks.find(code => code.includes("name: 'kebab-name'"))
if (!skeleton) throw new Error('Main workflow skeleton is missing')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const run = new AsyncFunction('agent', 'phase', 'log', 'args',
  skeleton.replace('export const meta =', 'const meta ='))

const readers = ['correctness', 'cleanliness', 'spec', 'dupes', 'quality', 'inverse', 'rules', 'alternatives']
const source = (seat, round = 1, index = 0) => `r${round}:${seat}:${index}`
const CRITERIA = 2
const receipt = { file: 'src/example.js', line: 12, quote: 'catch (error) {}' }
const finding = { file: 'src/example.js', claim: 'The specified error is swallowed.', severity: 'must-fix', lane: 'fixer-actionable', receipts: [receipt] }
const noAbort = { trigger: 'none', reason: '' }
const coverage = [{ what: 'src/example.js', checked: true, how: 'read in full against the diff' }]
const verdicts = () => Array.from({ length: CRITERIA }, (_, i) => ({ criterion: i + 1, verdict: 'PASS', receipts: [receipt] }))
// Stage objects: the cold reader shape, the briefed reader shape (abort), and each seat's own fields.
const cold = (fields = {}) => ({ limitations: [], coverage, findings: [], ...fields })
const briefed = (fields = {}) => ({ abort: noAbort, ...cold(fields) })
const seatObject = {
  correctness: () => briefed({ verdicts: verdicts() }), cleanliness: () => briefed({ verdicts: verdicts() }),
  spec: () => briefed({ verdicts: verdicts() }), dupes: () => briefed({ verdicts: verdicts() }),
  quality: () => cold(),
  inverse: () => briefed({ authorizations: [{ choice: 'the error propagation helper', receipts: [receipt],
    authority: 'docs/spec.md:8: "Return the error to the caller."', class: 'authorized', saving: '' }] }),
  rules: () => briefed({ ruleSources: [{ path: 'CLAUDE.md', read: true }] }),
  alternatives: () => cold({ currentShapeRight: true, candidates: [] }),
  roaster: () => cold(),
}
const decision = (ids, fields = {}) => ({
  sourceIds: ids, action: 'approve-fix', severity: 'must-fix',
  reason: 'The implementation contradicts the required failure behavior.',
  evidence: 'src/example.js:12 catches and ignores this error.',
  authority: 'docs/spec.md:8: "Return the error to the caller."',
  correction: 'Return the specified error to the caller.',
  constraints: 'Do not change the success response.',
  acceptance: 'Exercise the failure path and assert the caller receives the error.',
  receipts: [receipt],
  ...fields,
})
const check = (passed = true) => ({ command: 'bun test tests/', passed, output: passed ? '2 pass' : '1 fail', truncated: false })
const verification = (decisions = [], fields = {}) => ({
  abort: noAbort, limitations: [], checks: [], decisions, issues: [], closures: [], specSuggestions: [], ...fields,
})
const fixed = (dispositions = [], fields = {}) => ({
  abort: noAbort, limitations: [], premises: [], specSuggestions: [], touched: dispositions.length ? ['src/example.js'] : [],
  proofPassed: true, dispositions, ...fields,
})
const disposition = (key = 'r1:fix:0', kind = 'fixed') => ({ key, disposition: kind, reason: 'Checked the approved correction and its acceptance condition.', receipts: [receipt] })
const closed = (key = 'r1:fix:0') => ({ key, verdict: 'closed', evidence: 'The failure-path test now observes the specified error.' })

const BASE = 'a'.repeat(40)
const INITIAL = 'b'.repeat(40)
const fixedSha = round => (round + 1).toString(16).padStart(40, '0')
// A writer object whose commits, files, checks and git agree with its snapshot fields unless overridden.
const writer = (fields, subject) => {
  const r = { abort: noAbort, limitations: [], clean: true, proofPassed: true, specSuggestions: [], ...fields }
  const moved = r.snapshotSha !== r.startSha
  return {
    commits: moved ? [{ sha: r.snapshotSha, subject }] : [],
    files: moved ? [{ path: 'src/example.js', bytes: 120, change: 'modified' }] : [],
    checks: [check(r.proofPassed)], git: { head: r.snapshotSha, status: r.clean ? '' : ' M src/example.js' },
    ...r,
  }
}
const implemented = (fields = {}) => writer({ startSha: BASE, snapshotSha: INITIAL, premises: [],
  senseCheck: { passed: true, recordSilent: true, note: '' }, ...fields }, 'implement the change')
async function simulate({ reports = {}, verify = {}, fixes = {}, fail = {}, implementation,
  beforeRead = async () => {}, beforeFix = async () => {}, beforeRoast = async () => {},
  args = { baseSha: BASE, criteriaCount: CRITERIA }, calls = [], logs = [] } = {}) {
  const completed = new Set(), phases = [], starts = new Map()
  let currentSha = INITIAL
  let lastReviewedSha = null
  let lastWriter = null
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    expect(opts.model).toBe('<explicit>')
    expect(opts.effort).toBe('high')
    if (fail[opts.label]) throw new Error(fail[opts.label])
    if (opts.label === 'impl') return (lastWriter = implementation ?? implemented())
    if (opts.phase === 'Review') {
      await beforeRead(opts)
      completed.add(opts.label)
      return { ...seatObject[opts.label.split(':')[1]](), ...reports[opts.label] }
    }
    if (opts.phase === 'Verify') {
      const round = opts.label.slice('verify:r'.length)
      if (currentSha !== lastReviewedSha) {
        for (const seat of readers) expect(completed.has(`review:${seat}:r${round}`)).toBe(true)
        lastReviewedSha = currentSha
      }
      if (Number(round) > 1) expect(completed.has(`roast:r${Number(round) - 1}`)).toBe(true)
      return { snapshotSha: currentSha, clean: true, git: { head: currentSha, status: '' },
        writerScope: lastWriter.commits.map(c => ({ sha: c.sha, ok: true, filesMatch: true, note: '' })),
        ...(verify[opts.label] ?? verification()) }
    }
    const round = Number(opts.label.slice(opts.label.indexOf(':r') + 2))
    if (opts.agentType === 'roaster') {
      const snapshotSha = starts.get(round) ?? currentSha
      await beforeRoast(opts)
      completed.add(opts.label)
      return { snapshotSha, ...cold(), ...reports[opts.label] }
    }
    if (opts.agentType === 'fixer') {
      const startSha = starts.get(round) ?? currentSha   // a retried attempt starts where the first one did
      starts.set(round, startSha)
      await beforeFix(opts)
      const response = fixes[opts.label] ?? fixed()
      const result = writer({ startSha,
        snapshotSha: response.snapshotSha ?? (response.touched.length ? fixedSha(round) : startSha),
        ...response }, 'apply the approved corrections')
      currentSha = result.snapshotSha
      lastWriter = result
      completed.add(opts.label)
      return result
    }
    throw new Error(`Unexpected call: ${opts.label}`)
  }
  const result = await run(agent, name => phases.push(name), line => logs.push(line), args)
  return { result, calls, phases, logs }
}
const oneReport = { 'review:correctness:r1': { findings: [finding] } }
const approveOne = { 'verify:r1': verification([decision([source('correctness')])]) }
// The pre-run skeleton (two cold spec seats) executed with a mocked agent() and the same args.
const coldSkeleton = blocks.find(code => code.includes("name: 'spec-cold-review'"))
const coldObject = label => label === 'spec:gaps'
  ? { limitations: [], gaps: [], categories: [{ name: 'edge cases', gaps: 0 }] }
  : { limitations: [], satisfiable: true, conflicts: [],
    criteria: Array.from({ length: CRITERIA }, (_, i) => ({ criterion: i + 1, checkable: true, why: 'observable' })) }
// The pre-run reuses the main skeleton's leaf shapes and stage() helper: copied in here as its author would.
const shared = (from, to) => skeleton.slice(skeleton.indexOf(from), skeleton.indexOf(to))
const preRun = (agent, args = { criteriaCount: CRITERIA }, logs = []) =>
  new AsyncFunction('agent', 'phase', 'log', 'args', [shared('const RECEIPT =', '// output quotes'),
    shared('const hasHardFlag =', '// The root supplies'), coldSkeleton.replace('export const meta =', 'const meta =')].join('\n'))(
    agent, () => {}, line => logs.push(line), args)

// These tests execute the documented skeleton with deterministic fake stage results.
// They do not launch workflows or make model calls.
describe('workflow verification and consolidation', () => {
  test('cycle completion leaves root acceptance and project integration pending', async () => {
    const { result } = await simulate()
    expect(result.complete).toBe(true)
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

  test('agent templates do not declare model defaults', async () => {
    const directory = new URL('../agents/', import.meta.url)
    const files = [...new Bun.Glob('*.md').scanSync({ cwd: fileURLToPath(directory) })]
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const template = await Bun.file(new URL(file, directory)).text()
      expect(template).not.toMatch(/^\s*model\s*:/m)
    }
  })

  test('the finding verifier and fixer templates treat every inverse-spec finding as unconditionally CRITICAL', async () => {
    const directory = new URL('../agents/', import.meta.url)
    const verifierTemplate = await Bun.file(new URL('finding-verifier.md', directory)).text()
    const fixerTemplate = await Bun.file(new URL('fixer.md', directory)).text()
    expect(verifierTemplate).toContain('Every inverse-spec source finding is CRITICAL, unconditionally')
    expect(verifierTemplate).toContain('an edited spec is not closure')
    expect(fixerTemplate).toMatch(/inverse-spec finding keeps its CRITICAL\s+classification and inverse-spec origin unconditionally/)
  })

  test('both spec-review templates check the recorded directives, and inverse-spec always reports CRITICAL', async () => {
    const directory = new URL('../agents/', import.meta.url)
    const specTemplate = await Bun.file(new URL('reviewer-spec-compliance.md', directory)).text()
    const inverseTemplate = await Bun.file(new URL('reviewer-inverse-spec.md', directory)).text()
    expect(specTemplate).toContain('recorded human directives')
    expect(specTemplate).toContain('even where the implementation matches the spec')
    expect(inverseTemplate).toContain('recorded directives outrank the spec')
    expect(inverseTemplate).toContain('Report every finding here as CRITICAL')
  })

  test('the spec-writing and research/verify loop skills wire in the directive veto', async () => {
    const dir = new URL('../skills/', import.meta.url)
    const specWriting = await Bun.file(new URL('immaculate-spec-writing/SKILL.md', dir)).text()
    const research = await Bun.file(new URL('research-loop/SKILL.md', dir)).text()
    const verify = await Bun.file(new URL('verify-loop/SKILL.md', dir)).text()
    expect(specWriting).toContain('private directive record')
    expect(specWriting).toMatch(/never installs a new product, architecture, persistence, security or\s+operational choice/)
    expect(research).toMatch(/cannot settle a product,\s+architecture, persistence, security or operational choice/)
    expect(verify).toContain('is not something this loop resolves by editing')
  })

  test('the private-source section requires context, provenance and treats a missing record as a limitation', () => {
    expect(skill).toContain('qualifications, surrounding context and examples')
    expect(skill).toContain('with its provenance recorded')
    expect(skill).toContain('is an explicit limitation that blocks')
  })

  test('PINS requires reading directive context, rejects a keyword test, and flags missing evidence as root-action', () => {
    expect(skill).toContain('absence of a particular keyword never licenses behavior')
    expect(skill).toContain('an example never authorizes an unrelated feature')
    expect(skill).toContain('is a root-action limitation')
  })

  test('a hard flag caught after edits already landed stops further writes without reverting them', async () => {
    expect(skill).toMatch(/caught after\s+some edits already landed, it stops further writes/)
    expect(skill).toContain('without reverting them')
    const implementer = await Bun.file(new URL('../agents/implementer.md', import.meta.url)).text()
    expect(implementer).toContain('leave the tree unmodified')
    expect(implementer).toContain('do not revert them')
    expect(implementer).not.toContain('No extra gate')
    expect(skill).not.toContain('No extra gate')
  })

  test('a 20-minute soft ceiling per agent task triggers the timing review', async () => {
    expect(skill).toMatch(/Twenty minutes of executed \(not cached-replay\) elapsed time per agent task is\s+the soft ceiling/)
    expect(skill).toMatch(/exceeds 20 minutes automatically triggers this review/)
    expect(skill).toMatch(/no agent is aborted, killed or timed out for crossing it/)
    const docs = await Bun.file(new URL('../docs/workflow-finding-verification.md', import.meta.url)).text()
    expect(docs).toMatch(/Twenty minutes of executed time per agent task is a\s+soft ceiling/)
    expect(docs).toMatch(/crossing it automatically triggers that timing review/)
  })

  test('the spec-writing skill requires the private record itself, not just an "if any" hedge', async () => {
    const specWriting = await Bun.file(new URL('../skills/immaculate-spec-writing/SKILL.md', import.meta.url)).text()
    expect(specWriting).not.toContain('if any')
    expect(specWriting).toContain('cannot be omitted from that record')
    expect(specWriting).toMatch(/keep factual\s+research findings distinct from the decisions/)
  })

  test('the workflow skill wires a root question-premise check ahead of any decision request', () => {
    expect(skill).toContain('### Root question-premise check')
    expect(skill).toContain('checks its premises first')
    expect(skill).toContain('inverseSpecDecisions')
    expect(skill).toContain('it cannot prove a future model actually performed the')
  })

  test('every main and cold-review stage receives the execution boundary without orchestration tools', async () => {
    const { result, calls } = await simulate()
    expect(result.complete).toBe(true)
    expect(coldSkeleton).toBeDefined()
    const coldCalls = []
    await preRun(async (prompt, opts) => { coldCalls.push({ prompt, ...opts }); return coldObject(opts.label) })
    expect(coldCalls).toHaveLength(2)
    for (const { prompt } of [...calls, ...coldCalls]) {
      expect(prompt).toContain('you are one assigned stage, not the orchestrator')
      expect(prompt).toContain('Do not launch workflows or subagents, directly or through skills or shell commands')
      expect(prompt).toContain('those checks have NOT already passed')
      expect(prompt).toContain('Missing orchestration tools alone do not block')
      expect(prompt).toContain('Report genuinely missing assignment capabilities/instructions, authorization or conflicting applicable requirements')
    }
    const types = new Set([...calls, ...coldCalls].map(c => c.agentType).filter(Boolean))
    for (const type of types) {
      const template = await Bun.file(new URL(`../agents/${type}.md`, import.meta.url)).text()
      const tools = type === 'roaster' ? 'Bash'
        : ['implementer', 'fixer'].includes(type) ? 'Read, Grep, Glob, Bash, Edit, Write'
        : 'Read, Grep, Glob, Bash'
      expect(template).toContain(`\ntools: ${tools}\n---\n`)
      expect(template).toContain('Execution boundary: perform only your assigned stage')
    }
  })

  test('fixer and mandatory roaster overlap, with a pinned pre-fix snapshot', async () => {
    const roastEntered = Promise.withResolvers(), releaseRoast = Promise.withResolvers()
    let fixerSawRoaster = false
    const execution = simulate({
      reports: oneReport, verify: { ...approveOne, 'verify:r2': verification([], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) },
      beforeFix: async () => { await roastEntered.promise; fixerSawRoaster = true },
      beforeRoast: async () => { roastEntered.resolve(); await releaseRoast.promise },
    })
    await roastEntered.promise
    await new Promise(resolve => setImmediate(resolve))
    expect(fixerSawRoaster).toBe(true)
    releaseRoast.resolve()
    const { result, calls } = await execution
    expect(result.complete).toBe(true)
    const roast = calls.find(c => c.agentType === 'roaster')
    expect(roast.prompt).toContain('IMMUTABLE SNAPSHOT SHA: ' + INITIAL)
    expect(roast.prompt).toContain('IMMUTABLE BASE SHA: ' + BASE)
    expect(roast.prompt).toContain('r1:fix:0')
    expect(roast.prompt).toContain('planned, not completed')
    expect(roast.prompt).toContain('ONLY through Git objects')
    expect(roast.prompt).not.toContain('SPEC (authority)')
    expect(roast.prompt).not.toContain(fixedSha(1))
    expect(result.snapshotSha).toBe(fixedSha(1))
    expect(result.roastComplete).toBe(true)
    expect(result.unverifiedRoasts).toEqual([])
  })

  test('a stale roast is verified on the post-fix snapshot, not sent straight to the fixer', async () => {
    const { result, calls } = await simulate({
      reports: { ...oneReport, 'roast:r1': { findings: [finding] } },
      verify: { ...approveOne, 'verify:r2': verification([
        decision([source('roaster')], { action: 'reject', reason: 'The concurrent fix already resolved this defect.' }),
      ], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.counts.rejected).toBe(1)
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
    const verifier = calls.find(c => c.label === 'verify:r2')
    expect(verifier.prompt).toContain(source('roaster'))
    expect(verifier.prompt).toContain('"snapshotSha":"' + INITIAL + '"')
    expect(verifier.prompt).toContain('..' + fixedSha(1))
  })

  test('a surviving roast produces an approved next fix and the next roast uses that pass’s start SHA', async () => {
    const { result, calls } = await simulate({
      reports: { ...oneReport, 'roast:r1': { findings: [{ ...finding, claim: 'A separate required field is missing.' }] } },
      verify: {
        ...approveOne,
        'verify:r2': verification([decision([source('roaster')])], { closures: [closed()] }),
        'verify:r3': verification([], { closures: [closed('r2:fix:0')] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]), 'fix:r2': fixed([disposition('r2:fix:0')]) },
    })
    expect(result.complete).toBe(true)
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(2)
    expect(calls.filter(c => c.agentType === 'roaster')).toHaveLength(2)
    expect(calls.find(c => c.label === 'roast:r2').prompt).toContain('IMMUTABLE SNAPSHOT SHA: ' + fixedSha(1))
    expect(calls.find(c => c.label === 'fix:r2').prompt).toContain(source('roaster'))
    expect(result.snapshotSha).toBe(fixedSha(2))
  })

  for (const error of ['failed', 'wrong snapshot']) {
    test(`a ${error} mandatory roast prevents completion but preserves the fixer result`, async () => {
      const { result } = await simulate({
        reports: { ...oneReport, ...(error === 'wrong snapshot' ? { 'roast:r1': { snapshotSha: BASE } } : {}) },
        verify: approveOne, fixes: { 'fix:r1': fixed([disposition()]) },
        fail: error === 'failed' ? { 'roast:r1': 'roaster unavailable' } : {},
      })
      expect(result.complete).toBe(false)
      expect(result.snapshotSha).toBe(fixedSha(1))
      expect(result.unverified).toEqual(['r1:fix:0'])
      expect(result.unverifiedRoasts).toEqual([{ label: 'roast:r1', snapshotSha: INITIAL }])
      expect(result.roastComplete).toBe(false)
    })
  }

  for (const fields of [{ clean: false }, { snapshotSha: 'HEAD' }, { startSha: INITIAL }]) {
    test(`rejects invalid implementation snapshot metadata: ${JSON.stringify(fields)}`, async () => {
      await expect(simulate({ implementation: implemented(fields) })).rejects.toThrow('clean immutable snapshot')
    })
  }

  test('requires an immutable launch base, not a branch name', async () => {
    await expect(simulate({ args: { baseSha: 'main' } })).rejects.toThrow('full immutable baseSha')
  })

  test('a dirty or wrongly pinned fixer result cannot become the next snapshot', async () => {
    for (const fields of [{ clean: false }, { snapshotSha: 'HEAD' }, { startSha: BASE }]) {
      const { result } = await simulate({
        reports: oneReport, verify: approveOne, fixes: { 'fix:r1': fixed([disposition()], fields) },
      })
      expect(result.complete).toBe(false)
      expect(result.unverified).toEqual(['r1:fix:0'])
      expect(result.treeUnreviewed).toBe(true)
    }
  })

  test('proof-only cannot advance the commit even if no touched files are reported', async () => {
    const { result } = await simulate({ fixes: { 'fix:r1': fixed([], { snapshotSha: fixedSha(1) }) } })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('Proof-only pass edited or committed')
  })

  test('verifier-reported drift or dirty state blocks writing', async () => {
    for (const fields of [{ clean: false }, { snapshotSha: BASE }]) {
      const { result, calls } = await simulate({ verify: { 'verify:r1': verification([], fields) } })
      expect(result.complete).toBe(false)
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
    expect(result.complete).toBe(true)
    expect(result.exceptions).toEqual([])
    expect(result.unverified).toEqual([])
    expect(result.treeUnreviewed).toBe(false)
    expect(phases).toEqual(['Implement', 'Review', 'Verify', 'Fix', 'Review', 'Verify'])
    expect(calls.filter(c => c.agentType === 'finding-verifier')).toHaveLength(2)
    expect(calls.find(c => c.agentType === 'fixer').prompt).toContain('APPROVED CORRECTIONS (verify against the tree and authority):\n\n[]')
  })

  test('duplicates from ordinary and adversary readers produce one approved correction', async () => {
    const { result, calls } = await simulate({
      reports: { ...oneReport, 'review:alternatives:r1': { findings: [finding] } },
      verify: {
        'verify:r1': verification([decision([source('correctness'), source('alternatives')])]),
        'verify:r2': verification([], { closures: [closed()] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.unverified).toEqual([])
    expect(result.counts.approved).toBe(1)
    expect(result.history).toBeUndefined()
    expect(result.rounds[0].verifier).toBe('verify:r1')
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
      const { result, calls } = await simulate({ reports: oneReport, verify: { 'verify:r1': verification(decisions) } })
      expect(result.complete).toBe(false)
      expect(result.exit).toStartWith('incomplete verification:')
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    })
  }

  for (const field of ['authority', 'correction', 'constraints', 'acceptance', 'evidence', 'reason']) {
    test(`approval requires ${field}`, async () => {
      const { result, calls } = await simulate({
        reports: oneReport,
        verify: { 'verify:r1': verification([decision([source('correctness')], { [field]: '' })]) },
      })
      expect(result.complete).toBe(false)
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    })
  }

  for (const action of ['needs-decision', 'root-action']) {
    test(`${action} blocks even an otherwise approved correction`, async () => {
      const { result, calls } = await simulate({
        reports: { 'review:correctness:r1': { findings: [finding, finding] } },
        verify: { 'verify:r1': verification([
          decision([source('correctness')]),
          decision([source('correctness', 1, 1)], { action, correction: 'Resolve the necessary retention policy first.' }),
        ]) },
      })
      expect(result.complete).toBe(false)
      expect(result.exceptions).toHaveLength(1)
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    })
  }

  test('a verifier issue is not lost when the findings list is empty', async () => {
    const { result, calls } = await simulate({
      verify: { 'verify:r1': verification([], { issues: [{ kind: 'root-action', detail: 'The authority document is unavailable.' }] }) },
    })
    expect(result.complete).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a suggested spec edit does not block implementation, normal reviews or proof', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:spec:r1': { findings: [{
        file: 'docs/spec.md', claim: 'The optional example could explain the error response more clearly.',
        severity: 'nit', lane: 'orchestrator-only', receipts: [{ file: 'docs/spec.md', line: 8, quote: 'Return the error to the caller.' }],
      }] } },
      verify: { 'verify:r1': verification([decision([source('spec')], {
        action: 'record', severity: 'nit',
        reason: 'The implementation satisfies the existing requirements; clearer examples are optional.',
        evidence: 'The error response matches the specified contract and its tests pass.',
        correction: 'Report the optional documentation improvement for the root without editing the spec.',
      })]) },
    })
    expect(result.complete).toBe(true)
    expect(result.exceptions).toEqual([])
    expect(result.counts.recorded).toBe(1)
    for (const seat of readers) expect(calls.some(c => c.label === `review:${seat}:r1`)).toBe(true)
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
      verify: { 'verify:r1': verification([decision([source('correctness')], { action: 'record', severity: 'CRITICAL' })]) },
    })
    expect(result.exit).toContain('Blocking defect cannot be recorded as advisory')
  })

  test('an inverse-spec finding cannot be approved at a downgraded severity', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse:r1': { findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('inverse')], { severity: 'should-fix' })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding cannot be rejected at a downgraded severity either', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse:r1': { findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('inverse')], {
        action: 'reject', severity: 'nit', reason: 'Reads as a stylistic nit.', evidence: 'No behavior changed.',
      })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('a consolidated group with one inverse-spec source still requires CRITICAL severity', async () => {
    const { result } = await simulate({
      reports: { ...oneReport, 'review:inverse:r1': { findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('correctness'), source('inverse')], { severity: 'must-fix' })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding tagged CRITICAL can still be approved and fixed', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { findings: [finding] } },
      verify: {
        'verify:r1': verification([decision([source('inverse')], { severity: 'CRITICAL' })]),
        'verify:r2': verification([], { closures: [closed()] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.counts.approved).toBe(1)
    expect(calls.find(c => c.agentType === 'finding-verifier').prompt).toContain(source('inverse'))
  })

  test('an inverse-spec finding cannot be dispositioned as cleanup', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('inverse')], {
        action: 'cleanup', severity: 'CRITICAL',
        correction: 'Record it for later scheduling.',
      })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding cannot be dispositioned as cleanup')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('inverseSpecDecisions defaults to empty with no inverse-spec findings', async () => {
    const { result } = await simulate()
    expect(result.inverseSpecDecisions).toEqual([])
  })

  test('an approve-fix and a rejected inverse-spec decision both stay in the root handoff after completion', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse:r1': { findings: [finding, { ...finding, file: 'src/other.js' }] } },
      verify: {
        'verify:r1': verification([
          decision([source('inverse')], { severity: 'CRITICAL' }),
          decision([source('inverse', 1, 1)], {
            action: 'reject', severity: 'CRITICAL',
            reason: 'The cited excess is already required by an existing directive.',
            evidence: 'docs/spec.md:20 already authorizes this exact mechanism.',
          }),
        ]),
        'verify:r2': verification([], { closures: [closed()] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.exceptions).toEqual([])
    expect(result.inverseSpecDecisions).toHaveLength(2)
    expect(result.inverseSpecDecisions.map(d => d.action).sort()).toEqual(['approve-fix', 'reject'])
  })

  test('a mixed-source group carrying an inverse-spec ID still surfaces in the root handoff', async () => {
    const { result } = await simulate({
      reports: { ...oneReport, 'review:inverse:r1': { findings: [finding] } },
      verify: {
        'verify:r1': verification([decision([source('correctness'), source('inverse')], { severity: 'CRITICAL' })]),
        'verify:r2': verification([], { closures: [closed()] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.inverseSpecDecisions).toHaveLength(1)
    expect(result.inverseSpecDecisions[0].sourceIds).toEqual([source('correctness'), source('inverse')])
  })

  test('inverse-spec decisions from an earlier round still reach the root handoff after a later round rejects a new one', async () => {
    const secondFinding = { ...finding, file: 'src/other.js', claim: 'A second unauthorized mechanism appeared on the corrected snapshot.' }
    const { result } = await simulate({
      reports: {
        'review:inverse:r1': { findings: [finding] },
        'review:inverse:r2': { findings: [secondFinding] },
      },
      verify: {
        'verify:r1': verification([decision([source('inverse', 1, 0)], { severity: 'CRITICAL' })]),
        'verify:r2': verification([decision([source('inverse', 2, 0)], {
          action: 'reject', severity: 'CRITICAL',
          reason: 'The second mechanism is already required by an existing directive.',
          evidence: 'docs/spec.md:30 already requires this exact mechanism.',
        })], { closures: [closed('r1:fix:0')] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.inverseSpecDecisions).toHaveLength(2)
    expect(result.inverseSpecDecisions.map(d => d.action)).toEqual(['approve-fix', 'reject'])
  })

  test('a reader abort object aborts before verify or fix, in one call, with its whole object in the exception', async () => {
    const abort = { trigger: 'directive-conflict', reason: 'the diff contradicts a recorded directive' }
    const { result, calls } = await simulate({ reports: { 'review:inverse:r1': { abort, findings: [finding] } } })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('HARD-FLAG from review:inverse:r1')
    expect(result.exit).toContain(JSON.stringify(abort))
    expect(result.exit).toContain(finding.claim)
    expect(calls.filter(c => c.label === 'review:inverse:r1')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a verifier abort object aborts before fix, whatever its decisions say', async () => {
    const { result, calls } = await simulate({
      reports: oneReport,
      verify: { 'verify:r1': verification([decision([source('correctness')])], {
        abort: { trigger: 'directive-conflict', reason: 'the spec contradicts a recorded directive' },
      }) },
    })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('HARD-FLAG from verify:r1')
    expect(result.exit).toContain('the spec contradicts a recorded directive')
    expect(calls.filter(c => c.label === 'verify:r1')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('ordinary rejection and out-of-scope cleanup do not interrupt the root', async () => {
    const { result } = await simulate({
      reports: { 'review:rules:r1': { findings: [finding, finding] } },
      verify: { 'verify:r1': verification([
        decision([source('rules')], { action: 'reject', reason: 'The caller already propagates the error.', evidence: 'src/caller.js:30 returns the error.' }),
        decision([source('rules', 1, 1)], { action: 'cleanup', correction: 'Record the unrelated existing violation in TODO.md.' }),
      ]) },
    })
    expect(result.complete).toBe(true)
    expect(result.exceptions).toEqual([])
    expect(result.cleanup).toHaveLength(1)
    expect(result.counts.rejected).toBe(1)
  })

  test('critical adjacent cleanup retains its receipts without entering the current fix list', async () => {
    const cleanup = decision([source('rules', 1, 1)], {
      action: 'cleanup', severity: 'CRITICAL',
      reason: 'An existing violation is outside this unit’s repair scope.',
      evidence: 'src/legacy.js:20 violates docs/rules.md:6; the legacy helper predates this change.',
      authority: 'docs/rules.md:6: "Propagate errors to the caller."',
      correction: 'Record legacy-helper-error in local untracked TODO.md and schedule its correction promptly.',
    })
    const { result, calls } = await simulate({
      reports: { 'review:rules:r1': { findings: [finding, { ...finding, file: 'src/legacy.js' }] } },
      verify: {
        'verify:r1': verification([decision([source('rules')], { severity: 'CRITICAL' }), cleanup]),
        'verify:r2': verification([], { closures: [closed()] }),
      },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    expect(result.complete).toBe(true)
    expect(result.counts.approved).toBe(1)
    expect(result.cleanup).toEqual([cleanup])
    expect(result.cleanup[0].severity).toBe('CRITICAL')
    expect(calls.find(c => c.phase === 'Fix').prompt).not.toContain('legacy-helper-error')
    expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
  })

  test('cleanup handoff survives an incomplete run that needs a decision', async () => {
    const cleanup = decision([source('rules')], { action: 'cleanup', severity: 'CRITICAL' })
    const { result, calls } = await simulate({
      reports: { 'review:rules:r1': { findings: [finding] } },
      verify: { 'verify:r1': verification([cleanup], {
        issues: [{ kind: 'needs-decision', detail: 'Choose the required retention policy.' }],
      }) },
    })
    expect(result.complete).toBe(false)
    expect(result.cleanup).toEqual([cleanup])
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  for (const kind of ['rejected', 'blocked']) {
    test(`fixer ${kind} returns the approval and counterevidence to the root`, async () => {
      const { result, calls } = await simulate({
        reports: oneReport, verify: approveOne,
        fixes: { 'fix:r1': fixed([disposition('r1:fix:0', kind)], { touched: [] }) },
      })
      expect(result.complete).toBe(false)
      expect(result.exceptions[0].kind).toBe('fixer-disagreement')
      expect(result.exceptions[0].approved.authority).toContain('Return the error')
      expect(result.exceptions[0].response.disposition).toBe(kind)
      expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
    })
  }

  for (const answers of [[], [disposition('unknown')], [disposition(), disposition()]]) {
    test(`invalid fixer answers preserve unverified work: ${JSON.stringify(answers)}`, async () => {
      const { result } = await simulate({ reports: oneReport, verify: approveOne, fixes: { 'fix:r1': fixed(answers) } })
      expect(result.complete).toBe(false)
      expect(result.unverified).toEqual(['r1:fix:0'])
      expect(result.treeUnreviewed).toBe(true)
    })
  }

  test('a missing required adversary stops verification and fixing', async () => {
    const { result, calls } = await simulate({ fail: { 'review:alternatives:r1': 'provider unavailable' } })
    expect(result.complete).toBe(false)
    expect(calls.some(c => ['Verify', 'Fix'].includes(c.phase))).toBe(false)
  })

  test('a reader failure still awaits the other readers before returning control', async () => {
    const entered = Promise.withResolvers(), release = Promise.withResolvers()
    let finished = false
    const execution = simulate({
      fail: { 'review:alternatives:r1': 'reader failed' },
      beforeRead: async opts => {
        if (opts.label === 'review:quality:r1') {
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
    expect(result.complete).toBe(false)
    expect(result.treeUnreviewed).toBe(true)
  })

  test('an abort with an empty reason is retried with the failure named and then thrown', async () => {
    const { result, calls, logs } = await simulate({
      reports: { 'review:inverse:r1': { abort: { trigger: 'directive-conflict', reason: ' ' } } },
    })
    expect(result.complete).toBe(false)
    expect(calls.filter(c => c.label === 'review:inverse:r1')).toHaveLength(3)
    expect(calls.filter(c => c.label === 'review:inverse:r1')[1].prompt).toContain('HOW YOUR PREVIOUS ATTEMPT FAILED, plainly: abort.trigger is set but abort.reason is empty')
    expect(result.exit).toContain('FAIL-FAST: review:inverse:r1 returned no complete result after 3 attempts: abort.trigger is set but abort.reason is empty')
    expect(logs.filter(line => line.startsWith('incomplete result from review:inverse:r1'))).toHaveLength(3)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('an implementer abort object with an unchanged tree rejects in one call, not a completeness retry', async () => {
    const calls = []
    const run = simulate({
      implementation: implemented({ snapshotSha: BASE, proofPassed: false,
        abort: { trigger: 'directive-conflict', reason: 'the requested change contradicts a recorded scope directive.' } }),
      calls,
    })
    await expect(run).rejects.toThrow('HARD-FLAG from impl')
    await expect(run).rejects.toThrow('the requested change contradicts a recorded scope directive')
    await expect(run).rejects.not.toThrow('FAIL-FAST')
    expect(calls.filter(c => c.label === 'impl')).toHaveLength(1)
  })

  test('an empty quality findings list with its coverage is a complete result', async () => {
    const { result, calls } = await simulate({ reports: { 'review:quality:r1': { findings: [] } } })
    expect(result.complete).toBe(true)
    expect(calls.filter(c => c.label === 'review:quality:r1')).toHaveLength(1)
  })

  test('distinct defects in one file remain separate, and partial disagreement preserves unverified fixes', async () => {
    const { result } = await simulate({
      reports: { 'review:correctness:r1': { findings: [finding, { ...finding, claim: 'The success response omits its identifier.' }] } },
      verify: { 'verify:r1': verification([
        decision([source('correctness')]),
        decision([source('correctness', 1, 1)], { correction: 'Restore the required success identifier.' }),
      ]) },
      fixes: { 'fix:r1': fixed([disposition(), disposition('r1:fix:1', 'blocked')]) },
    })
    expect(result.counts.approved).toBe(2)
    expect(result.unverified).toEqual(['r1:fix:0'])
    expect(result.exceptions[0].approved.key).toBe('r1:fix:1')
    expect(result.treeUnreviewed).toBe(true)
    expect(result.complete).toBe(false)
  })

  test('fixer stage failure after possible writes is explicitly unreviewed', async () => {
    const { result } = await simulate({
      reports: oneReport, verify: approveOne, fail: { 'fix:r1': 'writer interrupted' },
    })
    expect(result.unverified).toEqual(['r1:fix:0'])
    expect(result.treeUnreviewed).toBe(true)
    expect(result.complete).toBe(false)
  })

  test('missing or unresolved independent closure is not a clean second round', async () => {
    for (const closures of [[], [{ ...closed(), verdict: 'unresolved' }]]) {
      const { result, calls } = await simulate({
        reports: oneReport,
        verify: { ...approveOne, 'verify:r2': verification([], { closures }) },
        fixes: { 'fix:r1': fixed([disposition()]) },
      })
      expect(result.complete).toBe(false)
      expect(result.unverified).toEqual(['r1:fix:0'])
      expect(calls.filter(c => c.agentType === 'fixer')).toHaveLength(1)
    }
  })

  test('a reader failure after fixing retains the unverified closure', async () => {
    const { result } = await simulate({
      reports: oneReport, verify: approveOne, fixes: { 'fix:r1': fixed([disposition()]) },
      fail: { 'review:quality:r2': 'reader failed after writes' },
    })
    expect(result.unverified).toEqual(['r1:fix:0'])
    expect(result.treeUnreviewed).toBe(true)
    expect(result.complete).toBe(false)
  })

  test('budget exhaustion still verifies the final fix and processes its roast', async () => {
    const reports = {}, verify = {}, fixes = {}
    for (let round = 1; round <= 4; round++) {
      reports[`review:correctness:r${round}`] = { findings: [finding] }
      verify[`verify:r${round}`] = verification([decision([source('correctness', round)])], {
        closures: round > 1 ? [closed(`r${round - 1}:fix:0`)] : [],
      })
      fixes[`fix:r${round}`] = fixed([disposition(`r${round}:fix:0`)])
    }
    const { result } = await simulate({ reports, verify, fixes })
    expect(result.complete).toBe(false)
    expect(result.unverified).toEqual([])
    expect(result.treeUnreviewed).toBe(false)
    expect(result.roastComplete).toBe(true)
    expect(result.exit).toContain('budget spent')
  })

  test('proof failure and proof-only edits cannot claim completion', async () => {
    for (const response of [fixed([], { proofPassed: false }), fixed([], { touched: ['src/example.js'] })]) {
      const { result } = await simulate({ fixes: { 'fix:r1': response } })
      expect(result.complete).toBe(false)
      expect(result.exceptions).not.toHaveLength(0)
    }
  })

  test('input isolation holds across rounds, with no findings history in detection prompts', async () => {
    const { calls } = await simulate({
      reports: oneReport,
      verify: { ...approveOne, 'verify:r2': verification([], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) },
    })
    const quality = calls.filter(c => c.agentType === 'quality')
    expect(quality).toHaveLength(2)
    expect(quality[0].prompt).toContain(INITIAL)
    expect(quality[1].prompt).toContain(fixedSha(1))
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
    expect(spec).toContain('return a verdict PER criterion')
    for (const type of ['reviewer-inverse-spec', 'project-rule-reader']) {
      const prompt = calls.find(c => c.agentType === type).prompt
      expect(prompt).not.toContain('return a verdict PER criterion')
      expect(prompt).toContain('docs/<the-spec>.md')
    }
    expect(calls.find(c => c.agentType === 'cold-alternatives').prompt).not.toContain('SPEC')
    expect(calls.find(c => c.label === 'verify:r2').prompt).toContain('PENDING FIXES')
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
  test('the finding schemas enum-lock kind to exactly band-aid and longer-route', async () => {
    const { calls } = await simulate()
    for (const call of calls.filter(c => c.phase === 'Review' || c.agentType === 'roaster')) {
      expect(call.schema.properties.findings.items.properties.kind).toEqual({ enum: ['band-aid', 'longer-route'] })
      expect(call.schema.properties.findings.items.required).toEqual(['file', 'claim', 'severity', 'lane', 'receipts',
        ...(call.agentType === 'project-rule-reader' ? ['scope'] : [])])
      expect(call.schema.properties.findings.items.properties.receipts.minItems).toBe(1)
    }
  })

  test('a kind-bearing source finding is set to CRITICAL at intake, for readers and roasts alike', async () => {
    const { severity, ...unmarked } = bandAid
    const reader = await simulate({ reports: report('review:cleanliness:r1', [{ ...bandAid, severity: 'must-fix' }]),
      verify: { 'verify:r1': verification([rejectShape([source('cleanliness')])]) } })
    expect(reader.logs).toContain('Project-benefit finding from cleanliness with kind band-aid set to severity CRITICAL')
    handedTo(reader.calls, 'verify:r1', [{ ...bandAid, id: source('cleanliness'), seat: 'cleanliness', snapshotSha: INITIAL }])
    const roast = await simulate({ reports: { ...oneReport, ...report('roast:r1', [{ ...unmarked, kind: 'longer-route' }]) },
      verify: { ...approveOne, 'verify:r2': verification([rejectShape([source('roaster')])], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) } })
    expect(roast.logs).toContain('Project-benefit finding from roaster with kind longer-route set to severity CRITICAL')
    handedTo(roast.calls, 'verify:r2', [{ ...unmarked, kind: 'longer-route', severity: 'CRITICAL', id: source('roaster'), seat: 'roaster', snapshotSha: INITIAL }])
    const plain = await simulate({ reports: oneReport, verify: { ...approveOne, 'verify:r2': verification([], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) } })
    handedTo(plain.calls, 'verify:r1', [{ ...finding, id: source('correctness'), seat: 'correctness', snapshotSha: INITIAL }])
    expect([plain.result.complete, plain.logs]).toEqual([true, []])
  })

  test('a decision on a kind-bearing finding throws on a non-CRITICAL severity, cleanup, record or an empty authority', async () => {
    for (const [fields, message] of [
      [{ severity: 'must-fix' }, 'Project-benefit finding must keep CRITICAL severity'],
      [{ action: 'cleanup', correction: 'Record it.' }, 'cannot be dispositioned as cleanup or record'],
      [{ action: 'record', correction: 'Record it.' }, 'cannot be dispositioned as cleanup or record'],
      [{ action: 'reject', authority: ' ' }, 'Missing project-benefit authority'],
    ]) {
      const { result, calls } = await simulate({ reports: report('review:quality:r1', [bandAid]),
        verify: { 'verify:r1': verification([benefit([source('quality')], fields)]) } })
      expect(result.exit).toContain(message)
      expect(calls.some(c => c.phase === 'Fix')).toBe(false)
    }
  })

  test('projectBenefitDecisions carries every kind-bearing decision with its sources in round order; a finding without kind still routes to cleanup', async () => {
    const longer = { ...bandAid, kind: 'longer-route', file: 'src/route.js', claim: 'The diff took the longer route.' }
    const cleanup = decision([source('rules')], { action: 'cleanup', severity: 'CRITICAL', correction: 'Record the existing guard in TODO.md.' })
    const { result } = await simulate({
      reports: { ...report('review:inverse:r1', [bandAid]), ...report('review:alternatives:r1', [longer]), ...report('review:alternatives:r2', [longer]),
        ...report('review:correctness:r1', [{ ...finding, file: longer.file, claim: longer.claim }]),
        ...report('review:rules:r1', [{ ...finding, file: 'src/legacy.js', severity: 'CRITICAL' }]) },
      verify: { 'verify:r1': verification([benefit([source('inverse')]), rejectShape([source('alternatives'), source('correctness')]), cleanup]),
        'verify:r2': verification([benefit([source('alternatives', 2)], { action: 'needs-decision', correction: 'Ask whether the shorter route is the required shape.' })], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) } })
    expect([result.complete, result.cleanup, result.inverseSpecDecisions.length]).toEqual([false, [cleanup], 1])
    expect(result.projectBenefitDecisions.map(d => [d.round, d.decision.action])).toEqual([[1, 'approve-fix'], [1, 'reject'], [2, 'needs-decision']])
    expect(result.projectBenefitDecisions[0].findings).toEqual([{ id: source('inverse'), seat: 'inverse', kind: 'band-aid', file: bandAid.file, claim: bandAid.claim }])
    expect(result.projectBenefitDecisions[1].findings).toEqual([{ id: source('alternatives'), seat: 'alternatives', kind: 'longer-route', file: longer.file, claim: longer.claim }])
  })

  test("a cold seat's kind-bearing finding on a mechanism the record is silent about reaches the root as needs-decision", async () => {
    const silent = benefit([source('quality')], { action: 'needs-decision', authority: 'The recorded words hold nothing about the retry wrapper.',
      correction: 'Ask whether the retry wrapper is a shape to keep.' })
    const { result, calls } = await simulate({ reports: report('review:quality:r1', [bandAid]), verify: { 'verify:r1': verification([silent]) } })
    expect([result.complete, result.exit, result.exceptions]).toEqual([false, 'verification needs root resolution', [silent]])
    expect(result.projectBenefitDecisions).toEqual([{ decision: silent, round: 1,
      findings: [{ id: source('quality'), seat: 'quality', kind: 'band-aid', file: bandAid.file, claim: bandAid.claim }] }])
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('an implementer sense-check flag aborts before review with its reason preserved', async () => {
    const calls = []
    const abort = { trigger: 'sense-check', reason: 'the request extends the retry wrapper, which the recorded words describe as deleted and rewritten as a direct call.' }
    const run = simulate({ implementation: implemented({ abort, snapshotSha: BASE, proofPassed: false,
      senseCheck: { passed: false, recordSilent: false, note: 'the retry wrapper' } }), calls })
    await expect(run).rejects.toThrow('HARD-FLAG from impl')
    await expect(run).rejects.toThrow('"trigger":"sense-check"')
    await expect(run).rejects.toThrow('the recorded words describe as deleted and rewritten')
    expect(calls.map(c => c.label)).toEqual(['impl'])
  })

  test('a fixer sense-check flag in a valid FIX object aborts the loop with its structured result preserved', async () => {
    const abort = { trigger: 'sense-check', reason: 'the approved correction patches the compatibility shim the recorded words describe as deleted.' }
    const { result, calls } = await simulate({ reports: report('review:correctness:r1', [finding, { ...finding, claim: 'A second defect.' }]),
      verify: { 'verify:r1': verification([decision([source('correctness')]), decision([source('correctness', 1, 1)])]) },
      fixes: { 'fix:r1': fixed([disposition(), disposition('r1:fix:1', 'blocked')], { abort }) } })
    expect([result.complete, result.exit]).toEqual([false, expect.stringContaining('HARD-FLAG from fix:r1')])
    expect(result.exit).toContain(abort.reason)
    expect(result.exit).toContain('"key":"r1:fix:1","disposition":"blocked"')
    expect([result.unverified, result.treeUnreviewed]).toEqual([['r1:fix:0', 'r1:fix:1'], true])
    expect(calls.filter(c => c.phase === 'Verify')).toHaveLength(1)
  })

  test('the nine review seats carry the project-benefit judgment scoped to this diff', async () => {
    const briefed = ['reviewer-correctness', 'reviewer-cleanliness', 'reviewer-spec-compliance', 'duplicate-checker', 'reviewer-inverse-spec', 'project-rule-reader']
    const shared = ['helps the project, not only', "severity CRITICAL whatever this seat's scale says for its other findings", "kind marks a choice made in this unit's own diff"]
    const quoted = ['band-aid, a repair of a mechanism the recorded words do not call for', 'longer-route, a longer implementation where the recorded words already describe a simpler one', 'Quote the recorded words beside the finding']
    const shaped = ['Flag by shape', 'Attach no quotes; the finding verifier attaches the recorded words']
    for (const name of [...briefed, 'quality', 'cold-alternatives', 'roaster']) {
      const text = await template(name)
      for (const phrase of [...shared, ...(briefed.includes(name) ? quoted : shaped)]) expect(text).toContain(phrase)
      if (!briefed.includes(name)) expect(text).not.toContain('directive record')
    }
    expect(await template('project-rule-reader')).toContain('a band-aid that already existed beside the diff is reported without kind, so the cleanup lane stays available')
  })

  test('the coder and verifier templates, law 10 and the shared authority constant state the two triggers and the kind rules', async () => {
    for (const [name, phrases] of [
      ['implementer', ['Sense check before any edit: read the private directive record and the spec and ask two questions.', 'A record that says nothing about the mechanism rules nothing out: the check passes and senseCheck records recordSilent true.',
        'Hard-flag and stop on either of two triggers, with one abort field and one disposition', "continues only on the human's verbatim decision quoted in the private record"]],
      ['fixer', ['Bounded sense check before your first write, on every approved correction', 'itself a band-aid on a mechanism the recorded words do not call for, where the record describes deletion or a rewrite',
        "no agent's justification and no root statement substitutes for it", "You do not repeat the implementer's request-level sense check"]],
      ['finding-verifier', ['is CRITICAL, and neither cleanup nor record is available for it', "supply the quote yourself for a cold seat's finding (quality, cold alternatives, roaster)",
        'Where the record holds no words about the mechanism, state that silence in plain words in the authority field', 'Approve-fix only for the deletion or rewrite the record describes']],
    ]) { const text = await template(name); for (const phrase of phrases) expect(text).toContain(phrase) }
    const flatSkill = flat(skill)
    expect(flatSkill).toContain('10. **HARD-FLAG SEMANTICS.** A hard flag (agent stops, script aborts) has exactly two triggers.')
    expect(flatSkill).toContain('**Two triggers, one field, one disposition**')
    for (const phrase of ['exactly one trigger', 'One trigger, one field', 'one trigger only', 'single abort condition']) expect(flatSkill).not.toContain(phrase)
    const { calls } = await simulate()
    for (const type of ['implementer', 'fixer', 'finding-verifier', 'reviewer-inverse-spec']) {
      expect(flat(calls.find(c => c.agentType === type).prompt)).toContain('has TWO triggers, one abort field, one disposition. First:')
      expect(calls.find(c => c.agentType === type).prompt).toContain('Second, WRITING SEATS ONLY: a failed sense')
    }
    for (const type of ['quality', 'cold-alternatives', 'roaster']) expect(calls.find(c => c.agentType === type).prompt).not.toContain('sense check')
    for (const name of ['directive-authority.md', 'workflow-finding-verification.md']) expect(await Bun.file(new URL(`../docs/${name}`, import.meta.url)).text()).toContain('](coder-sense-check-and-project-benefit.md)')
  })
})

// Field names every template must name (the gap-finder names none: the caller's schema defines its object).
const VERDICT_SEAT = ['abort', 'limitations', 'coverage', 'findings', 'verdicts']
const WRITER = ['abort', 'limitations', 'startSha', 'snapshotSha', 'clean', 'proofPassed', 'commits', 'files', 'checks', 'git', 'specSuggestions']
const FIELDS = {
  implementer: [...WRITER, 'premises', 'senseCheck'], fixer: [...WRITER, 'premises', 'dispositions', 'touched'],
  'finding-verifier': ['abort', 'limitations', 'snapshotSha', 'clean', 'git', 'checks', 'writerScope', 'decisions', 'issues', 'closures', 'specSuggestions'],
  roaster: ['limitations', 'coverage', 'findings', 'snapshotSha'], quality: ['limitations', 'coverage', 'findings'],
  'reviewer-correctness': VERDICT_SEAT, 'reviewer-cleanliness': VERDICT_SEAT, 'reviewer-spec-compliance': VERDICT_SEAT, 'duplicate-checker': VERDICT_SEAT,
  'reviewer-inverse-spec': ['abort', 'limitations', 'coverage', 'findings', 'authorizations'],
  'project-rule-reader': ['abort', 'limitations', 'coverage', 'findings', 'ruleSources', 'scope'],
  'cold-alternatives': ['limitations', 'coverage', 'findings', 'currentShapeRight', 'candidates'], 'gap-finder': [],
}
const BRIEFED = ['implementer', 'fixer', 'finding-verifier', 'reviewer-correctness', 'reviewer-cleanliness', 'reviewer-spec-compliance', 'duplicate-checker', 'reviewer-inverse-spec', 'project-rule-reader']
const retried = (calls, label) => calls.filter(c => c.label === label)
const FAILED = 'HOW YOUR PREVIOUS ATTEMPT FAILED, plainly: '

describe('structured stage output', () => {
  test('no stage schema declares a prose field, every root is closed, and only briefed stages declare abort', async () => {
    const { calls } = await simulate()
    const coldCalls = []
    await preRun(async (prompt, opts) => { coldCalls.push({ prompt, ...opts }); return coldObject(opts.label) })
    const stages = [...calls, ...coldCalls]
    expect(stages.every(c => c.schema)).toBe(true)
    for (const { schema, agentType, label } of stages) {
      const briefed = BRIEFED.includes(agentType)
      expect([label, schema.properties.report, schema.additionalProperties, schema.required.includes('abort'), 'abort' in schema.properties])
        .toEqual([label, undefined, false, briefed, briefed])
      if (briefed) expect(schema.properties.abort.properties.trigger).toEqual({ enum: ['none', 'directive-conflict', 'sense-check'] })
    }
    const seats = calls.filter(c => c.label.endsWith(':r1') && (c.phase === 'Review' || c.agentType === 'roaster'))
    expect(new Set(seats.map(c => c.schema)).size).toBe(9)
    for (const seat of seats) expect(seat.schema.properties.coverage.items.required).toEqual(['what', 'checked', 'how'])
    expect(calls.find(c => c.label === 'impl').schema.properties.checks.items.properties.output).toEqual({ type: 'string', maxLength: 6000 })
    const [implSchema, fixSchema] = ['implementer', 'fixer'].map(type => calls.find(c => c.agentType === type).schema)
    expect(fixSchema.required).toContain('premises')
    expect(fixSchema.properties.premises).toEqual(implSchema.properties.premises)
    const verify = calls.find(c => c.phase === 'Verify').schema.properties
    for (const field of ['writerScope', 'decisions', 'issues', 'closures']) expect([field, verify[field].items.additionalProperties]).toEqual([field, false])
  })

  test('a missing criteriaCount throws before any agent runs, in the main run and the pre-run', async () => {
    const calls = []
    await expect(simulate({ args: { baseSha: BASE }, calls })).rejects.toThrow('args.criteriaCount must be an integer of at least 1')
    await expect(simulate({ args: { baseSha: BASE, criteriaCount: 0 }, calls })).rejects.toThrow('args.criteriaCount')
    await expect(preRun(async (prompt, opts) => { calls.push(opts); return coldObject(opts.label) }, {})).rejects.toThrow('args.criteriaCount')
    expect(calls).toEqual([])
  })

  test('a missing verdict is retried with the count and the returned criteria named, then thrown; a stale count is the named cause', async () => {
    const mismatch = 'expected exactly one verdict per criterion 1..2 (args.criteriaCount), got criteria [2]'
    const { result, calls } = await simulate({ reports: { 'review:correctness:r1': { verdicts: verdicts().slice(1) } } })
    expect([result.complete, retried(calls, 'review:correctness:r1').length]).toEqual([false, 3])
    expect(retried(calls, 'review:correctness:r1')[2].prompt).toContain(FAILED + mismatch)
    expect(result.exit).toContain('FAIL-FAST: review:correctness:r1 returned no complete result after 3 attempts: ' + mismatch)
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    const stale = await simulate({ args: { baseSha: BASE, criteriaCount: 3 } })
    expect(stale.result.exit).toContain('expected exactly one verdict per criterion 1..3 (args.criteriaCount), got criteria [1,2]')
  })

  for (const [name, seat, fields, message] of [
    ['a verdict without a receipt', 'spec', { verdicts: [{ ...verdicts()[0], receipts: [] }, verdicts()[1]] }, 'verdict without a receipt'],
    ['a finding without a receipt', 'quality', { findings: [{ ...finding, receipts: [] }] }, 'finding without a receipt'],
    ['a finding without a lane', 'rules', { findings: [{ ...finding, lane: undefined }] }, 'finding without a lane'],
    ['a coverage entry unchecked without a limitation', 'quality', { coverage: [{ what: 'the integration suite', checked: false, how: 'no database' }], limitations: [] }, 'coverage entry not checked and no limitation declared: the integration suite'],
    ['empty coverage', 'alternatives', { coverage: [] }, 'coverage is empty'],
    ['an empty authorizations list', 'inverse', { authorizations: [] }, 'authorizations is empty'],
    ['an alternatives seat with no candidate, no finding and currentShapeRight false', 'alternatives', { currentShapeRight: false }, 'no candidate, no finding and currentShapeRight false'],
  ]) {
    test(`${name} is retried and then thrown`, async () => {
      const { result, calls } = await simulate({ reports: { [`review:${seat}:r1`]: fields } })
      expect([result.complete, retried(calls, `review:${seat}:r1`).length, calls.some(c => c.phase === 'Verify')]).toEqual([false, 3, false])
      expect(result.exit).toContain(message)
    })
  }

  test('an unchecked coverage entry with a limitation beside it is complete on the first attempt', async () => {
    const { result, calls } = await simulate({ reports: { 'review:quality:r1': {
      coverage: [{ what: 'the integration suite', checked: false, how: 'no database' }],
      limitations: [{ what: 'no database is reachable from this seat', effect: 'narrows' }],
    } } })
    expect([result.complete, retried(calls, 'review:quality:r1').length]).toEqual([true, 1])
  })

  for (const [name, fields, message] of [
    ['a commit but no files', { files: [] }, 'a new snapshot needs commits and files'],
    ['files but no commit', { commits: [] }, 'a new snapshot needs commits and files'],
    ['clean disagreeing with its status output', { git: { head: INITIAL, status: ' M src/example.js' } }, 'clean disagrees with git.status'],
    ['an empty git.head', { git: { head: '', status: '' } }, 'git.head "" differs from snapshotSha "' + INITIAL + '"'],
    ['git.head disagreeing with snapshotSha', { git: { head: BASE, status: '' } }, 'git.head "' + BASE + '" differs from snapshotSha "' + INITIAL + '"'],
    ['no check matching proofPassed', { checks: [check(false)] }, 'no check has passed equal to proofPassed'],
    ['an unchanged snapshot listing files', { snapshotSha: BASE, files: [{ path: 'src/example.js', bytes: 1, change: 'added' }] }, 'an unchanged snapshot lists commits or files'],
  ]) {
    test(`an implementer with ${name} is retried and then thrown`, async () => {
      const calls = []
      await expect(simulate({ implementation: implemented(fields), calls })).rejects.toThrow(message)
      expect([retried(calls, 'impl').length, calls.some(c => c.phase === 'Review')]).toEqual([3, false])
    })
  }

  test('a fixer with a commit but no files preserves the unverified work', async () => {
    const { result, calls } = await simulate({ reports: oneReport, verify: approveOne, fixes: { 'fix:r1': fixed([disposition()], { files: [] }) } })
    expect([result.complete, result.unverified, result.treeUnreviewed, retried(calls, 'fix:r1').length]).toEqual([false, ['r1:fix:0'], true, 3])
    expect(result.exit).toContain('a new snapshot needs commits and files')
  })

  test('a blocks limitation ends the run after its stage; a narrows limitation does not', async () => {
    const limitation = { what: 'the rule source for the changed directory is unavailable', effect: 'blocks' }
    const exit = 'stage limitation needs root resolution'
    const { result, calls } = await simulate({ reports: { ...oneReport, 'review:rules:r1': { limitations: [limitation] } } })
    expect([result.complete, result.exit, result.exceptions]).toEqual([false, exit, [{ kind: 'stage-limitation', label: 'review:rules:r1', ...limitation }]])
    for (const seat of readers) expect(retried(calls, `review:${seat}:r1`)).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    expect([result.rounds.length, result.rounds[0].reviewers.length, result.rounds[0].verifier, result.counts.sources]).toEqual([1, readers.length, null, 1])
    const verifier = await simulate({ verify: { 'verify:r1': verification([], { limitations: [limitation] }) } })
    expect([verifier.result.exit, verifier.result.exceptions.length, verifier.calls.some(c => c.phase === 'Fix')]).toEqual([exit, 1, false])
    const fixer = await simulate({ fixes: { 'fix:r1': fixed([], { limitations: [limitation] }) } })
    expect([fixer.result.exit, fixer.result.exceptions[0].label, fixer.calls.filter(c => c.phase === 'Verify').length]).toEqual([exit, 'fix:r1', 1])
    const implementer = await simulate({ implementation: implemented({ limitations: [limitation] }) })
    expect([implementer.result.complete, implementer.result.exit, implementer.result.exceptions]).toEqual([false, exit, [{ kind: 'stage-limitation', label: 'impl', ...limitation }]])
    expect(implementer.calls.map(c => c.label)).toEqual(['impl'])
    const narrowed = await simulate({ reports: { 'review:rules:r1': { limitations: [{ ...limitation, effect: 'narrows' }] } } })
    expect(narrowed.result.complete).toBe(true)
  })

  test('a writerScope entry reported out of scope or with a files mismatch ends the run as a verifier exception, without a retry', async () => {
    for (const fields of [{ ok: false }, { filesMatch: false }]) {
      const entry = { sha: INITIAL, ok: true, filesMatch: true, note: 'the commit also rewrote an unrelated helper', ...fields }
      const { result, calls } = await simulate({ verify: { 'verify:r1': verification([], { writerScope: [entry] }) } })
      expect([result.complete, result.exit, result.exceptions]).toEqual([false, 'verification needs root resolution', [{ kind: 'writer-scope', ...entry }]])
      expect([retried(calls, 'verify:r1').length, calls.some(c => c.phase === 'Fix')]).toEqual([1, false])
    }
    const { result } = await simulate({ verify: { 'verify:r1': verification([], { writerScope: [{ sha: INITIAL, ok: true, filesMatch: true, note: '' }] }) } })
    expect([result.complete, result.exceptions]).toEqual([true, []])
  })

  test('the finding verifier needs git.head equal to snapshotSha and one writerScope entry per writer commit, and the round writer object is handed over', async () => {
    const differs = await simulate({ verify: { 'verify:r1': verification([], { git: { head: BASE, status: '' } }) } })
    expect([differs.result.exit.includes('git.head "' + BASE + '" differs from snapshotSha "' + INITIAL + '"'), retried(differs.calls, 'verify:r1').length]).toEqual([true, 3])
    const scope = await simulate({ verify: { 'verify:r1': verification([], { writerScope: [] }) } })
    expect(scope.result.exit).toContain('Missing writer commit in writerScope')
    const { calls } = await simulate({ reports: oneReport, verify: { ...approveOne, 'verify:r2': verification([], { closures: [closed()] }) },
      fixes: { 'fix:r1': fixed([disposition()]) } })
    const implObject = JSON.stringify(implemented())
    expect(calls.find(c => c.label === 'verify:r1').prompt).toContain('WRITER OBJECTS (UNTRUSTED, this round):\n\n[' + implObject + ']')
    expect(calls.find(c => c.label === 'verify:r2').prompt).toContain('"subject":"apply the approved corrections"')
    expect(calls.find(c => c.label === 'verify:r2').prompt).not.toContain('"subject":"implement the change"')
    for (const type of ['reviewer-correctness', 'reviewer-cleanliness', 'duplicate-checker']) {
      expect(calls.find(c => c.agentType === type).prompt).toContain('UNTRUSTED implementer claims (its returned object):\n\n' + implObject)
    }
    for (const type of ['reviewer-spec-compliance', 'quality', 'reviewer-inverse-spec', 'project-rule-reader', 'cold-alternatives', 'roaster', 'fixer']) {
      expect(calls.find(c => c.agentType === type).prompt).not.toContain(implObject)
    }
  })

  test('the pre-run checks categories, gap receipts and one criteria entry per criterion', async () => {
    for (const [label, patch, message] of [
      ['spec:gaps', { categories: [] }, 'categories is empty'],
      ['spec:gaps', { gaps: [{ category: 'edge cases', what: 'the empty-list case', where: 'section 3', why: 'undefined', severity: 'must-fix', receipts: [] }] }, 'gap without a receipt: the empty-list case'],
      ['spec:soundness', { criteria: [{ criterion: 1, checkable: true, why: 'observable' }] }, 'expected exactly one criteria entry per criterion 1..2 (args.criteriaCount), got criteria [1]'],
    ]) {
      const calls = []
      const run = preRun(async (prompt, opts) => { calls.push(opts); return opts.label === label ? { ...coldObject(label), ...patch } : coldObject(opts.label) })
      await expect(run).rejects.toThrow(message)
      expect(calls.filter(c => c.label === label)).toHaveLength(3)
    }
    const [gaps, soundness] = await preRun(async (prompt, opts) => coldObject(opts.label))
    expect([gaps.categories.length, soundness.criteria.length]).toEqual([1, CRITERIA])
  })

  test('every template names its top-level fields, the added deliverable sentence, and the briefed ones the abort field', async () => {
    for (const [name, fields] of Object.entries(FIELDS)) {
      const text = await template(name)
      for (const field of fields) expect([name, field, new RegExp(`\\b${field}\\b`).test(text)]).toEqual([name, field, true])
      expect([name, text.includes('The returned object is the deliverable and carries everything you owe.'), text.includes('HARD-FLAG:'),
        /implementer'?s? report|your report|in the report|report goes|the report and/i.test(text)]).toEqual([name, true, false, false])
      expect([name, text.includes('abort.trigger') && text.includes('abort.reason'), text.includes('abort')])
        .toEqual([name, BRIEFED.includes(name), BRIEFED.includes(name)])
    }
    expect(await template('gap-finder')).toContain("The caller's schema defines the returned object.")
    const flatSkill = flat(skill)
    for (const phrase of ['HARD-FLAG:', 'FILES-ON-DISK', 'robust(', 'proven(', 'length floor']) expect([phrase, flatSkill.includes(phrase)]).toEqual([phrase, false])
    expect(flatSkill).toContain('stage(prompt, opts, complete)')
  })
})
