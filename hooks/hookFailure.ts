import type { CommandRunResult, EngineInterface, HookFailure, ToolCallResult } from 'claude-code'

/** What the hooks of one feature work on, as written in the texts about a failed hook of it. */
export type HookSubject = {
  /** The noun for what the hooks work on, such as "questions" or "goals board". */
  name: string
  /** The sentence that tells how to see whether a change was saved, before trying again. */
  checkBeforeRetry: string
}

/** Denies the tool call whose hook failed, with the reason, which goes to the debug log too. */
export function denyFailedHook(
  $: EngineInterface,
  subject: HookSubject,
  failure: HookFailure,
): ToolCallResult {
  return { deny: logAndDescribe($, subject, failure) }
}

/**
 * Denies the tool call that could not use what the hooks work on for `reason`, such as a store that
 * cannot be read, with the reason, which goes to the debug log too.
 */
export function denyFailedUse(
  $: EngineInterface,
  subject: HookSubject,
  reason: string,
): ToolCallResult {
  return { deny: writeToDebugLog($, describeFailedUse(subject, reason)) }
}

/** Replies to the command whose hook failed with the reason, which goes to the debug log too. */
export function replyToFailedHook(
  $: EngineInterface,
  subject: HookSubject,
  failure: HookFailure,
): CommandRunResult {
  return { text: logAndDescribe($, subject, failure) }
}

/** What the model or the person at the prompt is told of a failed hook, by the kind of failure. */
const HOOK_FAILURE_TEXTS: Record<
  HookFailure['kind'],
  (subject: HookSubject, message: string | undefined) => string
> = {
  throw: describeFailedUse,
  timeout: describeUnfinishedUse,
}

/** What the model or the person at the prompt is told of the failed hook. */
export function describeHookFailure(subject: HookSubject, failure: HookFailure): string {
  return HOOK_FAILURE_TEXTS[failure.kind](subject, failure.message)
}

function logAndDescribe($: EngineInterface, subject: HookSubject, failure: HookFailure): string {
  return writeToDebugLog($, describeHookFailure(subject, failure))
}

/** Writes `text` to the debug log, and returns it. */
function writeToDebugLog($: EngineInterface, text: string): string {
  $.ui.log(text, { to: 'debug' })

  return text
}

/** The text for a hook that failed with `reason`, such as a store that cannot be read. */
function describeFailedUse(subject: HookSubject, reason: string | undefined): string {
  return [
    `The ${subject.name} could not be used: ${reason ?? 'the hook failed without a reason'}`,
    `The debug log has this too. Until the cause is fixed, go on without the ${subject.name}.`,
  ].join('\n')
}

/**
 * The text for a hook that ran past its time, possibly after it saved a change, with the last
 * failure before that, if any.
 */
function describeUnfinishedUse(subject: HookSubject, lastFailure: string | undefined): string {
  return [
    `The ${subject.name} did not finish in time, so whether the change was saved is unknown.`,
    ...(lastFailure === undefined ? [] : [`The last failure before that: ${lastFailure}`]),
    `${subject.checkBeforeRetry} The debug log has this too.`,
  ].join('\n')
}
