import { afterEach, beforeEach, expect, test } from 'bun:test'
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Runs tools/pr-lines.py with python3 on fixture repositories. The counting tests draw with the
// stand-in resvg in tests/fixtures/pr-lines, which needs no fonts and writes the drawn elements as
// the picture. The rendering test runs the real resvg, from PR_LINES_RESVG or else from PATH, with
// the Mona Sans directory named in PR_LINES_FONTS, and is skipped when either is missing.
const TOOL = fileURLToPath(new URL('../tools/pr-lines.py', import.meta.url))
const STAND_IN = fileURLToPath(new URL('./fixtures/pr-lines/resvg', import.meta.url))
const PYTHON = Bun.which('python3')
const GIT_ENVIRONMENT = {
  ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
}
const NO_KIND = 'tests 0, assets 0, tooling 0'
const RESVG = process.env.PR_LINES_RESVG ?? Bun.which('resvg')
const FONTS = process.env.PR_LINES_FONTS

let directory
let repo
let fonts
beforeEach(async () => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url))
  await mkdir(cache, { recursive: true })
  directory = await mkdtemp(join(cache, 'pr-lines-test-'))
  repo = join(directory, 'repo')
  await mkdir(repo)
  git('init', '-q', '-b', 'main')
  fonts = join(directory, 'fonts')
  await mkdir(fonts)
  await writeFile(join(fonts, 'MonaSans-Regular.ttf'), 'font')
  await writeFile(join(fonts, 'MonaSans-SemiBold.otf'), 'font')
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

