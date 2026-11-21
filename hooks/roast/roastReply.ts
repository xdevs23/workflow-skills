import { readJsonText } from '../jsonText'
import type { JsonTextRead } from '../jsonText'
import { isRecord } from '../pluginStore'

/** The verdicts that the prompt of /roast offers its fork. */
export enum RoastVerdict {
  Roast = 'roast',
  /** The complaint typed by the user is unfounded, so the fork wrote no roast. */
  Refused = 'refused',
}

/** The JSON object that the prompt of /roast asks its fork to reply with. */
export type RoastReply =
  | { verdict: RoastVerdict.Roast; roast: string }
  | { verdict: RoastVerdict.Refused; reason: string }

/** The verdicts that the prompt of the idle roast offers its fork. */
export enum IdleRoastVerdict {
  Roast = 'roast',
  /** No point blocks the work, so the fork wrote no roast. */
  NoBlockingPoint = 'no-blocking-point',
}

/** The JSON object that the prompt of the idle roast asks its fork to reply with. */
export type IdleRoastReply =
  | { verdict: IdleRoastVerdict.Roast; roast: string }
  | { verdict: IdleRoastVerdict.NoBlockingPoint }

/** The verdicts that the prompt of the compaction roast offers its fork. */
export enum CompactionRoastVerdict {
  Roast = 'roast',
  /** The transcript before the compaction proves no point, so the fork wrote no roast. */
  NoPoint = 'no-point',
}

/** The JSON object that the prompt of the compaction roast asks its fork to reply with. */
export type CompactionRoastReply =
  | { verdict: CompactionRoastVerdict.Roast; roast: string }
  | { verdict: CompactionRoastVerdict.NoPoint }

/** The verdicts that the prompt of the roast on hints offers the fork. */
export enum HintRoastVerdict {
  Roast = 'roast',
  /** The transcript proves no point on the last reply, so the fork wrote no roast. */
  NoPoint = 'no-point',
}

/** The JSON object that the prompt of the roast on hints asks the fork to reply with. */
export type HintRoastReply =
  | { verdict: HintRoastVerdict.Roast; roast: string }
  | { verdict: HintRoastVerdict.NoPoint }

export function readRoastReply(text: string): JsonTextRead<RoastReply> {
  return readJsonText(text, toRoastReply)
}

export function readIdleRoastReply(text: string): JsonTextRead<IdleRoastReply> {
  return readJsonText(text, value =>
    toRoastOrNoneReply(value, IdleRoastVerdict.Roast, IdleRoastVerdict.NoBlockingPoint),
  )
}

export function readCompactionRoastReply(text: string): JsonTextRead<CompactionRoastReply> {
  return readJsonText(text, value =>
    toRoastOrNoneReply(value, CompactionRoastVerdict.Roast, CompactionRoastVerdict.NoPoint),
  )
}

export function readHintRoastReply(text: string): JsonTextRead<HintRoastReply> {
  return readJsonText(text, value =>
    toRoastOrNoneReply(value, HintRoastVerdict.Roast, HintRoastVerdict.NoPoint),
  )
}

/** `value` as a reply to /roast, or undefined for a value of another shape or with empty text. */
function toRoastReply(value: unknown): RoastReply | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const roast = readWrittenText(value.roast)
  const reason = readWrittenText(value.reason)
  if (value.verdict === RoastVerdict.Roast && roast !== undefined) {
    return { verdict: value.verdict, roast }
  }
  if (value.verdict === RoastVerdict.Refused && reason !== undefined) {
    return { verdict: value.verdict, reason }
  }

  return undefined
}

/**
 * `value` as a reply with the verdict `roastVerdict` and a roast, or with the verdict `noneVerdict`
 * alone, or undefined for a value of another shape.
 */
function toRoastOrNoneReply<RoastVerdictOf extends string, NoneVerdictOf extends string>(
  value: unknown,
  roastVerdict: RoastVerdictOf,
  noneVerdict: NoneVerdictOf,
): { verdict: RoastVerdictOf; roast: string } | { verdict: NoneVerdictOf } | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const roast = readWrittenText(value.roast)
  if (value.verdict === roastVerdict && roast !== undefined) {
    return { verdict: roastVerdict, roast }
  }
  if (value.verdict === noneVerdict) {
    return { verdict: noneVerdict }
  }

  return undefined
}

/** The trimmed text in `value`, or undefined for a value that is not text or has only spaces. */
function readWrittenText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const text = value.trim()

  return text === '' ? undefined : text
}
