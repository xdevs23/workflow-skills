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

const prose = 'Evidence and coverage inspected against the current tree. '.repeat(12)
const readers = ['correctness', 'cleanliness', 'spec', 'dupes', 'quality', 'inverse', 'rules', 'alternatives']
const source = (seat, round = 1, index = 0) => `r${round}:${seat}:${index}`
const finding = { file: 'src/example.js', claim: 'The specified error is swallowed.', severity: 'must-fix', lane: 'fixer-actionable' }
const decision = (ids, fields = {}) => ({
  sourceIds: ids, action: 'approve-fix', severity: 'must-fix',
  reason: 'The implementation contradicts the required failure behavior.',
  evidence: 'src/example.js:12 catches and ignores this error.',
  authority: 'docs/spec.md:8: "Return the error to the caller."',
  correction: 'Return the specified error to the caller.',
  constraints: 'Do not change the success response.',
  acceptance: 'Exercise the failure path and assert the caller receives the error.',
  ...fields,
})
const verification = (decisions = [], fields = {}) => ({ report: prose, decisions, issues: [], closures: [], ...fields })
const fixed = (dispositions = [], fields = {}) => ({
  report: prose, touched: dispositions.length ? ['src/example.js'] : [], proofPassed: true,
  dispositions, ...fields,
})
const disposition = (key = 'r1:fix:0', kind = 'fixed') => ({ key, disposition: kind, reason: 'Checked the approved correction and its acceptance condition.' })
const closed = (key = 'r1:fix:0') => ({ key, verdict: 'closed', evidence: 'The failure-path test now observes the specified error.' })

