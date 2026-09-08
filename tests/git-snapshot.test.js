import { expect, test } from 'bun:test'
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Exercise the actual Git-object contract in a disposable repository, not a model run.
test('pinned Git reads survive worktree writes and later commits while TODO stays untracked', async () => {
  const cache = fileURLToPath(new URL('../.cache/', import.meta.url))
  await mkdir(cache, { recursive: true })
  const directory = await mkdtemp(join(cache, 'git-snapshot-test-'))
  const git = async (...args) => {
    const process = Bun.spawn(['git', '-C', directory, ...args], { stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited,
    ])
    if (exitCode !== 0) throw new Error(`git ${args[0]} failed (${exitCode}): ${stderr}`)
    return stdout.trim()
  }
  try {
    await git('init', '--quiet', '--initial-branch=main')
    await mkdir(join(directory, 'src'))
    const source = join(directory, 'src/example.js')
    await writeFile(source, 'export const value = 1\n')
    await git('add', '--', 'src/example.js')
    await git('commit', '--quiet', '-m', 'fixture: record baseline')
    const baseSha = await git('rev-parse', '--verify', 'HEAD^{commit}')

    await writeFile(source, 'export const value = 2\n')
    await git('add', '--', 'src/example.js')
    await git('commit', '--quiet', '-m', 'fixture: record implementation snapshot')
    const snapshotSha = await git('rev-parse', '--verify', 'HEAD^{commit}')
    const exclude = join(directory, await git('rev-parse', '--git-path', 'info/exclude'))
    await readFile(exclude, 'utf8')
    await appendFile(exclude, '\n/TODO.md\n')
    await writeFile(join(directory, 'TODO.md'), '- Local cleanup\n')
    expect(await git('status', '--porcelain=v1', '--untracked-files=all')).toBe('')
    expect(await git('ls-files', '--', 'TODO.md')).toBe('')

    // The fixer can change files and advance HEAD without changing the roaster's input.
    await writeFile(source, 'export const value = 3\n')
    expect(await git('show', `${snapshotSha}:src/example.js`)).toBe('export const value = 2')
    await git('add', '--', 'src/example.js')
    await git('commit', '--quiet', '-m', 'fixture: record approved correction')
    const fixedSha = await git('rev-parse', '--verify', 'HEAD^{commit}')
    expect(fixedSha).not.toBe(snapshotSha)
    expect(await git('status', '--porcelain=v1', '--untracked-files=all')).toBe('')
    expect(await git('show', `${snapshotSha}:src/example.js`)).toBe('export const value = 2')
    expect(await git('show', `${fixedSha}:src/example.js`)).toBe('export const value = 3')
    expect(await git('ls-tree', '-r', '--name-only', snapshotSha)).toBe('src/example.js')
    const diff = await git('diff', '--no-ext-diff', '--no-textconv', baseSha, snapshotSha, '--')
    expect(diff).toContain('+export const value = 2')
    expect(diff).not.toContain('+export const value = 3')
    expect(await git('ls-files', '--', 'TODO.md')).toBe('')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
