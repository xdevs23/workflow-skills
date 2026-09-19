import { expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const hookFile = fileURLToPath(new URL('../hooks/hooks.json', import.meta.url))
const fixtureDirectory = fileURLToPath(new URL('./fixtures/reply-check/', import.meta.url))

test('the hook file declares one prompt hook on Stop and nothing else', async () => {
  const config = await Bun.file(hookFile).json()

  expect(typeof config.description).toBe('string')
  // One sentence: a single full stop, at the end.
  expect(config.description.endsWith('.')).toBe(true)
  expect(config.description.split('.').length).toBe(2)

  expect(Object.keys(config.hooks)).toEqual(['Stop'])
  expect(config.hooks.Stop).toHaveLength(1)
  expect(config.hooks.Stop[0].hooks).toHaveLength(1)

  const hook = config.hooks.Stop[0].hooks[0]
  expect(hook.type).toBe('prompt')
  expect(hook.model).toBe('claude-haiku-4-5')
  expect(hook.timeout).toBe(20)
  expect(typeof hook.prompt).toBe('string')
  expect(hook.prompt.split('$ARGUMENTS').length).toBe(2)
})

test('every fixture is a Stop input with an expected verdict, and the set covers each case', async () => {
  const names = (await readdir(fixtureDirectory)).filter((name) => name.endsWith('.json')).sort()
  expect(names).toHaveLength(23)

  const fixtures = await Promise.all(names.map((name) => Bun.file(fixtureDirectory + name).json()))
  for (const fixture of fixtures) {
    expect(typeof fixture.expect).toBe('boolean')
    expect(typeof fixture.input.last_assistant_message).toBe('string')
    expect(typeof fixture.input.stop_hook_active).toBe('boolean')
  }

  const verdicts = (selected) => new Set(selected.map((fixture) => fixture.expect))
  expect(verdicts(fixtures)).toEqual(new Set([true, false]))
  const rewrites = fixtures.filter((fixture) => fixture.input.stop_hook_active)
  expect(verdicts(rewrites)).toEqual(new Set([true, false]))
})
