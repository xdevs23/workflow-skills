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

/** The verdicts that the prompt of roast_work offers its fork. */
export enum VerificationRoastVerdict {
  Roast = 'roast',
  /** The transcript proves no point in the work on the change, so the fork wrote no roast. */
  NoPoint = 'no-point',
}

/**
 * The points of a roast for roast_work, in two lists, at least one of them written. Points on the
 * change name what the files of the change still show. Points on the process name how the work was
 * done, which no file of the change shows.
 */
export type VerificationRoastPoints =
  | { changePoints: string; processPoints?: string }
  | { changePoints?: string; processPoints: string }

/** The JSON object that the prompt of roast_work asks its fork to reply with. */
export type VerificationRoastReply =
  | ({ verdict: VerificationRoastVerdict.Roast } & VerificationRoastPoints)
  | { verdict: VerificationRoastVerdict.NoPoint }

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

export function readRoastReply(text: string): JsonTextRead<RoastReply> {
  return readJsonText(text, toRoastReply)
}

export function readIdleRoastReply(text: string): JsonTextRead<IdleRoastReply> {
  return readJsonText(text, value =>
    toRoastOrNoneReply(value, IdleRoastVerdict.Roast, IdleRoastVerdict.NoBlockingPoint),
  )
}

export function readVerificationRoastReply(text: string): JsonTextRead<VerificationRoastReply> {
  return readJsonText(text, toVerificationRoastReply)
}

export function readCompactionRoastReply(text: string): JsonTextRead<CompactionRoastReply> {
  return readJsonText(text, value =>
    toRoastOrNoneReply(value, CompactionRoastVerdict.Roast, CompactionRoastVerdict.NoPoint),
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
 * `value` as a reply to roast_work, or undefined for a value of another shape, for a list that is
 * neither written text nor left out, or for a roast without a written list.
 */
function toVerificationRoastReply(value: unknown): VerificationRoastReply | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  if (value.verdict === VerificationRoastVerdict.NoPoint) {
    return { verdict: value.verdict }
  }
  if (
    value.verdict !== VerificationRoastVerdict.Roast ||
    !isWrittenTextOrLeftOut(value.changePoints) ||
    !isWrittenTextOrLeftOut(value.processPoints)
  ) {
    return undefined
  }
  const changePoints = readWrittenText(value.changePoints)
  const processPoints = readWrittenText(value.processPoints)
  if (changePoints !== undefined) {
    return {
      verdict: value.verdict,
      changePoints,
      ...(processPoints === undefined ? {} : { processPoints }),
    }
  }

  return processPoints === undefined ? undefined : { verdict: value.verdict, processPoints }
}

/** Whether `field` of a reply is written text, or left out as a list without points is. */
function isWrittenTextOrLeftOut(field: unknown): boolean {
  return field === undefined || readWrittenText(field) !== undefined
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
