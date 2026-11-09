import { describe, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PLUGIN } from '../names'
import { test } from '../testDeclaration'
import { PROJECT_ROOT, SUBAGENT, callSkillTool } from '../testSupport'
import { requestModel, startLedgerSession } from './ledgerTestSupport'
import type { LedgerSession } from './ledgerTestSupport'
import { regExpLiteralOf } from './regExpLiteral'

const WRITING_CODE = `${PLUGIN}:writing-code`
const COMMIT_MESSAGES = `${PLUGIN}:commit-messages`
const WRITING_STYLE = `${PLUGIN}:writing-style`
const KOTLIN_FILE = `${PROJECT_ROOT}/app/src/Profile.kt`

/**
 * The absolute path of the Kotlin rules, as a group. The plugin folder is unknown to a test, so a
 * test reads the path listed by the denial, and the retried call proves that the path counts.
 */
const KOTLIN_RULES = String.raw`(/\S+/skills/writing-code/languages/kotlin\.md)`

/** What Edit and Bash return beneath the plugin once they ran. */
const RAN = 'ran'

/**
 * The denial that requires `steps`, a source of a regular expression, after the sentence by which
 * the engine names the plugin that denied the call.
 */
function denialRequiring(steps: string): RegExp {
  const intro =
    `denied by plugin ${PLUGIN}: ` +
    'This call did not run, since it needs rules that this conversation has not loaded: '

  return new RegExp(`${regExpLiteralOf(intro)}${steps}, then retry this call\\.$`, 'u')
}

const LOAD_WRITING_CODE = `load ${regExpLiteralOf(WRITING_CODE)} with the Skill tool`
const LOAD_WRITING_STYLE = `load ${regExpLiteralOf(WRITING_STYLE)} with the Skill tool`
const LOAD_COMMIT_MESSAGES = `load ${regExpLiteralOf(COMMIT_MESSAGES)} with the Skill tool`
const LOAD_ALL_FOR_KOTLIN = denialRequiring(`${LOAD_WRITING_CODE} and read ${KOTLIN_RULES}`)

/** Starts a session in which Edit and Bash run beneath the plugin. */
function startSessionThatRuns($: Engine, on: On): Promise<LedgerSession> {
  on('tool.call', { tool: 'Edit' }, () => ({ result: RAN }))
  on('tool.call', { tool: 'Bash' }, () => ({ result: RAN }))

  return startLedgerSession($, on)
}

function editKotlinFile($: Engine, agentId?: string) {
  return $.tool.call({
    tool: 'Edit',
    file_path: KOTLIN_FILE,
    old_string: 'val badge = ""',
    new_string: 'val badge = Badge.Member',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

/** Reads the file at the path in the first group of `denial`. */
function readFileListed($: Engine, denial: RegExpMatchArray | null | undefined, agentId?: string) {
  return $.tool.call({
    tool: 'Read',
    file_path: denial?.[1] ?? '',
    ...(agentId === undefined ? {} : { agentId }),
  })
}

describe('the denial of a call that needs a skill not loaded', () => {
  test('a Kotlin edit runs once writing-code and the Kotlin rules are loaded', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    const { text } = await editKotlinFile($)

    expect(text).toMatch(LOAD_ALL_FOR_KOTLIN)
    await callSkillTool($, WRITING_CODE)
    await readFileListed($, text?.match(LOAD_ALL_FOR_KOTLIN))

    expect((await editKotlinFile($)).result).toBe(RAN)
  })

  test('an agent loads the rules in its own loop', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    const { text } = await editKotlinFile($)
    await callSkillTool($, WRITING_CODE)
    await readFileListed($, text?.match(LOAD_ALL_FOR_KOTLIN))
    await requestModel($, ledger, 30_000, SUBAGENT)
    const denied = await editKotlinFile($, SUBAGENT)

    expect(denied.text).toMatch(LOAD_ALL_FOR_KOTLIN)
    await callSkillTool($, WRITING_CODE, SUBAGENT)
    await readFileListed($, denied.text?.match(LOAD_ALL_FOR_KOTLIN), SUBAGENT)

    expect((await editKotlinFile($, SUBAGENT)).result).toBe(RAN)
  })

  test('a loaded skill leaves only the file to read', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    await callSkillTool($, WRITING_CODE)

    expect((await editKotlinFile($)).text).toMatch(denialRequiring(`read ${KOTLIN_RULES}`))
  })

  test('git commit runs once commit-messages is loaded', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    const commit = () => $.tool.call({ tool: 'Bash', command: 'git commit -m x' })

    expect((await commit()).text).toMatch(denialRequiring(LOAD_COMMIT_MESSAGES))
    await callSkillTool($, COMMIT_MESSAGES)

    expect((await commit()).result).toBe(RAN)
  })

  test('a load made before the loop reported its size counts', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, null)
    const editNotes = () =>
      $.tool.call({
        tool: 'Edit',
        file_path: `${PROJECT_ROOT}/docs/setup.md`,
        old_string: 'draft',
        new_string: 'final',
      })

    expect((await editNotes()).text).toMatch(denialRequiring(LOAD_WRITING_STYLE))
    await callSkillTool($, WRITING_STYLE)

    expect((await editNotes()).result).toBe(RAN)
  })

  test('a command that its tool holds read-only runs with the words of a row', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    const commands = [
      'grep -rn "git commit" skills/',
      'git log --grep "git add"',
      'rg "gh pr create" skills',
      'echo "git commit" > /dev/null',
    ]
    for (const command of commands) {
      const checked = await $.tool.check({
        tool: 'Bash',
        input: { command },
        tool_use_id: 'call-1',
        isReadOnly: true,
      })

      expect(checked.decision).toBe('allow')
    }
  })

  test('a call that matches no row runs', async ($, on) => {
    const ledger = await startSessionThatRuns($, on)
    await requestModel($, ledger, 40_000)
    const edit = await $.tool.call({
      tool: 'Edit',
      file_path: `${PROJECT_ROOT}/notes.txt`,
      old_string: 'draft',
      new_string: 'final',
    })

    expect(edit.result).toBe(RAN)
  })
})
