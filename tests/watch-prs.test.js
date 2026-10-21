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
const OPEN_PULLS = 'repos/acme/widgets/pulls?state=open'
const DATE = 1800000000

// Runs the main function of the watcher with a fake clock and a fake sleep. Each reading of the
// clock passes ten seconds, the time of a round, and a sleep passes the time it was given and
// prints that time as a wait. A sleep never blocks and the stand-in gh repeats the last answer of
// a list, so a fixture that never closes the pull request would send the tool around forever.
// Every round and every refusal takes a fresh answer, so the tool sleeps no more often than the
// fixture has answers, and a sleep beyond that fails the run: nothing is left that could end it.
const LOADER = [
  'import importlib.util, json, os, sys',
  'spec = importlib.util.spec_from_file_location("watch_prs", sys.argv[1])',
  'tool = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(tool)',
  'sys.argv = sys.argv[1:]',
  'with open(os.environ["GH_STANDIN_FIXTURE"]) as file:',
  '    answers = sum(len(list_) for list_ in json.load(file)["api"].values())',
  'now = sleeps = 0',
  'def clock():',
  '    global now',
  '    now += 10',
  '    return now',
  'def sleep(seconds):',
  '    global now, sleeps',
  '    sleeps += 1',
  '    if sleeps > answers:',
  '        sys.exit("the tool sleeps more often than the fixture has answers, so nothing can end the watch")',
  '    now += seconds',
  '    print(json.dumps({"wait": seconds}), flush=True)',
  'tool.main(clock, sleep)',
].join('\n')

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
// A reading of the rate limit, with the times in seconds after DATE.
const rateLimit = (date, used, remaining, reset) => ({
  date: DATE + date, json: [{ resources: { core: { limit: 5000, used, remaining, reset: DATE + reset } } }],
})

// One run of the tool with a fresh call log. The state file is shared by every run of a test.
const watch = async (github, targets, { path = `${STAND_IN}:${process.env.PATH}` } = {}) => {
  runs += 1
  const fixtureFile = join(directory, `fixture-${runs}.json`)
  const log = join(directory, `calls-${runs}.jsonl`)
  await writeFile(fixtureFile, JSON.stringify(github))
  const child = Bun.spawn([PYTHON, '-B', '-c', LOADER, TOOL, '--state', join(directory, 'state.json'), ...targets], {
    env: { ...process.env, PATH: path, GH_STANDIN_FIXTURE: fixtureFile, GH_STANDIN_LOG: log },
    stdout: 'pipe', stderr: 'pipe',
  })
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  const calls = (await Bun.file(log).exists())
    ? (await readFile(log, 'utf8')).trim().split('\n').map((line) => JSON.parse(line)) : []
  const lines = stdout.trim() === '' ? [] : stdout.trim().split('\n').map((line) => JSON.parse(line))
  const events = lines.filter((line) => !('wait' in line))
  const waits = lines.filter((line) => 'wait' in line).map((line) => line.wait)
  const polled = calls.filter((call) => call[0] === 'api').map((call) => call.at(-1))
  return { status, stdout, stderr, events, waits, calls, polled }
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
  { pr: PR, head: 'bbb2', kind: 'status-failed', name: 'ci/legacy', state: 'failure',
    url: 'https://ci.example.com/builds/501', commit: 'bbb2' },
  { pr: PR, head: 'bbb2', kind: 'status-failed', name: 'ci/deploy', state: 'error', url: null, commit: 'bbb2' },
  { pr: PR, kind: 'merged' },
  { kind: 'done' },
]

test('prints each event kind with its fields and skips a pending review, checks on an older commit and statuses that are not failed', async () => {
  const run = await watch(await fixture(), [PR])
  expect(run.stderr).toBe('')
  expect(run.status).toBe(0)
  expect(run.events).toStrictEqual(EVENTS)
  expect(run.calls[0]).toStrictEqual(['auth', 'status'])
  expect(run.polled.filter((path) => path.startsWith('repos/acme/widgets/commits/aaa1/'))).toStrictEqual([])
  expect(run.polled.filter((path) => path === PULL)).toHaveLength(2)
})

