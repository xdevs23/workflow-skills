/**
 * Whether the value is a whole number from 1 up, as the numbers named by the user and the model
 * are.
 */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
