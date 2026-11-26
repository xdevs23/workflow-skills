// Whether the idle stretch of the main conversation already got a roast, or a reply that no point
// blocks the work.
let isMainStretchRoasted = false

export function isStretchRoasted(): boolean {
  return isMainStretchRoasted
}

export function recordStretchRoast(): void {
  isMainStretchRoasted = true
}

export function endStretch(): void {
  isMainStretchRoasted = false
}
