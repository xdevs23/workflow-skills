import type { MessageAsRead } from './messagesUnseenByFork'

/** The newest messages of a transcript as a JSON array, and how many older ones it leaves out. */
export type TranscriptTail = { readonly json: string; readonly leftOut: number }

const encoder = new TextEncoder()

/**
 * The prompt written by `writePrompt` from the most of the newest messages of `transcript` that
 * fit `tokenBudget`. Where the newest message alone does not fit, each text in it is cut to the
 * longest length that fits.
 */
export function writePromptInBudget(
  transcript: readonly MessageAsRead[],
  tokenBudget: number,
  writePrompt: (tail: TranscriptTail) => string,
): string {
  // Each token of the model holds one byte of UTF-8 text or more, so a prompt takes no more tokens
  // than it has bytes.
  const fits = (tail: TranscriptTail) => encoder.encode(writePrompt(tail)).length <= tokenBudget
  const tailFrom = (start: number) => ({
    json: JSON.stringify(transcript.slice(start)),
    leftOut: start,
  })
  const start = findSmallestPassing(transcript.length, from => fits(tailFrom(from)))
  const newest = transcript.at(-1)
  if (start < transcript.length || newest === undefined) {
    return writePrompt(tailFrom(start))
  }
  const cutTail = (longest: number) => ({
    json: JSON.stringify([newest], (_key: string, value: unknown) =>
      typeof value === 'string' ? cutText(value, longest) : value,
    ),
    leftOut: transcript.length - 1,
  })
  const cut = findSmallestPassing(tokenBudget, shorter => fits(cutTail(tokenBudget - shorter)))

  return writePrompt(cutTail(tokenBudget - cut))
}

function cutText(text: string, longest: number): string {
  return text.length <= longest
    ? text
    : `${text.slice(0, longest)} [cut: ${text.length - longest} more characters]`
}

/**
 * The smallest whole number from 0 to `upTo` that `passes`, for a test that every number after a
 * passing one passes too. `upTo` where no smaller number passes.
 */
function findSmallestPassing(upTo: number, passes: (number: number) => boolean): number {
  let low = 0
  let high = upTo
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (passes(middle)) {
      high = middle
    } else {
      low = middle + 1
    }
  }

  return low
}
