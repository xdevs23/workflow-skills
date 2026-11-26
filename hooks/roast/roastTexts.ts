import type { HintKindName } from '../hintKind'
import { AND_LIST } from '../listFormat'
import { PendingTextPlace } from '../pendingTexts'
import { JsonTextNotRead } from '../jsonText'
import { DEBUG_LOG_NOTE } from '../failureToast'
import type { HookSubject } from '../hookFailure'
import { describeFailedRecordRead } from '../sessionRecord'
import type { FailedRecordRead } from '../sessionRecord'
import { describeFailedStoreCall } from '../storeFailures'
import type { FailedStoreCall } from '../storeFailures'
import { describeProjectFailure } from '../projectFolder'
import type { ProjectFailure } from '../projectFolder'
import { MILLISECONDS_PER_MINUTE } from '../timeUnits'
import { ForkViewUnknown, ROW_LIMIT } from './messagesUnseenByFork'
import {
  HintRoastMissingCause,
  RoastNotWrittenCause,
  RoastRecovery,
  recoveryOf,
} from './roastFailure'
import type { HintRoastMissing, LastingApiError, RoastFailure } from './roastFailure'
import {
  IDLE_ROAST_COMMAND,
  IDLE_WAIT_MILLISECONDS,
  IdleRoastWord,
  ROAST_COMMAND,
} from './roastNames'
import type { RoastedAgent } from './roastedAgent'
import type { RoastProgressOf, RoastShown } from './roastState'

export const PANE_TITLE = 'Roast'

export const ROAST_ARGUMENT_HINT = '[point you found]'

export const ROAST_DESCRIPTION =
  'Roast this session where the result of its work falls short, and send the roast to Claude'

export const ROAST_SUBJECT: HookSubject = { name: 'roast' }

export const NO_ROAST = `Run /${ROAST_COMMAND} to roast this session.`

export const SEND_LABEL = 'Send roast'

export const SENDING_ROAST_NOTICE = 'Sending the roast to Claude.'

export const ROAST_REFUSED_NOTICE =
  'The roaster refused this roast because it found your point unfounded, so you cannot send the ' +
  'roast.'

const ROAST_SENT_LINE_OPENINGS: Record<PendingTextPlace, string> = {
  [PendingTextPlace.ToolResult]: 'Roast sent to Claude with a tool result:',
  [PendingTextPlace.BesidePrompt]: 'Roast sent to Claude beside your message:',
}

/** The line in the transcript that shows that `message`, a roast, went to Claude at `place`. */
export function describeRoastSentLine(place: PendingTextPlace, message: string): string {
  return `${ROAST_SENT_LINE_OPENINGS[place]}\n\n${message}`
}

export const COMMENT_LABEL = 'Comment'

export const COMMENT_PLACEHOLDER = 'Your words, sent before the roast'

export const COMMENT_SUBMIT_LABEL = 'send'

export const ROAST_TO_OTHER_SESSION =
  'The roast was not sent: another session runs by now, and the roast was written for the one ' +
  `before. Run /${ROAST_COMMAND} in this session.`

export const ROAST_LOST_WITHOUT_COMMAND = 'This session cannot be roasted.'

// Undefined where no step of a person clears the error.
const FIX_FOR_API_ERROR: Record<LastingApiError, string | undefined> = {
  authentication_failed: 'Log in again with /login.',
  oauth_org_not_allowed:
    'Log in with /login to an account whose organization may use Claude Code.',
  account_on_hold: 'Resolve the hold on the account.',
  verification_required: 'Verify the account.',
  billing_error: 'Check the billing of the account.',
  invalid_request: 'Run /compact to shorten the conversation.',
  model_not_found: 'Pick another model with /model.',
  max_output_tokens: undefined,
  cloud_credential_error: 'Renew the credentials for the cloud provider.',
  unknown: undefined,
}

const UNREADABLE_REPLY_CAUSES: Record<JsonTextNotRead, string> = {
  [JsonTextNotRead.NotJson]:
    'The roast came back as text that is not JSON, so this plugin cannot read it.',
  [JsonTextNotRead.OtherShape]:
    'The roast came back as JSON of a shape that this plugin cannot read.',
}

/** The sentences that describe a roast that was not written, apart from the retry step. */
type RoastFailureSentences = { cause: string; fix?: string | undefined; reply?: string }

