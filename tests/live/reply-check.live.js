// Runs every reply-check fixture through the judge model and compares the verdicts.
// This makes one model call per fixture, so `bun test` does not match this file.
// Run it with: bun tests/live/reply-check.live.js
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const hookFile = fileURLToPath(new URL('../../hooks/hooks.json', import.meta.url))
const fixtureDirectory = fileURLToPath(new URL('../fixtures/reply-check/', import.meta.url))

const config = await Bun.file(hookFile).json()
const { prompt, model } = config.hooks.Stop[0].hooks[0]

const responseSchema = JSON.stringify({
  type: 'object',
  required: ['ok'],
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    reason: { type: 'string' },
    impossible: { type: 'boolean' },
  },
})

const judge = async (input) => {
  const child = Bun.spawn([
    'claude', '-p',
    '--model', model,
    '--tools', '',
    // An installed copy of this hook must not judge the judge's own answer.
    '--settings', JSON.stringify({ disableAllHooks: true }),
    '--output-format', 'json',
    '--json-schema', responseSchema,
    prompt.replace('$ARGUMENTS', () => JSON.stringify(input)),
  ], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ])
  if (exitCode !== 0) throw new Error(`claude exited with ${exitCode}: ${stderr.trim()}`)
  const answer = JSON.parse(stdout).structured_output
  if (answer === null || typeof answer !== 'object') throw new Error('the result carries no structured_output')
  return answer
}

const passes = (answer, expected) =>
  answer.ok === expected &&
  answer.impossible !== true &&
  (answer.ok || (typeof answer.reason === 'string' && answer.reason.startsWith('Rewrite your last reply.')))

const names = (await readdir(fixtureDirectory)).filter((name) => name.endsWith('.json')).sort()
let failures = 0
for (const name of names) {
  const fixture = await Bun.file(fixtureDirectory + name).json()
  try {
    const answer = await judge(fixture.input)
    const passed = passes(answer, fixture.expect)
    if (!passed) failures += 1
    console.log(`${passed ? 'PASS' : 'MISMATCH'} ${name} ${JSON.stringify(answer)}`)
  } catch (error) {
    failures += 1
    console.log(`ERROR ${name} ${error.message}`)
  }
}
console.log(`${names.length - failures} of ${names.length} passed`)
process.exit(failures === 0 ? 0 : 1)
