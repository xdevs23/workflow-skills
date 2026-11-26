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
  /** Where set, the roaster writes the note on the hint in place of `text`. */
  roaster?: HintRoaster
}

/**
 * What goes to the model from a roasted hint kind whose roaster does not find a point in the
 * message.
 */
export enum HintWithoutPoint {
  /** The text of the kind, since its phrases alone show that the hint applies. */
  Text = 'text',
  /** Nothing, since its phrases also match messages that the hint does not concern. */
  Nothing = 'nothing',
}

/** How long the roast on a hint of a roasted kind waits to be written. */
export enum HintRoastKept {
  /** Until the next turn starts, since the model that resumes carries on with the work it named. */
  UntilTurnStart = 'until turn start',
  /**
   * Until the user sends a message, since a turn started by a notification leaves what the hint
   * names standing.
   */
  UntilUserMessage = 'until user message',
}

/** How the roaster writes the note on a hint of a roasted kind. */
export type HintRoaster = {
  /**
   * The sentences of the prompt of the roaster that describe what the roast on a message with a
   * phrase of this kind covers.
   */
  task: string
  withoutPoint: HintWithoutPoint
  kept: HintRoastKept
}

/** A hint kind whose note the roaster writes. */
export type RoastedHintKind = HintKind & { roaster: HintRoaster }

export function isRoastedHintKind(kind: HintKind): kind is RoastedHintKind {
  return kind.roaster !== undefined
}

export function namesOfHintKinds(kinds: readonly HintKind[]): HintKindName[] {
  return kinds.map(kind => kind.name)
}
