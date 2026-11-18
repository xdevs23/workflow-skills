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

export function readRoastReply(text: string): JsonTextRead<RoastReply> {
  return readJsonText(text, toRoastReply)
}

export function readIdleRoastReply(text: string): JsonTextRead<IdleRoastReply> {
  return readJsonText(text, toIdleRoastReply)
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

/** `value` as a reply to the idle roast, or undefined for a value of another shape. */
function toIdleRoastReply(value: unknown): IdleRoastReply | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const roast = readWrittenText(value.roast)
  if (value.verdict === IdleRoastVerdict.Roast && roast !== undefined) {
    return { verdict: value.verdict, roast }
  }
  if (value.verdict === IdleRoastVerdict.NoBlockingPoint) {
    return { verdict: value.verdict }
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
