import type {
  Caught,
  CommandRunInput,
  CommandRunResult,
  EngineInterface,
  Frozen,
  MatchedHook,
} from 'claude-code'

import { replyToFailedHook } from '../hookFailure'
import { isPositiveInteger } from '../positiveInteger'
import { isTypedByUser } from '../promptOrigin'
import { Outcome, openGoalsOf } from './board'
import { addGoalToSession, clearGoalOfSession, loadBoardIntoState } from './goalActions'
import { ADD_WORD, CLEAR_WORD, GOALS_COMMAND } from './goalNames'
import { openGoalsPane } from './goalScreens'
import {
  ADD_USAGE_PROBLEM,
  CHANGE_NOT_TYPED,
  COMMANDS_IN_PLACE_OF_PANE,
  GOALS_SUBJECT,
  GOALS_USAGE_PROBLEM,
  describeAdded,
  describeCleared,
  describeNotAdded,
  describeNotCleared,
  describeNotOpen,
  describeNotRead,
  describeOpenGoals,
  describePaneNotOpened,
} from './goalTexts'

enum GoalsAction {
  Open = 'open',
  Add = 'add',
  Clear = 'clear',
  Unreadable = 'unreadable',
}

type GoalsInvocation =
  | { kind: GoalsAction.Open }
  | { kind: GoalsAction.Add; text: string }
  | { kind: GoalsAction.Clear; number: number }
  | { kind: GoalsAction.Unreadable }

const DIGITS_ALONE = /^\d+$/

/**
 * Reads the arguments of /goals: none to open the pane, the word add and the text of a goal, or the
 * word clear and the number of a goal.
 */
function readGoalsArguments(args: string): GoalsInvocation {
  const trimmed = args.trim()
  if (trimmed === '') {
    return { kind: GoalsAction.Open }
  }
  const { word, rest } = splitFirstWord(trimmed)
  if (word === ADD_WORD) {
    return { kind: GoalsAction.Add, text: rest }
  }
  const number = word === CLEAR_WORD && DIGITS_ALONE.test(rest) ? Number(rest) : undefined

  return isPositiveInteger(number)
    ? { kind: GoalsAction.Clear, number }
    : { kind: GoalsAction.Unreadable }
}

/** The text up to its first white space, and the text after that white space, trimmed. */
function splitFirstWord(text: string): { word: string; rest: string } {
  const end = text.search(/\s/)

  return end === -1
    ? { word: text, rest: '' }
    : { word: text.slice(0, end), rest: text.slice(end).trim() }
}

export const runGoalsCommand: MatchedHook<
  'command.run',
  { command: typeof GOALS_COMMAND }
> = async ($, e) => {
  const invocation = readGoalsArguments(e.args)
  switch (invocation.kind) {
    case GoalsAction.Open:
      return openFromCommand($)
    case GoalsAction.Add:
    case GoalsAction.Clear:
      if (!isTypedByUser(e.origin)) {
        return { text: CHANGE_NOT_TYPED }
      }

      return invocation.kind === GoalsAction.Add
        ? addFromCommand($, invocation.text)
        : clearFromCommand($, invocation.number)
    case GoalsAction.Unreadable:
      return { text: GOALS_USAGE_PROBLEM }
  }
}

/** Returns the reply to /goals when its hook failed, with the reason. */
export function replyWithGoalsHookFailure(
  $: EngineInterface,
  _e: Frozen<CommandRunInput>,
  next: Caught,
): CommandRunResult {
  return replyToFailedHook($, GOALS_SUBJECT, next.error)
}

/**
 * Reads the board of the session again and opens the Goals pane, which then shows it. Replies only
 * where the board could not be read or the pane could not open, and then lists the open goals.
 */
async function openFromCommand($: EngineInterface): Promise<CommandRunResult> {
  const loaded = await loadBoardIntoState($, await $.session.id())
  const opened = await openGoalsPane($)
  const notOpened = opened.isPlaced ? [] : [describePaneNotOpened(opened.reason)]
  if (loaded.outcome === Outcome.Failed) {
    return replyWithFailure($, [...notOpened, describeNotRead(loaded.failure)].join('\n'))
  }
  if (opened.isPlaced) {
    return {}
  }

  return {
    text: [
      ...notOpened,
      ...describeOpenGoals(openGoalsOf(loaded.board)),
      '',
      COMMANDS_IN_PLACE_OF_PANE,
    ].join('\n'),
  }
}

async function addFromCommand($: EngineInterface, text: string): Promise<CommandRunResult> {
  const added = await addGoalToSession($, await $.session.id(), text)
  switch (added.outcome) {
    case Outcome.Changed:
      return { text: describeAdded(added.goal) }
    case Outcome.Refused:
      return { text: ADD_USAGE_PROBLEM }
    case Outcome.Failed:
      return replyWithFailure($, describeNotAdded(added))
  }
}

/** Clears the goal without asking, since the user typed its number. */
async function clearFromCommand($: EngineInterface, number: number): Promise<CommandRunResult> {
  const cleared = await clearGoalOfSession($, await $.session.id(), number)
  switch (cleared.outcome) {
    case Outcome.Changed:
      return { text: describeCleared(number) }
    case Outcome.Refused:
      return { text: describeNotOpen(number) }
    case Outcome.Failed:
      return replyWithFailure($, describeNotCleared(cleared))
  }
}

/** Writes the failure described by `text` to the debug log, and replies with it. */
function replyWithFailure($: EngineInterface, text: string): CommandRunResult {
  $.ui.log(text, { to: 'debug' })

  return { text }
}
