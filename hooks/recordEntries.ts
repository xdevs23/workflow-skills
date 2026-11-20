/**
 * `record` with the entry `key` set to `value`, or without the entry `key` where `value` is
 * undefined.
 */
export function withEntry<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
  value: T | undefined,
): Record<string, T> {
  const others = Object.entries(record ?? {}).filter(([entryKey]) => entryKey !== key)

  return Object.fromEntries(value === undefined ? others : [...others, [key, value]])
}