function describeRoastFailureParts(failure: RoastFailure): RoastFailureSentences {
  switch (failure.cause) {
    case RoastNotWrittenCause.NothingToFork:
      return {
        cause:
          'A fork cannot write the roast before Claude has finished a request in this session.',
        fix: 'Send Claude a message and wait until Claude replies.',
      }
    case RoastNotWrittenCause.ApiError:
      return {
        cause:
          `The roast could not be written: the API returned the error ${failure.error} (status ` +
          `${failure.status}).`,
        fix: FIX_FOR_API_ERROR[failure.error],
      }
    case RoastNotWrittenCause.EmptyReply:
      return { cause: 'The roast came back without text.' }
    case RoastNotWrittenCause.Aborted:
      return { cause: 'The roast was cut off before it arrived.' }
    case RoastNotWrittenCause.UnreadableReply:
      return { cause: UNREADABLE_REPLY_CAUSES[failure.reason], reply: failure.reply }
    case RoastNotWrittenCause.Thrown:
      return { cause: `The roast could not be written: ${failure.message}.` }
    case RoastNotWrittenCause.CompactionSkipped:
      return { cause: `A hook skipped the compaction that writes the roast: ${failure.reason}.` }
  }
}

function describeNotWritten(failure: RoastFailure, retry: string): string {
  const { cause, fix, reply } = describeRoastFailureParts(failure)

  return [cause, fix, retry, reply === undefined ? undefined : `The reply: ${reply}`]
    .filter(sentence => sentence !== undefined)
    .join(' ')
}

const FORK_VIEW_UNKNOWN_CAUSES: Record<ForkViewUnknown, string> = {
  [ForkViewUnknown.NotRecorded]:
    'The main conversation has not had a step with a response since the session started or ' +
    'since its last compaction.',
  [ForkViewUnknown.TranscriptShortened]:
    'The transcript is shorter than at the last step with a response, as after a rewind.',
  [ForkViewUnknown.PastRowLimit]:
    `The transcript has ${ROW_LIMIT} rows or more, and the engine returns only the newest ` +
    `${ROW_LIMIT}.`,
}

/** The line in the debug log for a fork that got the prompt alone for `cause`. */
export function describeForkViewUnknown(cause: ForkViewUnknown): string {
  return (
    'The fork that writes the roast got no messages of the main conversation in front of the ' +
    `prompt and may lack the newest ones. ${FORK_VIEW_UNKNOWN_CAUSES[cause]}`
  )
}

/** The line in the debug log for a fork that got no list of running agents, for `cause`. */
export function describeRunningAgentsUnknown(cause: string): string {
  return (
    'The fork that writes the roast got no list of the running background agents, since the ' +
    `engine did not list them: ${cause}`
  )
}

export function describeRecordedWordsUnknown(failure: ProjectFailure): string {
  return (
    'The model that writes the roast did not get the words of the user recorded in the session ' +
    'or any project idea. ' +
    describeProjectFailure(failure)
  )
}

export function describeOpenGoalsUnknown(storeFailure: string): string {
  return (
    'The fork that writes the roast could not read the open goals in the session. ' + storeFailure
  )
}

/** The text for a run of /roast that ended without a roast, with the next step. */
export function describeRoastNotWritten(failure: RoastFailure): string {
  return describeNotWritten(failure, `Run /${ROAST_COMMAND} again.`)
}

/**
 * What goes to Claude in place of a roast on the hints at the end of a turn: the fixed texts of the
 * hint kinds `fixedTextKindNames`.
 */
function describeFixedHintTextsSent(fixedTextKindNames: readonly HintKindName[]): string {
  return fixedTextKindNames.length === 0
    ? 'Nothing went to Claude.'
    : `Claude gets the fixed text of the hints ${AND_LIST.format(fixedTextKindNames)} instead.`
}

/**
 * The line in the debug log for a roast on the hints at the end of a turn that was not written,
 * with `fixedTextKindNames`, the hint kinds whose fixed text goes to Claude in place of the roast.
 */
export function describeHintRoastMissing(
  missing: HintRoastMissing,
  fixedTextKindNames: readonly HintKindName[],
): string {
  const sent = describeFixedHintTextsSent(fixedTextKindNames)
  switch (missing.cause) {
    case HintRoastMissingCause.NotWritten:
      return (
        'The roast on the hints at the end of the turn was not written. ' +
        describeNotWritten(missing.failure, sent)
      )
    case HintRoastMissingCause.NoPoint:
      return `The roaster did not find a point in the reply at the end of the turn. ${sent}`
  }
}

/**
 * The line in the debug log for the roast on the hints `kindNames` at the end of a turn, dropped
 * once the user sent a message, another session runs, or a turn started that ends these hints.
 */
export function describeHintRoastDropped(kindNames: readonly HintKindName[]): string {
  return (
    `The roast on the hints ${AND_LIST.format(kindNames)} at the end of a turn was dropped: ` +
    'since that turn, the user sent a message, another session runs, or a turn started, which ' +
    'ends these hints. Nothing went to Claude.'
  )
}