test('a restart with the same state prints only what is new', async () => {
  expect((await watch(await fixture(), [PR])).events).toStrictEqual(EVENTS)
  const ids = ['ck401', 'ck404', 'ic101', 'rc301', 'rc302', 'rc303', 'rv201', 'st501', 'st503']
    .map((id) => `${PR}:${id}`)
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

test('a comment, review and review comment of a deleted account show the author ghost', async () => {
  const run = await watch(await fixture((github) => {
    for (const path of ['issues/12/comments', 'pulls/12/reviews', 'pulls/12/comments']) {
      github.api[`repos/acme/widgets/${path}`][0].json[0][0].user = null
    }
    return github
  }), [PR])
  expect(run.stderr).toBe('')
  expect(run.status).toBe(0)
  expect(run.events.filter((event) => event.author).map((event) => [event.kind, event.author])).toStrictEqual([
    ['comment', 'ghost'], ['review', 'ghost'], ['review-comment', 'ghost'],
    ['review-comment', 'author'], ['review-comment', 'reviewer'],
  ])
})

test('a status that turns successful prints nothing and a failure with a new id prints again', async () => {
  const status = (id, state) => ({ json: [{ statuses: [
    { id, context: 'ci/legacy', state, target_url: `https://ci.example.com/builds/${id}` },
  ] }] })
  const run = await watch(await fixture((github) => {
    github.api[PULL] = [pull('open', false), pull('open', false), pull('closed', true)]
    github.api['repos/acme/widgets/commits/bbb2/status'] = [
      status(601, 'failure'), status(602, 'success'), status(603, 'failure'),
    ]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.filter((event) => event.kind === 'status-failed').map((event) => event.url)).toStrictEqual([
    'https://ci.example.com/builds/601', 'https://ci.example.com/builds/603',
  ])
})

test('a status in a state the watcher does not know prints nothing and the watch goes on', async () => {
  const status = (id, state) => ({ json: [{ statuses: [
    { id, context: 'ci/legacy', state, target_url: `https://ci.example.com/builds/${id}` },
  ] }] })
  const run = await watch(await fixture((github) => {
    github.api[PULL] = [pull('open', false), pull('open', false), pull('closed', true)]
    github.api['repos/acme/widgets/commits/bbb2/status'] = [
      status(701, 'queued'), status(702, 'failure'), status(702, 'failure'),
    ]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.filter((event) => event.kind === 'status-failed').map((event) => event.url)).toStrictEqual([
    'https://ci.example.com/builds/702',
  ])
})

test('a branch name watches the open pull request whose head it is', async () => {
  const run = await watch(await fixture(), ['acme/widgets@feature/login'])
  expect(run.status).toBe(0)
  expect(run.events).toStrictEqual(EVENTS)
  expect(run.polled[0]).toBe(`${OPEN_PULLS}&per_page=100&page=1`)
})

test('a branch with no open pull request ends in an error before anything is watched', async () => {
  const run = await watch(await fixture(), ['acme/widgets@feature/gone'])
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain('acme/widgets has no open pull request whose head is feature/gone')
  expect(run.polled).toStrictEqual([`${OPEN_PULLS}&per_page=100&page=1`])
})

test('a branch shared by open pull requests from different forks ends in an error before anything is watched', async () => {
  const run = await watch(await fixture((github) => {
    github.api[OPEN_PULLS][0].json[0].push(
      { number: 99, head: { ref: 'feature/login', sha: 'ddd4', repo: { full_name: 'someone/widgets' } } })
    return github
  }), ['acme/widgets@feature/login'])
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain(
    'acme/widgets has more than one open pull request whose head is feature/login: acme/widgets#12, acme/widgets#99')
  expect(run.polled).toStrictEqual([`${OPEN_PULLS}&per_page=100&page=1`])
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

test('a refused request waits as long as GitHub asks and is sent again', async () => {
  const run = await watch(await fixture((github) => {
    github.api[PULL] = [{ refuse: { retryAfter: 30 } }, { refuse: { date: DATE, reset: DATE + 45 } },
      { refuse: { status: 403 } }, pull('closed', false)]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.filter((event) => event.kind === 'refused')).toStrictEqual([
    { kind: 'refused', path: PULL, seconds: 30 },
    { kind: 'refused', path: PULL, seconds: 45 },
    { kind: 'refused', path: PULL, seconds: 60 },
  ])
  expect(run.waits).toStrictEqual([30, 45, 60])
  expect(run.events.slice(-2)).toStrictEqual([{ pr: PR, kind: 'closed' }, { kind: 'done' }])
})

test('a fixture that never ends the watch fails the run instead of sending the tool around forever', async () => {
  for (const answers of [[pull('open', false)], [{ refuse: { retryAfter: 30 } }]]) {
    const run = await watch(await fixture((github) => {
      github.api[PULL] = answers
      return github
    }), [PR])
    expect(run.status).not.toBe(0)
  }
})

// A round of the fixture sends 9 requests: the pull request and 8 pages of its lists.
test('the wait spreads the part of the requests left that matches the share of the watcher in the use of the login', async () => {
  const run = await watch(await fixture((github) => {
    github.api.rate_limit = [
      rateLimit(0, 1382, 3618, 3610),
      rateLimit(10, 1400, 3600, 3610),
      rateLimit(46, 1427, 3573, 3610),
      rateLimit(3620, 200, 4800, 7220),
    ]
    github.api[PULL] = [pull('open', false), pull('open', false), pull('open', false), pull('closed', false)]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.waits).toStrictEqual([
    // All 9 requests counted, and other use counted 9 more. The watcher takes half of the 3600
    // left, 200 rounds over the 3600 seconds left.
    18,
    // Every page was unchanged, so nothing counted, but the round is planned as if it had: 3564
    // left. Other use counted 27 more, 36 to the 18 requests of the watcher, so the watcher takes
    // a third of 3564, 132 rounds over the 3564 seconds left.
    27,
    // A new window: no use is observed in it yet, so the watcher takes all 4800 left, 533 rounds
    // and a third over the 3600 seconds left.
    6.75,
  ])
  expect(run.calls.filter((call) => call.includes('-H'))).toHaveLength(9 * 3)
})

test('a rate limit that cannot be read prints rate-limit-unreadable and waits as long as the failure has lasted', async () => {
  const run = await watch(await fixture((github) => {
    const failed = { fail: 'HTTP 502: Bad Gateway' }
    github.api.rate_limit = [rateLimit(0, 1364, 3636, 3610), failed, failed, failed, rateLimit(10, 1373, 3627, 3610)]
    github.api[PULL] = [pull('open', false), pull('open', false), pull('open', false), pull('open', false),
      pull('closed', false)]
    return github
  }), [PR])
  expect(run.status).toBe(0)
  expect(run.events.filter((event) => event.kind === 'rate-limit-unreadable'))
    .toStrictEqual(Array(3).fill({ kind: 'rate-limit-unreadable', stderr: 'HTTP 502: Bad Gateway' }))
  expect(run.events.slice(-2)).toStrictEqual([{ pr: PR, kind: 'closed' }, { kind: 'done' }])
  // The failure began at 10 seconds on the clock and was read again at 20 and at 40. The four
  // rounds since the last good reading cost 9 requests each, and only the first counted, so 3600
  // are planned to be left, one round every 9 of the 3600 seconds left.
  expect(run.waits).toStrictEqual([0, 10, 30, 9])
})

test('a rate limit that cannot be read at the start ends the tool with an error before it watches', async () => {
  const run = await watch(await fixture((github) => {
    github.api.rate_limit = [{ fail: 'HTTP 502: Bad Gateway' }]
    return github
  }), [PR])
  expect(run.status).not.toBe(0)
  expect(run.stdout).toBe('')
  expect(run.stderr).toContain('cannot read the rate limit of the gh login: HTTP 502: Bad Gateway')
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