const BASE = 'a'.repeat(40)
const INITIAL = 'b'.repeat(40)
const fixedSha = round => (round + 1).toString(16).padStart(40, '0')
async function simulate({ reports = {}, verify = {}, fixes = {}, fail = {}, implementation,
  beforeRead = async () => {}, beforeFix = async () => {}, beforeRoast = async () => {},
  args = { baseSha: BASE }, calls = [] } = {}) {
  const completed = new Set(), phases = [], starts = new Map()
  let currentSha = INITIAL
  let lastReviewedSha = null
  const agent = async (prompt, opts) => {
    calls.push({ prompt, ...opts })
    expect(opts.model).toBe('<explicit>')
    expect(opts.effort).toBe('high')
    if (fail[opts.label]) throw new Error(fail[opts.label])
    if (opts.label === 'impl') return implementation ?? {
      report: prose + '\nFILES-ON-DISK: src/example.js 120 bytes\nlisting: src/example.js',
      startSha: BASE, snapshotSha: INITIAL, clean: true, proofPassed: true,
    }
    if (opts.phase === 'Review') {
      await beforeRead(opts)
      completed.add(opts.label)
      return reports[opts.label] ?? { report: prose, findings: [] }
    }
    if (opts.phase === 'Verify') {
      const round = opts.label.slice('verify:r'.length)
      if (currentSha !== lastReviewedSha) {
        for (const seat of readers) expect(completed.has(`review:${seat}:r${round}`)).toBe(true)
        lastReviewedSha = currentSha
      }
      if (Number(round) > 1) expect(completed.has(`roast:r${Number(round) - 1}`)).toBe(true)
      return { snapshotSha: currentSha, clean: true, ...(verify[opts.label] ?? verification()) }
    }
    const round = Number(opts.label.slice(opts.label.indexOf(':r') + 2))
    if (opts.agentType === 'roaster') {
      const snapshotSha = starts.get(round) ?? currentSha
      await beforeRoast(opts)
      completed.add(opts.label)
      return { snapshotSha, ...(reports[opts.label] ?? { report: prose, findings: [] }) }
    }
    if (opts.agentType === 'fixer') {
      const startSha = currentSha
      starts.set(round, startSha)
      await beforeFix(opts)
      const response = fixes[opts.label] ?? fixed()
      const result = { startSha, snapshotSha: response.touched.length ? fixedSha(round) : startSha,
        clean: true, ...response }
      currentSha = result.snapshotSha
      completed.add(opts.label)
      return result
    }
    throw new Error(`Unexpected call: ${opts.label}`)
  }
  const result = await run(agent, name => phases.push(name), () => {}, args)
  return { result, calls, phases }
}
const oneReport = { 'review:correctness:r1': { report: prose, findings: [finding] } }
const approveOne = { 'verify:r1': verification([decision([source('correctness')])]) }

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
    expect(implementer).toContain('No extra gate beyond that timing')
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
    const cold = blocks.find(code => code.includes("name: 'spec-cold-review'"))
    expect(cold).toBeDefined()
    const coldCalls = []
    await new AsyncFunction('robust', 'phase', cold.replace('export const meta =', 'const meta ='))(
      async (prompt, opts) => { coldCalls.push({ prompt, ...opts }); return prose }, () => {},
    )
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
      reports: { ...oneReport, 'roast:r1': { report: prose, findings: [finding] } },
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
      reports: { ...oneReport, 'roast:r1': { report: prose, findings: [{ ...finding, claim: 'A separate required field is missing.' }] } },
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
        reports: { ...oneReport, ...(error === 'wrong snapshot' ? { 'roast:r1': { snapshotSha: BASE, report: prose, findings: [] } } : {}) },
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
      await expect(simulate({ implementation: {
        report: prose + '\nFILES-ON-DISK: source 100 bytes', startSha: BASE, snapshotSha: INITIAL,
        clean: true, proofPassed: true, ...fields,
      } })).rejects.toThrow('clean pinned snapshot')
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
      reports: { ...oneReport, 'review:alternatives:r1': { report: prose, findings: [finding] } },
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
        reports: { 'review:correctness:r1': { report: prose, findings: [finding, finding] } },
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

  test('report-only uncertainty is not lost when the findings list is empty', async () => {
    const { result, calls } = await simulate({
      verify: { 'verify:r1': verification([], { issues: [{ kind: 'root-action', detail: 'The authority document is unavailable.' }] }) },
    })
    expect(result.complete).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a suggested spec edit does not block implementation, normal reviews or proof', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:spec:r1': { report: prose, findings: [{
        file: 'docs/spec.md', claim: 'The optional example could explain the error response more clearly.',
        severity: 'nit', lane: 'orchestrator-only',
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
      reports: { 'review:inverse:r1': { report: prose, findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('inverse')], { severity: 'should-fix' })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding cannot be rejected at a downgraded severity either', async () => {
    const { result } = await simulate({
      reports: { 'review:inverse:r1': { report: prose, findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('inverse')], {
        action: 'reject', severity: 'nit', reason: 'Reads as a stylistic nit.', evidence: 'No behavior changed.',
      })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('a consolidated group with one inverse-spec source still requires CRITICAL severity', async () => {
    const { result } = await simulate({
      reports: { ...oneReport, 'review:inverse:r1': { report: prose, findings: [finding] } },
      verify: { 'verify:r1': verification([decision([source('correctness'), source('inverse')], { severity: 'must-fix' })]) },
    })
    expect(result.exit).toContain('Inverse-spec finding must keep CRITICAL severity')
  })

  test('an inverse-spec finding tagged CRITICAL can still be approved and fixed', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { report: prose, findings: [finding] } },
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
      reports: { 'review:inverse:r1': { report: prose, findings: [finding] } },
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
      reports: { 'review:inverse:r1': { report: prose, findings: [finding, { ...finding, file: 'src/other.js' }] } },
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
      reports: { ...oneReport, 'review:inverse:r1': { report: prose, findings: [finding] } },
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
        'review:inverse:r1': { report: prose, findings: [finding] },
        'review:inverse:r2': { report: prose, findings: [secondFinding] },
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

  test('a hard flag hidden inside a structured finding claim aborts before verify or fix', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { report: prose, findings: [{ ...finding, claim: 'HARD-FLAG: the diff contradicts a recorded directive' }] } },
    })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('HARD-FLAG')
    expect(result.exit).toContain('the diff contradicts a recorded directive')
    expect(result.exit).toContain('review:inverse:r1')
    expect(calls.filter(c => c.label === 'review:inverse:r1')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a hard flag hidden inside a verifier decision reason aborts before fix', async () => {
    const { result, calls } = await simulate({
      reports: oneReport,
      verify: { 'verify:r1': verification([decision([source('correctness')], {
        reason: 'HARD-FLAG: the spec contradicts a recorded directive',
      })]) },
    })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('HARD-FLAG')
    expect(result.exit).toContain('the spec contradicts a recorded directive')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('ordinary rejection and out-of-scope cleanup do not interrupt the root', async () => {
    const { result } = await simulate({
      reports: { 'review:rules:r1': { report: prose, findings: [finding, finding] } },
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
      reports: { 'review:rules:r1': { report: prose, findings: [finding, { ...finding, file: 'src/legacy.js' }] } },
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
      reports: { 'review:rules:r1': { report: prose, findings: [finding] } },
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

  test('a hard-flagged review cannot reach a fixer', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { report: prose + 'HARD-FLAG: conflicting authorities', findings: [] } },
    })
    expect(result.complete).toBe(false)
    expect(result.exit).toContain('HARD-FLAG')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('short hard flags bypass the prose retry floor', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { report: 'HARD-FLAG: authority conflict', findings: [] } },
    })
    expect(result.exit).toContain('HARD-FLAG')
    expect(calls.filter(c => c.label === 'review:inverse:r1')).toHaveLength(1)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a hard flag hidden in a finding claim with a sub-minimal, unrelated report is not retried', async () => {
    const { result, calls } = await simulate({
      reports: { 'review:inverse:r1': { report: 'Reviewed.', findings: [{ ...finding,
        claim: 'HARD-FLAG: the diff moves data outside the authorized boundary.' }] } },
    })
    expect(result.complete).toBe(false)
    expect(calls.filter(c => c.label === 'review:inverse:r1')).toHaveLength(1)
    expect(result.exit).toContain('HARD-FLAG')
    expect(result.exit).toContain('the diff moves data outside the authorized boundary')
    expect(calls.some(c => c.phase === 'Verify')).toBe(false)
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('a hard flag hidden in a verifier decision reason with a sub-minimal, unrelated report is not retried', async () => {
    const { result, calls } = await simulate({
      reports: oneReport,
      verify: { 'verify:r1': verification([decision([source('correctness')], {
        reason: 'HARD-FLAG: the correction contradicts a recorded scope directive.',
      })], { report: 'Checked.' }) },
    })
    expect(result.complete).toBe(false)
    expect(calls.filter(c => c.label === 'verify:r1')).toHaveLength(1)
    expect(result.exit).toContain('HARD-FLAG')
    expect(result.exit).toContain('the correction contradicts a recorded scope directive')
    expect(calls.some(c => c.phase === 'Fix')).toBe(false)
  })

  test('an implementer hard flag with a short, proof-less report rejects in one call, not a proof retry', async () => {
    const calls = []
    let error
    try {
      await simulate({
        implementation: { report: 'HARD-FLAG: the requested change contradicts a recorded scope directive.',
          startSha: BASE, snapshotSha: INITIAL, clean: true, proofPassed: true },
        calls,
      })
    } catch (e) { error = e }
    expect(error).toBeDefined()
    expect(error.message).toContain('HARD-FLAG')
    expect(error.message).toContain('the requested change contradicts a recorded scope directive')
    expect(error.message).not.toContain('DELIVERABLE PROOF')
    expect(calls.filter(c => c.label === 'impl')).toHaveLength(1)
  })

  test('a concise clean quality report is valid', async () => {
    const { result } = await simulate({
      reports: { 'review:quality:r1': { report: 'No findings.', findings: [] } },
    })
    expect(result.complete).toBe(true)
  })

  test('distinct defects in one file remain separate, and partial disagreement preserves unverified fixes', async () => {
    const { result } = await simulate({
      reports: { 'review:correctness:r1': { report: prose, findings: [finding, { ...finding, claim: 'The success response omits its identifier.' }] } },
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
      reports[`review:correctness:r${round}`] = { report: prose, findings: [finding] }
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