/** The toast for a roast on the hints at the end of a turn lost to the failure `reason`. */
export function describeHintRoastLost(reason: string): string {
  return (
    `A roast on the hints at the end of Claude's last turn failed: ${reason}. Neither that ` +
    `roast nor its hints went to Claude. ${NO_ROAST} ${DEBUG_LOG_NOTE}`
  )
}

/** The notice for a roast written for `secondsWriting` so far. */
export function describeWriting(secondsWriting: number): string {
  return `Writing the roast about this session. ${secondsWriting}s`
}

/** The label shown before the notice that the roast is being written by the second attempt. */
export const SECOND_ATTEMPT_LABEL = 'Second attempt.'

/**
 * The notice for a roast written for `secondsWriting` so far, and again after the try `failedTries`
 * failed with `error`.
 */
export function describeWritingAgain(
  { failedTries, error }: RoastProgressOf<RoastShown.WritingAgain>,
  secondsWriting: number,
): string {
  return (
    `Writing the roast about this session, try ${failedTries + 1}. The try before failed with ` +
    `the API error ${error}. ${secondsWriting}s`
  )
}

export function describeOutputTokens(outputTokens: number): string {
  return `Tokens generated: ${outputTokens}`
}

export function describeSecondsNotShown(message: string): string {
  return `The ${PANE_TITLE} pane could not show the seconds spent writing the roast: ${message}.`
}

/** The reply to /roast while Claude Code does not draw the Roast pane yet, for `reason`. */
export function describeRoastPaneWaiting(reason: string): string {
  return (
    `Claude Code draws the ${PANE_TITLE} pane once it can: ${reason}. A fork writes the roast ` +
    'meanwhile.'
  )
}

export function describeRoastNotSent(reason: string): string {
  return (
    `The roast was not sent to Claude: ${reason}. Press ${SEND_LABEL} again in the ${PANE_TITLE} ` +
    'pane.'
  )
}

export const ROAST_WAITING_AFTER_STOP =
  'The roast is sent to Claude once you type a slash command or send a message.'

export function describeRoastWaitingForPane(paneTitle: string): string {
  return `The roast is sent to Claude once you close the ${paneTitle} pane or send a message.`
}

export const IDLE_ROAST_FOUND_NO_BLOCKING_POINT =
  'The idle roast found no point that blocks the work, so nothing went to Claude.'

const IDLE_ROAST_RETRY_STEPS: Record<RoastRecovery, string> = {
  [RoastRecovery.AskAgain]: 'The idle roast waits again once Claude ends its next turn.',
  [RoastRecovery.NeedsPerson]: 'The idle roast waits again after your next message.',
}

/** The text for an idle roast that was not written, with the next step. */
export function describeIdleRoastNotWritten(failure: RoastFailure): string {
  const retry = IDLE_ROAST_RETRY_STEPS[recoveryOf(failure)]

  return `The idle roast was not written. ${describeNotWritten(failure, retry)}`
}

/** The toast for an idle roast that was not written, which the debug log has too. */
export function describeIdleRoastNotWrittenToast(failure: RoastFailure): string {
  return `${describeIdleRoastNotWritten(failure)} ${DEBUG_LOG_NOTE}`
}

/**
 * A roast written by a fork that did not go to Claude waits for the next message, or for the next
 * tool result when a turn is running.
 */
const FORKED_ROAST_WAITS =
  'It goes to Claude with your next message, or with the next tool result if a turn is running ' +
  'by then.'

/** The toast for an idle roast that did not go to Claude for `reason` and waits again. */
export function describeIdleRoastFailed(reason: string): string {
  return `The idle roast was not sent to Claude: ${reason}. ${FORKED_ROAST_WAITS}`
}

/**
 * The toast for a roast about the chat before a compaction that did not go to Claude for `reason`
 * and waits again.
 */
export function describeCompactionRoastFailed(reason: string): string {
  return (
    `The roast about the chat before the compaction was not sent to Claude: ${reason}. ` +
    FORKED_ROAST_WAITS
  )
}

export const COMPACTION_ROAST_FOUND_NO_POINT =
  'The roast about the chat before the compaction found no point, so nothing went to Claude.'

const COMPACTION_ROAST_NEXT_TRY = 'The next compaction starts a new roast.'

/**
 * The text for a roast about the chat before a compaction that was not written, with the next
 * step.
 */
export function describeCompactionRoastNotWritten(failure: RoastFailure): string {
  return (
    'The roast about the chat before the compaction was not written. ' +
    describeNotWritten(failure, COMPACTION_ROAST_NEXT_TRY)
  )
}

