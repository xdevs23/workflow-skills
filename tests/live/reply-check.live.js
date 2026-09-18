// Runs every reply-check fixture through the judge model and compares the verdicts.
// The file name is outside the patterns `bun test` matches. It has to stay outside them,
// because this file makes one model call per fixture.
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

const rightVerdict = (answer, expected) => answer.ok === expected && answer.impossible !== true

// A blocking answer owes the main model a whole rewrite instruction. One that lacks it is
// counted and shown, and does not fail the run, because the verdict is still right.
const malformedReason = (answer) =>
  answer.ok === false &&
  !(typeof answer.reason === 'string' && answer.reason.startsWith('Rewrite your last reply.'))

const report = async (name) => {
  const fixture = await Bun.file(fixtureDirectory + name).json()
  try {
    const answer = await judge(fixture.input)
    const passed = rightVerdict(answer, fixture.expect)
    const malformed = passed && malformedReason(answer)
    const word = !passed ? 'MISMATCH' : malformed ? 'FORMAT' : 'PASS'
    return { passed, malformed, line: `${word} ${name} ${JSON.stringify(answer)}` }
  } catch (error) {
    return { passed: false, malformed: false, line: `ERROR ${name} ${error.message}` }
  }
}

const callsInFlight = 4
const names = (await readdir(fixtureDirectory)).filter((name) => name.endsWith('.json')).sort()
const reports = new Array(names.length)
let next = 0
// Each worker takes the next unjudged fixture until none is left.
const worker = async () => {
  while (next < names.length) {
    const index = next
    next += 1
    reports[index] = await report(names[index])
  }
}
await Promise.all(Array.from({ length: callsInFlight }, worker))

for (const { line } of reports) console.log(line)
const failures = reports.filter(({ passed }) => !passed).length
console.log(`${names.length - failures} of ${names.length} passed`)
console.log(`${reports.filter(({ malformed }) => malformed).length} malformed reasons`)
process.exit(failures === 0 ? 0 : 1)
