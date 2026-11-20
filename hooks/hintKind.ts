import type { HintText } from './hintText'

/** The name of each hint kind, as the state of the session contains the kinds sent in a turn. */
export enum HintKindName {
  AcceptedGap = 'accepted gap',
  AnnouncedWork = 'announced work',
  AskedApproval = 'asked approval',
  AskedPermission = 'asked permission',
  Blocked = 'blocked',
  BuildWait = 'build wait',
  CostFraming = 'cost framing',
  HandedCall = 'handed call',
  HandedDecision = 'handed decision',
  HeldQuestion = 'held question',
  IdleReply = 'idle reply',
  NothingNeedsAction = 'nothing needs action',
  UnverifiedWork = 'unverified work',
  Waiting = 'waiting',
}

/**
 * A hint for the model, given as the reason when the end of a turn on a message with one of its
 * phrases outside quoted text is blocked.
 */
export type HintKind<Name extends HintKindName = HintKindName> = {
  name: Name
  phrases: readonly RegExp[]
  text: HintText
}
