import type { ModelApiError } from 'claude-code'

import type { JsonTextNotRead } from '../jsonText'

/** Why a fork asked for a roast, by /roast or by the idle roast, wrote no roast. */
export enum RoastNotWrittenCause {
  NothingToFork = 'nothing to fork',
  ApiError = 'api error',
  EmptyReply = 'empty reply',
  Aborted = 'aborted',
  /** The reply is not the JSON object that the prompt asked for. */
  UnreadableReply = 'unreadable reply',
  Thrown = 'thrown',
}

/** Whether a fork asked again can write the roast, or only a person can clear the cause. */
export enum RoastRecovery {
  AskAgain = 'ask again',
  NeedsPerson = 'needs person',
}

// A lasting API error does not clear on its own, and a thrown error cannot be classified, so
// asking again would fail the same way.
const RECOVERY_OF_CAUSE: Record<RoastNotWrittenCause, RoastRecovery> = {
  [RoastNotWrittenCause.NothingToFork]: RoastRecovery.AskAgain,
  [RoastNotWrittenCause.ApiError]: RoastRecovery.NeedsPerson,
  [RoastNotWrittenCause.EmptyReply]: RoastRecovery.AskAgain,
  [RoastNotWrittenCause.Aborted]: RoastRecovery.AskAgain,
  [RoastNotWrittenCause.UnreadableReply]: RoastRecovery.AskAgain,
  [RoastNotWrittenCause.Thrown]: RoastRecovery.NeedsPerson,
}

export function recoveryOf(failure: RoastFailure): RoastRecovery {
  return RECOVERY_OF_CAUSE[failure.cause]
}

// The errors that the engine types name under ModelApiError as ones that may clear on their own,
// read on 2026-11-17.
const PASSING_API_ERRORS = [
  'rate_limit',
  'overloaded',
  'server_error',
] as const satisfies readonly ModelApiError[]

type PassingApiError = (typeof PASSING_API_ERRORS)[number]

/** An error of the API that does not clear on its own. */
export type LastingApiError = Exclude<ModelApiError, PassingApiError>

export function isPassingApiError(error: ModelApiError): error is PassingApiError {
  return PASSING_API_ERRORS.some(passing => passing === error)
}

/** Why a fork asked for a roast wrote no roast, with the facts of the cause. */
export type RoastFailure =
  | {
      cause:
        | RoastNotWrittenCause.NothingToFork
        | RoastNotWrittenCause.EmptyReply
        | RoastNotWrittenCause.Aborted
    }
  | { cause: RoastNotWrittenCause.ApiError; error: LastingApiError; status: number }
  | { cause: RoastNotWrittenCause.UnreadableReply; reason: JsonTextNotRead; reply: string }
  | { cause: RoastNotWrittenCause.Thrown; message: string }
