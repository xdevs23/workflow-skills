/** `text` as the source of a regular expression that matches exactly `text`. */
export function regExpLiteralOf(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
}
