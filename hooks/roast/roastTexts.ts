import type { ModelApiError } from 'claude-code'

import type { HookSubject } from '../hookFailure'
import { RoastNotWrittenCause } from './roastFailure'
import type { LastingApiError, RoastFailure } from './roastFailure'
import { ROAST_COMMAND } from './roastNames'

export const PANE_TITLE = 'Roast'

export const ROAST_DESCRIPTION =
  'Roast this session where it disregarded the rules it was given or the facts, and send the ' +
  'roast to Claude'

export const ROAST_SUBJECT: HookSubject = { name: 'roast' }

export const WRITING_ROAST_NOTICE = 'Writing the roast about this session.'

export const NO_ROAST = `Run /${ROAST_COMMAND} to roast this session.`

export const SEND_LABEL = 'Send roast'

export const SENDING_ROAST_NOTICE = 'Sending the roast to Claude.'

export const COMMENT_LABEL = 'Comment'

export const COMMENT_PLACEHOLDER = 'Your words, sent before the roast'

export const COMMENT_SUBMIT_LABEL = 'send'

export const ROAST_TO_OTHER_SESSION =
  'The roast was not sent: another session runs by now, and the roast was written for the one ' +
  `before. Run /${ROAST_COMMAND} in this session.`

export function describeNotRegistered(reason: string): string {
  return (
    `/${ROAST_COMMAND} could not be registered, so this session cannot be roasted: ${reason}. ` +
    `If another plugin uses the name /${ROAST_COMMAND}, turn that plugin off and start a new ` +
    'session. The debug log has this too.'
  )
}

const RUN_AGAIN = `/${ROAST_COMMAND} again`

/** The next step after an error of the API that does not clear on its own. */
const NEXT_STEP_AFTER_API_ERROR: Record<LastingApiError, string> = {
  authentication_failed: `Log in again with /login, then run ${RUN_AGAIN}.`,
  oauth_org_not_allowed:
    `Log in with /login to an account whose organization may use Claude Code, then run ` +
    `${RUN_AGAIN}.`,
  account_on_hold: `Resolve the hold on the account, then run ${RUN_AGAIN}.`,
  verification_required: `Verify the account, then run ${RUN_AGAIN}.`,
  billing_error: `Check the billing of the account, then run ${RUN_AGAIN}.`,
  invalid_request: `Run /compact to shorten the conversation, then run ${RUN_AGAIN}.`,
  model_not_found: `Pick another model with /model, then run ${RUN_AGAIN}.`,
  max_output_tokens: `Run ${RUN_AGAIN}.`,
  cloud_credential_error: `Renew the credentials for the cloud provider, then run ${RUN_AGAIN}.`,
  unknown: `Run ${RUN_AGAIN}.`,
}

/** The text for a run of /roast that ended without a roast, with the next step. */
export function describeRoastNotWritten(failure: RoastFailure): string {
  switch (failure.cause) {
    case RoastNotWrittenCause.NothingToFork:
      return (
        'A fork cannot write the roast before Claude has finished a request in this session. ' +
        `Run ${RUN_AGAIN} once it has.`
      )
    case RoastNotWrittenCause.ApiError:
      return (
        `The roast could not be written: the API returned the error ${failure.error} (status ` +
        `${failure.status}). ${NEXT_STEP_AFTER_API_ERROR[failure.error]}`
      )
    case RoastNotWrittenCause.EmptyReply:
      return `The roast came back without text. Run ${RUN_AGAIN}.`
    case RoastNotWrittenCause.Aborted:
      return `The roast was cut off before it arrived. Run ${RUN_AGAIN}.`
    case RoastNotWrittenCause.Thrown:
      return `The roast could not be written: ${failure.message}. Run ${RUN_AGAIN}.`
  }
}

/** The notice for a roast written again after the try `failedTries` failed with `error`. */
export function describeWritingAgain(
  { failedTries, error }: { failedTries: number; error: ModelApiError },
): string {
  return (
    `Writing the roast about this session, try ${failedTries + 1}. The try before failed with ` +
    `the API error ${error}.`
  )
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
