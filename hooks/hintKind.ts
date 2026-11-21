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
  /**
   * The sentences of the prompt of the roaster that say what the roast on a message with a phrase
   * of this kind names. Where set, the roaster writes the note on the hint in place of `text`.
   */
  roasterTask?: string
}

/** A hint kind whose note the roaster writes. */
export type RoastedHintKind = HintKind & { roasterTask: string }

export function isRoastedHintKind(kind: HintKind): kind is RoastedHintKind {
  return kind.roasterTask !== undefined
}
