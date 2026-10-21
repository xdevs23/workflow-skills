import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { checkAtEnd, checkBeside, checksOf } from './checker.ts'
import { SENT_FINDINGS } from './delivery.ts'
import { clearNote, hasFindings, noteRows } from './note.ts'
import { storeInstructions, storeNestedInstructions } from './rules.ts'
import { collect, collectWords } from './work.ts'

const isStringList = (value: PluginOptions[string] | undefined): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

async function todoOf($: EngineInterface, root: string): Promise<string | null> {
  const path = `${root}/TODO.md`

  return (await $.fs.exists(path)) ? $.fs.read(path) : null
}

export const register: Register = (on, options) => {
  if (options.ruleChecker !== true) return
  const model = options.ruleCheckerModel
  if (typeof model !== 'string') {
    throw new Error(`ruleCheckerModel is not a model name: ${String(model)}`)
  }
  const skills = options.ruleCheckerSkills
  if (!isStringList(skills)) {
    throw new Error(`ruleCheckerSkills is not a list of skills: ${String(skills)}`)
  }
  const checks = checksOf(model, skills)
  // The project root as the session first reported it, so TODO.md is read from one place.
  let root: Promise<string> | undefined

  // A checker switched on during a session asks again for the instruction files the engine
  // resolved before it was loaded.
  on('session.start', ($, e, next) => {
    $.ui.invalidate('prompt.context')
    $.ui.invalidate('prompt.attachment')
    return next(e)
  })

  on('prompt.context', async ($, e, next) => {
    const below = await next(e)
    await storeInstructions($, e, below)
    return below
  })

  on('prompt.attachment', { type: 'nested_memory' }, async ($, e, next) => {
    const shown = await next(e)
    if (e.agentId === undefined && shown.text !== null && shown.text !== '') {
      await storeNestedInstructions($, shown.text)
    }
    return shown
  })

  on('session.append', { door: ['response', 'tool-result'] }, async ($, e, next) => {
    const stored = await next(e)
    if (e.agentId === undefined && stored.deny === undefined) {
      await collect($, { door: e.door, message: stored.message })
    }
    return stored
  })

  // The words of a prompt come from its submission: a prompt delivered into a running turn is
  // stored inside the engine's notice of it.
  on('prompt.submit', async ($, e, next) => {
    await clearNote($)
    const entered = await next(e)
    if (entered.drop === undefined && e.isMeta !== true) {
      await collectWords($, { text: entered.text, origin: e.origin })
    }
    return entered
  })

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    if (e.agentId === undefined && step.answer !== '' && step.toolUses.length > 0) {
      checkBeside(checks, $)
    }
    return step
  })

  on('tool.call', { tool: ['Agent', 'Workflow'] }, ($, e, next) => {
    if (e.agentId === undefined) checkBeside(checks, $)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (
      e.agentId === undefined &&
      ran.isError !== true &&
      ran.result?.gitOperation?.commit !== undefined
    ) {
      checkBeside(checks, $)
    }
    return ran
  })

  // The check at the end of a turn delays the stop. Findings sent for the current prompt make the
  // agent work once more, and a stop that follows such a delay only appends them. The two models
  // never loop.
  on('classic.Stop', async ($, e, next) => {
    root ??= $.session.root()
    const end = { todo: await todoOf($, await root), tasks: e.background_tasks ?? [] }
    await checkAtEnd(checks, $, {
      end,
      signal: next.signal,
      canWait: ms => ms < next.budget.remainingMs,
    })
    const below = await next(e)
    if (e.stop_hook_active || !(await hasFindings($))) return below

    return {
      ...below,
      block: [below.block, SENT_FINDINGS].filter(reason => reason !== undefined).join('\n\n'),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const rows = await noteRows($, e.props.bodyColumns)
    if (e.props.hasSurvey || rows.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    return Box({ flexDirection: 'column', children: rows.map(row => Text({ children: row })) })
  })
}
