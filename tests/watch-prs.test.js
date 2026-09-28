import { afterEach, beforeEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Runs tools/watch-prs.py with python3 against the stand-in gh in tests/fixtures/watch-prs/bin,
// which answers from fixture JSON, so no call reaches GitHub.
const TOOL = fileURLToPath(new URL('../tools/watch-prs.py', import.meta.url))
const STAND_IN = fileURLToPath(new URL('./fixtures/watch-prs/bin', import.meta.url))
const GITHUB = fileURLToPath(new URL('./fixtures/watch-prs/github.json', import.meta.url))
const PYTHON = Bun.which('python3')
const PR = 'acme/widgets#12'
const PULL = 'repos/acme/widgets/pulls/12'

let directory
let runs = 0
beforeEach(async () => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url))
  await mkdir(cache, { recursive: true })
  directory = await mkdtemp(join(cache, 'watch-prs-test-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const fixture = async (change = (github) => github) => change(JSON.parse(await readFile(GITHUB, 'utf8')))
const pull = (state, merged) => ({ json: [{ number: 12, state, merged, head: { ref: 'feature/login', sha: 'bbb2' } }] })

// One run of the tool with a fresh call log. The state file is shared by every run of a test.
const watch = async (github, targets, { path = `${STAND_IN}:${process.env.PATH}` } = {}) => {
  runs += 1
  const fixtureFile = join(directory, `fixture-${runs}.json`)
  const log = join(directory, `calls-${runs}.jsonl`)
  await writeFile(fixtureFile, JSON.stringify(github))
  const child = Bun.spawn([PYTHON, TOOL, '--interval', '0', '--state', join(directory, 'state.json'), ...targets], {
    env: { ...process.env, PATH: path, GH_STANDIN_FIXTURE: fixtureFile, GH_STANDIN_LOG: log },
    stdout: 'pipe', stderr: 'pipe', timeout: 20000,
  })
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  const calls = (await Bun.file(log).exists())
    ? (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line)) : []
  const events = stdout.trim() === '' ? [] : stdout.trim().split('\n').map((line) => JSON.parse(line))
  return { status, stdout, stderr, events, calls, polled: calls.map((call) => call[3]).filter(Boolean) }
}

const EVENTS = [
  { kind: 'watching', prs: [PR] },
  { pr: PR, head: 'bbb2', kind: 'comment', author: 'reviewer',
    url: 'https://github.com/acme/widgets/pull/12#issuecomment-101', body: 'Please add a test for the empty password.' },
  { pr: PR, head: 'bbb2', kind: 'review', state: 'CHANGES_REQUESTED', author: 'reviewer',
    url: 'https://github.com/acme/widgets/pull/12#pullrequestreview-201', body: 'Two findings.', commit: 'aaa1' },
  { pr: PR, head: 'bbb2', kind: 'review-comment', author: 'reviewer',
    url: 'https://github.com/acme/widgets/pull/12#discussion_r301', path: 'src/login.py', line: 14, in_reply_to: null,
    body: 'This accepts an empty password.', commit: 'aaa1' },
  { pr: PR, head: 'bbb2', kind: 'review-comment', author: 'author',
    url: 'https://github.com/acme/widgets/pull/12#discussion_r302', path: 'src/login.py', line: 14, in_reply_to: 301,
    body: 'Fixed in bbb2.', commit: 'bbb2' },
  { pr: PR, head: 'bbb2', kind: 'review-comment', author: 'reviewer',
    url: 'https://github.com/acme/widgets/pull/12#discussion_r303', path: 'src/session.py', line: null,
    in_reply_to: null, body: 'This name is unclear.', commit: 'aaa1' },
  { pr: PR, head: 'bbb2', kind: 'check-failed', name: 'test', conclusion: 'failure',
    url: 'https://github.com/acme/widgets/runs/401', commit: 'bbb2' },
  { pr: PR, head: 'bbb2', kind: 'check-failed', name: 'deploy', conclusion: 'timed_out',
    url: 'https://github.com/acme/widgets/runs/404', commit: 'bbb2' },
  { pr: PR, kind: 'merged' },
  { kind: 'done' },
]

test('prints each event kind with its fields and skips a pending review and checks on an older commit', async () => {
  const run = await watch(await fixture(), [PR])
  expect(run.stderr).toBe('')
  expect(run.status).toBe(0)
  expect(run.events).toStrictEqual(EVENTS)
  expect(run.calls[0]).toStrictEqual(['auth', 'status'])
  expect(run.polled).not.toContain('repos/acme/widgets/commits/aaa1/check-runs')
  expect(run.polled.filter((path) => path === PULL)).toHaveLength(2)
})

test('a restart with the same state prints only what is new', async () => {
  expect((await watch(await fixture(), [PR])).events).toStrictEqual(EVENTS)
  const ids = ['ck401', 'ck404', 'ic101', 'rc301', 'rc302', 'rc303', 'rv201'].map((id) => `${PR}:${id}`)
  expect(JSON.parse(await readFile(join(directory, 'state.json'), 'utf8'))).toStrictEqual(ids)

  const again = await watch(await fixture(), [PR])
  expect(again.status).toBe(0)
  expect(again.events).toStrictEqual([{ kind: 'watching', prs: [PR] }, { pr: PR, kind: 'merged' }, { kind: 'done' }])

  const comment = { id: 102, user: { login: 'reviewer' }, html_url: 'https://github.com/acme/widgets/pull/12#issuecomment-102',
    body: 'One more thing.' }
  const newer = await watch(await fixture((github) => {
    github.api['repos/acme/widgets/issues/12/comments'][0].json[0].push(comment)
    return github
  }), [PR])
  expect(newer.events).toStrictEqual([
    { kind: 'watching', prs: [PR] },
    { pr: PR, head: 'bbb2', kind: 'comment', author: 'reviewer', url: comment.html_url, body: 'One more thing.' },
    { pr: PR, kind: 'merged' },
    { kind: 'done' },
  ])
})

test('a branch name watches the open pull request whose head it is', async () => {
  const run = await watch(await fixture(), ['acme/widgets@feature/login'])
  expect(run.status).toBe(0)
  expect(run.events).toStrictEqual(EVENTS)
  expect(run.polled[0]).toBe('repos/acme/widgets/pulls?state=open&per_page=100')
})

test('a branch with no open pull request ends in an error before anything is watched', async () => {
  const run = await watch(await fixture(), ['acme/widgets@feature/gone'])
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain('acme/widgets has no open pull request whose head is feature/gone')
  expect(run.polled).toStrictEqual(['repos/acme/widgets/pulls?state=open&per_page=100'])
})

test('a closed pull request ends the watch with closed, done and status zero', async () => {
  const run = await watch(await fixture((github) => {
    github.api[PULL] = [pull('closed', false)]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.slice(-2)).toStrictEqual([{ pr: PR, kind: 'closed' }, { kind: 'done' }])
  expect(run.polled.filter((path) => path === PULL)).toHaveLength(1)
})

test('a failing gh call prints poll-error and polling goes on', async () => {
  const run = await watch(await fixture((github) => {
    github.api[PULL] = [{ fail: 'HTTP 502: Bad Gateway' }, pull('open', false), pull('closed', false)]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.slice(0, 2)).toStrictEqual([
    { kind: 'watching', prs: [PR] },
    { pr: PR, kind: 'poll-error', stderr: 'HTTP 502: Bad Gateway' },
  ])
  expect(run.events.slice(2, -2)).toStrictEqual(EVENTS.slice(1, -2))
  expect(run.events.slice(-2)).toStrictEqual([{ pr: PR, kind: 'closed' }, { kind: 'done' }])
  expect(run.polled.filter((path) => path === PULL)).toHaveLength(3)
})

test('a missing login ends the tool with an error before it looks at any pull request', async () => {
  const run = await watch(await fixture((github) => ({ ...github, loggedIn: false })), [PR])
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain('gh is not logged in')
  expect(run.calls).toStrictEqual([['auth', 'status']])
})

test('a missing gh ends the tool with an error', async () => {
  const empty = join(directory, 'empty')
  await mkdir(empty)
  const run = await watch(await fixture(), [PR], { path: empty })
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain('gh, the GitHub CLI, is not installed')
})
