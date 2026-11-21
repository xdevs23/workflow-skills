import { ASKED_APPROVAL } from './askedApproval'
import { ASKED_PERMISSION } from './askedPermission'
import { COST_FRAMING } from './costFraming'
import { HANDED_CALL } from './handedCall'
import { HANDED_DECISION } from './handedDecision'
import type { Refusal } from './refusal'

/** Every shape of text refused at the end of a turn. */
export const REFUSALS: readonly Refusal[] = [
  HANDED_DECISION,
  ASKED_PERMISSION,
  ASKED_APPROVAL,
  HANDED_CALL,
  COST_FRAMING,
]
