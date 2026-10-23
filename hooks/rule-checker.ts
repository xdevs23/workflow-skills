import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { backgroundOf, recordStop, startTurn } from './background.ts'
import { checkAtEnd } from './checker.ts'
import { SENT_FINDINGS } from './delivery.ts'
import { clearNote, hasFindings, noteRows } from './note.ts'
import { collectPrompt } from './prompts.ts'
import { storeInstructions, storeNestedInstructions } from './rules.ts'

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
  const checks = { model, skills }
  // The project root as the session first reported it, so TODO.md is read from one place.
  let root: Promise<string> | undefined

  on('session.start', async ($, e, next) => {
    // A checker switched on during a session asks again for the instruction files the engine
    // resolved before it was loaded.
    $.ui.invalidate('prompt.context')
    $.ui.invalidate('prompt.attachment')
    // Session state survives a reload, so the note written by the code loaded before is cleared.
    await clearNote($)
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

  // The words of a prompt come from its submission: a prompt delivered into a running turn is
  // stored inside the engine's notice of it.
  on('prompt.submit', async ($, e, next) => {
    await clearNote($)
    const entered = await next(e)
    if (entered.drop === undefined && e.isMeta !== true) {
      await collectPrompt($, { text: entered.text, origin: e.origin })
    }
    return entered
  })

  // A new turn of the main agent starts from the background work of the last stop. A stop that a
  // hook delays continues its turn, which starts no new turn.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) await startTurn($)
    return next(e)
  })

  // Every stop is checked, and the check delays the stop. Findings sent for the current prompt make
  // the agent work once more, and the check at a stop that follows such a delay only appends its
  // findings. The two models never loop.
  on('classic.Stop', async ($, e, next) => {
    root ??= $.session.root()
    const message = e.last_assistant_message
    const inFlight = { tasks: e.background_tasks ?? [], crons: e.session_crons ?? [] }
    const { running, waiting } = await backgroundOf($, inFlight)
    await checkAtEnd(checks, $, {
      final: message === undefined || message.trim() === '' ? null : message,
      todo: await todoOf($, await root),
      running,
      waiting,
      signal: next.signal,
      canWait: ms => ms < next.budget.remainingMs,
    })
    await recordStop($, inFlight)
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
