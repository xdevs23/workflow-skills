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
 * A hint on a message that ends a turn with one of its phrases outside quoted text. The roaster
 * reads `text` and writes the note to the model, where it finds a point.
 */
export type HintKind<Name extends HintKindName = HintKindName> = {
  name: Name
  phrases: readonly RegExp[]
  text: HintText
  roaster: HintRoaster
}

/** How long the roast on a hint waits to be written. */
export enum HintRoastKept {
  /** Until the next turn starts, since the model that resumes carries on with the work it named. */
  UntilTurnStart = 'until turn start',
  /**
   * Until the user sends a message, since a turn started by a notification leaves what the hint
   * names standing.
   */
  UntilUserMessage = 'until user message',
}

/** How the roaster writes the note on a hint. */
export type HintRoaster = {
  /**
   * The sentences of the prompt of the roaster that describe what the roast on a message with a
   * phrase of this kind covers.
   */
  task: string
  kept: HintRoastKept
}

export function namesOfHintKinds(kinds: readonly HintKind[]): HintKindName[] {
  return kinds.map(kind => kind.name)
}
