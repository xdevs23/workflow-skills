/** The items in the order of their numbers, the order the user and the model read them in. */
export function sortedByNumber<Numbered extends { readonly number: number }>(
  items: readonly Numbered[],
): Numbered[] {
  return [...items].sort((first, second) => first.number - second.number)
}
