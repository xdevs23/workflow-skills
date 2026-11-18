import type { ModelApiError } from 'claude-code'

/** Why a run of /roast ended without a roast. */
export enum RoastNotWrittenCause {
  NothingToFork = 'nothing to fork',
  ApiError = 'api error',
  EmptyReply = 'empty reply',
  Aborted = 'aborted',
  /** The reply is not the JSON object asked for by the roast prompts. */
  UnreadableReply = 'unreadable reply',
  Thrown = 'thrown',
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

/** Why a run of /roast ended without a roast, with the facts of the cause. */
export type RoastFailure =
  | {
      cause:
        | RoastNotWrittenCause.NothingToFork
        | RoastNotWrittenCause.EmptyReply
        | RoastNotWrittenCause.Aborted
    }
  | { cause: RoastNotWrittenCause.ApiError; error: LastingApiError; status: number }
  | { cause: RoastNotWrittenCause.UnreadableReply; reply: string }
  | { cause: RoastNotWrittenCause.Thrown; message: string }
