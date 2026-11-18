import { isRecord } from '../pluginStore'

/** What a fork asked for a roast decided. */
export enum RoastVerdict {
  Roast = 'roast',
  /** The complaint typed by the user is unfounded, so the fork wrote no roast. */
  Refused = 'refused',
}

/** The reply of a fork asked for a roast, as the JSON object asked for by the roast prompts. */
export type RoastReply =
  | { verdict: RoastVerdict.Roast; roast: string }
  | { verdict: RoastVerdict.Refused; reason: string }

/** The reply in `text`, or undefined for text of another shape or with an empty roast or reason. */
export function readRoastReply(text: string): RoastReply | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
  if (!isRecord(value)) {
    return undefined
  }
  const { verdict, roast, reason } = value
  if (verdict === RoastVerdict.Roast && isWrittenText(roast)) {
    return { verdict, roast: roast.trim() }
  }
  if (verdict === RoastVerdict.Refused && isWrittenText(reason)) {
    return { verdict, reason: reason.trim() }
  }

  return undefined
}

function isWrittenText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}
