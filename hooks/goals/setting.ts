import type { Setting } from '../../types'

/** The setting of `value` at `setAt`, or of the removal of a value when it is undefined. */
export function settingOf<Value>(value: Value | undefined, setAt: number): Setting<Value> {
  return value === undefined ? { setAt } : { value, setAt }
}
