/** The limits of a random wait before the next try, in milliseconds. */
export type RetryWaits = { firstMs: number; longestMs: number }

/**
 * A random wait after the try numbered `tries`, up to a limit that doubles with each try from
 * `firstMs` until it reaches `longestMs`, so callers that failed together do not try again at the
 * same moment.
 */
export function randomWaitAfter(tries: number, { firstMs, longestMs }: RetryWaits): number {
  return Math.random() * Math.min(longestMs, firstMs * 2 ** (tries - 1))
}