const git = (...args) => {
  const result = Bun.spawnSync(['git', '-C', repo, ...args], { env: GIT_ENVIRONMENT })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

const lines = (count, prefix = 'line') => Array.from({ length: count }, (_, number) => `${prefix} ${number}\n`).join('')

const commit = async (files = {}) => {
  for (const [name, content] of Object.entries(files)) {
    const path = join(repo, name)
    if (content === null) {
      await rm(path)
      continue
    }
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', 'change')
  return git('rev-parse', 'HEAD')
}

const prLines = async (base, head, { tool = TOOL, resvg = STAND_IN, fontDirectory = fonts, repository = repo,
  out = join(directory, 'lines.png'), env = {} } = {}) => {
  const child = Bun.spawn(
    [PYTHON, tool, base, head, '--out', out, '--repo', repository, '--resvg', resvg, '--fonts', fontDirectory],
    { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  return { status, stdout, stderr, out, textLine: stdout.trim().split('\n').at(-1) }
}

// Checks that the run wrote nothing and failed with one line of the problem, naming each of
// `named`, then a semicolon and what to do about it.
const expectRefusal = async (run, ...named) => {
  expect(run.status).toBe(1)
  expect(run.stdout).toBe('')
  expect(await Bun.file(run.out).exists()).toBe(false)
  const [, problem, nextStep] = run.stderr.match(/^pr-lines: (.+); ([^;\n]+)\n$/s) ?? []
  for (const name of named) expect(problem).toContain(name)
  expect(nextStep).toBeTruthy()
}

// The picture as the stand-in resvg wrote it: the svg element, every pill with the text in it,
// and every grid cell, which is a rect without a text.
const drawing = async out => {
  const drawn = (await readFile(out, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  const texts = drawn.filter(({ tag }) => tag === 'text')
  const rects = drawn.filter(({ tag }) => tag === 'rect')
  const holds = (rect, { x, y }) => rect.x <= x && x <= rect.x + rect.width && rect.y <= y && y <= rect.y + rect.height
  return {
    svg: drawn.find(({ tag }) => tag === 'svg'),
    pills: rects.flatMap(rect => texts.filter(text => holds(rect, text)).map(({ text }) => ({ ...rect, text }))),
    cells: rects.filter(rect => !texts.some(text => holds(rect, text))),
  }
}

// Checks that the grid has 100 cells, that every pill fits into the picture, and that each kind in
// `rows` has a row of its own with the value pill `value` and `share` cells in the fill of the row.
// Returns the value pill of each kind.
const expectPicture = async (out, rows) => {
  const { svg, pills, cells } = await drawing(out)
  expect(cells).toHaveLength(100)
  for (const pill of pills) expect(pill.x + pill.width).toBeLessThanOrEqual(svg.width)
  return Object.fromEntries(Object.entries(rows).map(([kind, { value, share }]) => {
    const name = pills.find(({ text }) => text === kind)
    const row = pills.filter(pill => pill.y === name.y && pill !== name)
    expect(row.map(({ text, fill }) => [text, fill])).toStrictEqual([[value, name.fill]])
    expect(cells.filter(({ fill }) => fill === name.fill)).toHaveLength(share)
    return [kind, row[0]]
  }))
}

test('counts every diff line once under the kind of its path and prints the section that shows the picture', async () => {
  const base = await commit({ 'src/app.py': lines(3), 'docs/guide.md': lines(2, 'guide'), 'notes.txt': 'n\n' })
  const head = await commit({
    'src/app.py': 'line 0\nchanged\nline 2\nnew 1\nnew 2\n',
    'docs/guide.md': null,
    'tests/test_app.py': lines(4, 'test'),
    'flake.nix': '{ }\n',
    'notes.txt': 'n\nm\n',
  })
  const run = await prLines(base, head)
  expect(run.stderr).toBe('')
  expect(run.status).toBe(0)
  const line = '12 diff lines in 5 files: code 4 (34%), tests 4 (33%), assets 0, tooling 1 (8%), docs 2 (17%), other 1 (8%).'
  expect(run.stdout).toBe(`## Diff lines by kind\n\n![Diff lines by kind](${run.out})\n\n${line}\n`)
  const { pills } = await drawing(run.out)
  expect(pills.map(({ text }) => text)).toContain(`${base.slice(0, 7)} → ${head.slice(0, 7)}`)
  const values = await expectPicture(run.out, {
    code: { value: '4 · 34% · +3 −1', share: 34 },
    tests: { value: '4 · 33% · +4 −0', share: 33 },
    assets: { value: '0', share: 0 },
    tooling: { value: '1 · 8% · +1 −0', share: 8 },
    docs: { value: '2 · 17% · +0 −2', share: 17 },
    other: { value: '1 · 8% · +1 −0', share: 8 },
  })
  // The value pill follows the bar, so at one scale for all bars it moves the same way per line.
  const step = (values.code.x - values.tooling.x) / (4 - 1)
  expect(step).toBeGreaterThan(0)
  for (const [kind, lines] of [['tests', 4], ['docs', 2], ['other', 1]]) {
    expect(values[kind].x).toBeCloseTo(values.tooling.x + step * (lines - 1), 1)
  }
})

test('a million lines next to one line still fit into the picture, with every cell for the larger kind', async () => {
  const base = await commit()
  const head = await commit({ 'app.py': 'a\n'.repeat(1_000_000), 'tests/check.py': 'b\n' })
  const run = await prLines(base, head)
  expect(run.status).toBe(0)
  await expectPicture(run.out, {
    code: { value: '1,000,000 · 100% · +1,000,000 −0', share: 100 },
    tests: { value: '1 · <1% · +1 −0', share: 0 },
  })
})

test('an --out name with a space or a parenthesis is written in angle brackets', async () => {
  const head = await commit({ 'notes.txt': 'n\n' })
  const run = await prLines(head, head, { out: join(directory, 'my lines (1).png') })
  expect(run.status).toBe(0)
  expect(run.stdout).toContain(`![Diff lines by kind](<${run.out}>)`)
})

test('a line in the .gitattributes at the head commit overrides the shared rules, and the work tree changes nothing', async () => {
  const base = await commit()
  const head = await commit({ '.gitattributes': '*.md pr-lines=code\n', 'README.md': lines(2) })
  await writeFile(join(repo, '.gitattributes'), '*.md pr-lines=tests\n')
  const run = await prLines(base, head)
  expect(run.status).toBe(0)
  expect(run.textLine).toBe(`3 diff lines in 2 files: code 2 (67%), tests 0, assets 0, tooling 1 (33%), docs 0, other 0.`)
})

test('a line in .git/info/attributes overrides the committed rules, and inherited git variables change nothing', async () => {
  const base = await commit()
  const head = await commit({ '.gitattributes': '*.txt pr-lines=code\n', 'notes.txt': 'n\n' })
  await mkdir(join(repo, '.git', 'info'), { recursive: true })
  await writeFile(join(repo, '.git', 'info', 'attributes'), '*.txt pr-lines=docs\n')
  const run = await prLines(base, head, { env: { GIT_DIR: join(directory, 'elsewhere'), GIT_ATTR_SOURCE: base } })
  expect(run.stderr).toBe('')
  expect(run.textLine).toBe('2 diff lines in 2 files: code 0, tests 0, assets 0, tooling 1 (50%), docs 1 (50%), other 0.')
})

test('a renamed file counts its changed lines once under the kind of its new path', async () => {
  const base = await commit({ 'notes.txt': lines(10) })
  const head = await commit({ 'notes.txt': null, 'docs/notes.md': lines(10).replace('line 9', 'line nine') })
  const run = await prLines(base, head)
  expect(run.status).toBe(0)
  expect(run.textLine).toBe(`2 diff lines in 1 file: code 0, ${NO_KIND}, docs 2 (100%), other 0.`)
})

test('a binary file and a file the diff attribute unsets each count as one binary file without lines', async () => {
  const base = await commit({ '.gitattributes': '*.dat -diff\n' })
  const head = await commit({
    'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]),
    'table.dat': 'text that the attribute hides\n',
  })
  const run = await prLines(base, head)
  expect(run.status).toBe(0)
  expect(run.textLine).toBe(
    '0 diff lines in 2 files: code 0, tests 0, assets 0 and 1 binary file, tooling 0, docs 0, other 0 and 1 binary file.')
})

test('the shares add up to 100, with the percent left over going to the kind that comes first on a tie', async () => {
  const base = await commit()
  const head = await commit({ 'app.py': 'a\n', 'tests/check.py': 'b\n', 'guide.md': 'c\n' })
  const run = await prLines(base, head)
  expect(run.status).toBe(0)
  expect(run.textLine).toBe('3 diff lines in 3 files: code 1 (34%), tests 1 (33%), assets 0, tooling 0, docs 1 (33%), other 0.')
})

test('a directory outside a git work tree is refused with its path', async () => {
  const plain = join(directory, 'plain')
  await mkdir(plain)
  await expectRefusal(await prLines('HEAD', 'HEAD', { repository: plain, env: { GIT_CEILING_DIRECTORIES: directory } }), plain)
})

test('a commit missing from the repository is refused with its name', async () => {
  const base = await commit({ 'notes.txt': 'n\n' })
  await expectRefusal(await prLines(base, 'f'.repeat(40)), 'f'.repeat(40), repo)
})

test('a pr-lines value that is not a kind is refused with its path and the value', async () => {
  for (const [rule, value] of [['pr-lines=doc', 'doc'], ['-pr-lines', 'unset']]) {
    const base = await commit()
    const head = await commit({ '.gitattributes': `*.txt ${rule}\n`, 'notes.txt': `${rule}\n` })
    await expectRefusal(await prLines(base, head), 'notes.txt', `'${value}'`)
  }
})

test('missing shared rules are refused with their path', async () => {
  const tool = join(directory, 'pr-lines.py')
  await copyFile(TOOL, tool)
  const head = await commit({ 'notes.txt': 'n\n' })
  await expectRefusal(await prLines(head, head, { tool }), join(directory, 'pr-lines.attributes'))
})

test('missing font files, a missing resvg and a failing resvg are each refused with what failed', async () => {
  const head = await commit({ 'notes.txt': 'n\n' })
  const empty = join(directory, 'empty')
  await mkdir(empty)
  await expectRefusal(await prLines(head, head, { fontDirectory: empty }), empty)
  const missing = join(directory, 'missing')
  await expectRefusal(await prLines(head, head, { resvg: missing }), missing)
  const failing = join(directory, 'failing-resvg')
  await writeFile(failing, '#!/bin/sh\necho broken\nexit 3\n')
  await chmod(failing, 0o755)
  await expectRefusal(await prLines(head, head, { resvg: failing }), '3', 'broken')
})

test('an --out that cannot be written is refused with its path', async () => {
  const head = await commit({ 'notes.txt': 'n\n' })
  const out = join(directory, 'missing', 'lines.png')
  await expectRefusal(await prLines(head, head, { out }), out)
})

test.skipIf(!RESVG || !FONTS)('the real resvg draws the same PNG twice with the Mona Sans fonts', async () => {
  const base = await commit({ 'app.py': lines(2) })
  const head = await commit({ 'app.py': lines(5), 'guide.md': 'c\n' })
  const options = { resvg: RESVG, fontDirectory: FONTS }
  const first = await prLines(base, head, { ...options, out: join(directory, 'first.png') })
  const second = await prLines(base, head, { ...options, out: join(directory, 'second.png') })
  expect(first.stderr).toBe('')
  expect(first.status).toBe(0)
  const picture = new Uint8Array(await readFile(first.out))
  expect([...picture.slice(0, 8)]).toStrictEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(new Uint8Array(await readFile(second.out))).toStrictEqual(picture)
})
