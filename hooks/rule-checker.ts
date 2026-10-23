import type { EngineInterface, Register } from 'claude-code'

import type { RuleCheckerSettings } from '../types'
import { backgroundOf, clearBackground, recordStop, startTurn } from './background.ts'
import { checkAtEnd, fixedSystemCache } from './checker.ts'
import { activeSettings, LoadKind, loadSessionSettings } from './checker-settings.ts'
import { COMMAND, loadProblemText, runCommand } from './command.ts'
import { SENT_FINDINGS } from './delivery.ts'
import { clearState } from './last-check.ts'
import { clearNote, hasFindings, noteOf } from './note.ts'
import { noteTree, rowsOf } from './note-view.ts'
import { clearPrompts, collectPrompt } from './prompts.ts'
import { askForInstructions, storeInstructions, storeNestedInstructions } from './rules.ts'
import { clearSent } from './sent-findings.ts'
import { enterSession } from './session-file.ts'

async function todoOf($: EngineInterface, root: string): Promise<string | null> {
  const path = `${root}/TODO.md`

  return (await $.fs.exists(path)) ? $.fs.read(path) : null
}

// Starts the checker as a fresh load does: with an empty note, and requesting the instruction
// files again, which the engine resolved while the checker was off or before this module was
// loaded.
async function startChecker($: EngineInterface): Promise<void> {
  askForInstructions($)
  await clearNote($)
  await clearSent($)
}

// Clears what the checker collected for the conversation of another session.
async function clearConversation($: EngineInterface): Promise<void> {
  await clearNote($)
  await clearSent($)
  await clearPrompts($)
  await clearState($)
  await clearBackground($)
}

// Follows the session whose transcript path a classic event passes, and passes the event on. A new
// folder starts a new conversation with the settings stored for it.
async function follow<E extends { transcript_path: string }, R>(
  $: EngineInterface,
  e: E,
  next: (e: E) => Promise<R>,
): Promise<R> {
  if (await enterSession($, e.transcript_path)) {
    await clearConversation($)
    const loaded = await loadSessionSettings($)
    if (loaded.kind !== LoadKind.Loaded) $.ui.log(loadProblemText(loaded))
    else if (loaded.isStarted) await startChecker($)
  }

  return next(e)
}

// Runs the body of a hook of the checker with the settings in force while the checker is on for
// the session. While it is off, the event passes on untouched.
async function whenOn<E, R>(
  $: EngineInterface,
  e: E,
  next: (e: E) => Promise<R>,
  body: (settings: RuleCheckerSettings) => Promise<R>,
): Promise<R> {
  const settings = await activeSettings($)

  return settings.enabled ? body(settings) : next(e)
}

export const register: Register = on => {
  const fixed = fixedSystemCache()
  // The project root as the session first reported it, so TODO.md is read from one place.
  let root: Promise<string> | undefined

  on('session.start', async ($, e, next) => {
    // Session state survives a reload, so a checker that is on starts again.
    if ((await activeSettings($)).enabled) await startChecker($)
    await $.command.register(COMMAND)
    return next(e)
  })

  // A module loaded during a session receives no SessionStart, and a slash command raises none of
  // the classic events, so the next prompt supplies the transcript path of the session.
  on('classic.SessionStart', follow)
  on('classic.UserPromptSubmit', follow)

  on('command.run', { command: 'rule-checker' }, async ($, e) => {
    const reply = await runCommand($, e.args)
    if (reply.isStarted) await startChecker($)
    return { text: reply.text }
  }).catch(($, e, next) => ({
    text: `The rule checker command failed: ${next.error.message ?? next.error.kind}`,
  }))

  on('prompt.context', ($, e, next) =>
    whenOn($, e, next, async () => {
      const below = await next(e)
      await storeInstructions($, e, below)
      return below
    }),
  )

  on('prompt.attachment', { type: 'nested_memory' }, ($, e, next) =>
    whenOn($, e, next, async () => {
      const shown = await next(e)
      if (e.agentId === undefined && shown.text !== null && shown.text !== '') {
        await storeNestedInstructions($, shown.text)
      }
      return shown
    }),
  )

  // The words of a prompt come from its submission: a prompt delivered into a running turn is
  // stored inside the engine's notice of it.
  on('prompt.submit', ($, e, next) =>
    whenOn($, e, next, async () => {
      await clearNote($)
      const entered = await next(e)
      if (entered.drop === undefined && e.isMeta !== true) {
        await collectPrompt($, { text: entered.text, origin: e.origin })
      }
      return entered
    }),
  )

  // A new turn of the main agent starts from the background work of the last stop. A stop that a
  // hook delays continues its turn, which starts no new turn.
  on('turn.start', ($, e, next) =>
    whenOn($, e, next, async () => {
      if (e.agentId === undefined) await startTurn($)
      return next(e)
    }),
  )

  // Every stop is checked, and the check delays the stop. Findings sent for the current prompt make
  // the agent work once more, and the check at a stop that follows such a delay only appends its
  // findings. The two models never loop.
  on('classic.Stop', ($, e, next) =>
    whenOn($, e, next, async settings => {
      root ??= $.session.root()
      const message = e.last_assistant_message
      const inFlight = { tasks: e.background_tasks ?? [], crons: e.session_crons ?? [] }
      const { running, waiting } = await backgroundOf($, inFlight)
      await checkAtEnd({ settings, cache: fixed }, $, {
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
    }),
  )

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) =>
    whenOn($, e, next, async () => {
      const rows = rowsOf(await noteOf($))
      if (e.props.hasSurvey || rows.length === 0) return next(e)

      return noteTree($.ui.resolve(e), rows)
    }),
  )
}
