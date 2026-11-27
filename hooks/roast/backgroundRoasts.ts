// The background roast started last, so the next one starts only once it ended.
let lastRoast: Promise<void> = Promise.resolve()

/**
 * Runs `roast` once every background roast started before it ended, also one that failed, so one
 * background roast runs at a time. Returns the run of `roast`, which fails where `roast` fails.
 */
export function runAfterEarlierRoasts(roast: () => Promise<void>): Promise<void> {
  const start = () => roast()
  const run = lastRoast.then(start, start)
  lastRoast = run

  return run
}
