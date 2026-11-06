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
import { MarkRemover, Outcome, openGoalsOf } from './board'
import {
  addGoalToSession,
  clearGoalOfSession,
  editGoalOfSession,
  removeDoneMarkInSession,
} from './goalActions'
import { GOALS_COMMAND } from './goalNames'
import { openGoalsPaneOnFreshBoard } from './goalScreens'
import {
  ADD_USAGE_PROBLEM,
  CHANGE_NOT_TYPED,
  COMMANDS_IN_PLACE_OF_PANE,
  EDIT_USAGE_PROBLEM,
  GOALS_SUBJECT,
  GOALS_USAGE_PROBLEM,
  GoalsForm,
  describeAdded,
  describeCleared,
  describeEditRefused,
  describeEdited,
  describeNotAdded,
  describeNotCleared,
  describeNotEdited,
  describeNotOpen,
  describeNotRead,
  describeNotUnmarked,
  describeOpenGoals,
  describePaneNotOpened,
  describeTextUnchanged,
  describeUnmarkRefused,
  describeMarkRemovedForPerson,
  formOfWord,
} from './goalTexts'

enum GoalsAction {
  Open = 'open',
  Change = 'change',
  Unreadable = 'unreadable',
}

type GoalsInvocation =
  | { kind: GoalsAction.Open }
  | { kind: GoalsAction.Change; change: GoalsChange }
  | { kind: GoalsAction.Unreadable; problem: string }

/** The changes of the board asked for by /goals, each by its form. */
type GoalsChange =
  | { form: GoalsForm.Add; text: string }
  | { form: GoalsForm.Edit; number: number; text: string }
  | { form: GoalsForm.Unmark; number: number }
  | { form: GoalsForm.Clear; number: number }

const DIGITS_ALONE = /^\d+$/

const UNREADABLE: GoalsInvocation = { kind: GoalsAction.Unreadable, problem: GOALS_USAGE_PROBLEM }

/** Reads the arguments after the word of each form into the change asked for by them. */
const FORM_READERS: Record<GoalsForm, (args: string) => GoalsInvocation> = {
  [GoalsForm.Add]: text => changeOf({ form: GoalsForm.Add, text }),
  [GoalsForm.Edit]: readEditArguments,
  [GoalsForm.Unmark]: args =>
    readNumberArgument(args, number => ({ form: GoalsForm.Unmark, number })),
  [GoalsForm.Clear]: args =>
    readNumberArgument(args, number => ({ form: GoalsForm.Clear, number })),
}

/**
 * Reads the arguments of /goals: none to open the pane, or the word of a form followed by the
 * arguments of that form.
 */
function readGoalsArguments(args: string): GoalsInvocation {
  const trimmed = args.trim()
  if (trimmed === '') {
    return { kind: GoalsAction.Open }
  }
  const { word, rest } = splitFirstWord(trimmed)
  const form = formOfWord(word)

  return form === undefined ? UNREADABLE : FORM_READERS[form](rest)
}

/** Reads the arguments after /goals edit: the number of a goal, then its new text. */
function readEditArguments(args: string): GoalsInvocation {
  const { word, rest } = splitFirstWord(args)
  const number = readGoalNumber(word)

  return number === undefined
    ? { kind: GoalsAction.Unreadable, problem: EDIT_USAGE_PROBLEM }
    : changeOf({ form: GoalsForm.Edit, number, text: rest })
}

/** Reads the number of a goal alone into the change built by `changeWith` from it. */
function readNumberArgument(
  args: string,
  changeWith: (number: number) => GoalsChange,
): GoalsInvocation {
  const number = readGoalNumber(args)

  return number === undefined ? UNREADABLE : changeOf(changeWith(number))
}

function changeOf(change: GoalsChange): GoalsInvocation {
  return { kind: GoalsAction.Change, change }
}

/** The number of a goal written as `text`, or undefined for a text that is not such a number. */
function readGoalNumber(text: string): number | undefined {
  const number = DIGITS_ALONE.test(text) ? Number(text) : undefined

  return isPositiveInteger(number) ? number : undefined
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
    case GoalsAction.Change:
      return isTypedByUser(e.origin)
        ? changeFromCommand($, invocation.change)
        : { text: CHANGE_NOT_TYPED }
    case GoalsAction.Unreadable:
      return { text: invocation.problem }
  }
}

function changeFromCommand($: EngineInterface, change: GoalsChange): Promise<CommandRunResult> {
  switch (change.form) {
    case GoalsForm.Add:
      return addFromCommand($, change.text)
    case GoalsForm.Edit:
      return editFromCommand($, change.number, change.text)
    case GoalsForm.Unmark:
      return unmarkFromCommand($, change.number)
    case GoalsForm.Clear:
      return clearFromCommand($, change.number)
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
  const { loaded, opened } = await openGoalsPaneOnFreshBoard($)
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

async function editFromCommand(
  $: EngineInterface,
  number: number,
  text: string,
): Promise<CommandRunResult> {
  const edited = await editGoalOfSession($, await $.session.id(), number, text)
  switch (edited.outcome) {
    case Outcome.Changed:
      return { text: describeEdited(number) }
    case Outcome.Unchanged:
      return { text: describeTextUnchanged(number) }
    case Outcome.Refused:
      return { text: describeEditRefused(edited) }
    case Outcome.Failed:
      return replyWithFailure($, describeNotEdited(edited))
  }
}

/** Removes the done mark of the goal, whatever its evidence is by now. */
async function unmarkFromCommand($: EngineInterface, number: number): Promise<CommandRunResult> {
  const sessionId = await $.session.id()
  const removed = await removeDoneMarkInSession($, sessionId, number, MarkRemover.User)
  switch (removed.outcome) {
    case Outcome.Changed:
      return { text: describeMarkRemovedForPerson(number) }
    case Outcome.Refused:
      return { text: describeUnmarkRefused(removed) }
    case Outcome.Failed:
      return replyWithFailure($, describeNotUnmarked(removed))
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