/** The toast for a roast about the chat before a compaction that was not written. */
export function describeCompactionRoastNotWrittenToast(failure: RoastFailure): string {
  return `${describeCompactionRoastNotWritten(failure)} ${DEBUG_LOG_NOTE}`
}

/**
 * The line in the debug log for a roast about the chat before a compaction whose only try failed
 * with `error`, an error of the API that may clear on its own.
 */
export function describeCompactionRoastNotAskedAgain({
  error,
}: RoastProgressOf<RoastShown.WritingAgain>): string {
  return (
    'The roast about the chat before the compaction was not written: the API returned the error ' +
    `${error}, which may clear on its own. A fork asked again would read the summary in place ` +
    `of the chat, so the plugin does not ask again. ${COMPACTION_ROAST_NEXT_TRY}`
  )
}

export const AGENT_ROAST_FOUND_NO_POINT =
  'The roast for a subagent found no point, so nothing went to the subagent or to Claude.'

/** The wait of IDLE_WAIT_MILLISECONDS in whole minutes, as the texts write it. */
const IDLE_WAIT_WORDS = `about ${Math.round(
  IDLE_WAIT_MILLISECONDS / MILLISECONDS_PER_MINUTE,
)} minutes`

const AGENT_ROAST_NEXT_TRY =
  'The subagent gets a new roast at the next compaction of its conversation.'

/** The text for a roast for a subagent that was not written, with the next step. */
export function describeAgentRoastNotWritten(failure: RoastFailure): string {
  return (
    'The roast for a subagent was not written. ' +
    describeNotWritten(failure, AGENT_ROAST_NEXT_TRY)
  )
}

/** The toast for a roast for a subagent that was not written, which the debug log has too. */
export function describeAgentRoastNotWrittenToast(failure: RoastFailure): string {
  return `${describeAgentRoastNotWritten(failure)} ${DEBUG_LOG_NOTE}`
}

/** The line in the debug log for a roast about `agent` that was no longer wanted once written. */
export function describeAgentRoastDropped(agent: RoastedAgent): string {
  return (
    `The roast for the subagent ${agent.id} (${agent.description}) was dropped: by the time it ` +
    'was written, the subagent was stopped or no longer listed. Nothing went to it or to Claude.'
  )
}

/** The toast for a roast for a subagent that did not go to Claude for `reason` and waits again. */
export function describeAgentRoastFailed(reason: string): string {
  return `The roast for a subagent was not sent to Claude: ${reason}. ${FORKED_ROAST_WAITS}`
}

export const IDLE_ROAST_DESCRIPTION =
  'Switch the idle roast of this session on or off, or show whether it is on. Once it is on, ' +
  `Claude gets a roast of what blocks the work after it has been idle for ${IDLE_WAIT_WORDS}`

export const IDLE_ROAST_ARGUMENT_HINT = `[${IdleRoastWord.On}|${IdleRoastWord.Off}]`

export const IDLE_ROAST_SUBJECT: HookSubject = {
  name: 'idle roast',
  checkBeforeRetry:
    `Run /${IDLE_ROAST_COMMAND} to see whether it was switched before you try again.`,
}

export const IDLE_ROAST_LOST_WITHOUT_COMMAND =
  'The idle roast of this session cannot be switched on.'

export const IDLE_ROAST_NOT_TYPED_BY_USER =
  `The idle roast was not switched. Only /${IDLE_ROAST_COMMAND} typed by the user switches it.`

/** The reply to /idle-roast while the idle roast of the session is on when `isOn`, or off. */
export function describeIdleRoastSwitch(isOn: boolean): string {
  return isOn
    ? 'The idle roast is on for this session. Run ' +
        `/${IDLE_ROAST_COMMAND} ${IdleRoastWord.Off} to switch it off.`
    : 'The idle roast is off for this session. Run ' +
        `/${IDLE_ROAST_COMMAND} ${IdleRoastWord.On} to switch it on.`
}

/** The reply to /idle-roast followed by `words`, which change nothing. */
export function describeUnknownIdleRoastWords(words: string): string {
  return (
    `/${IDLE_ROAST_COMMAND} needs ${IdleRoastWord.On}, ${IdleRoastWord.Off} or nothing, so ` +
    `"${words}" changes nothing.`
  )
}

/** The text for the switch of this session that could not be read, with the reason in `read`. */
export function describeIdleRoastSwitchNotRead(read: FailedRecordRead): string {
  return (
    `Whether the idle roast is on for this session is unknown. ${describeFailedRecordRead(read)}`
  )
}

/** The reply to /idle-roast whose change the store failed to save, with the failure `failed`. */
export function describeIdleRoastNotSwitched(failed: FailedStoreCall): string {
  return `The idle roast was not switched. ${describeFailedStoreCall(failed)}`
}
