import type { ClientKeyEvent } from 'claude-code'

/**
 * The names the surface writes in `key` for the special keys read by the controls of a pane
 * module. Source: keys sent to the onKey listener of a surface module by Claude Code 2.1.321 in the
 * terminal, checked live on 2026-11-14. Shift+Tab arrives as Tab with `shift`.
 */
export enum KeyName {
  Return = 'return',
  Tab = 'tab',
  Space = 'space',
  Up = 'up',
  Down = 'down',
}

/** The special key of `event`, or undefined for typed text or a key without a name. */
export function keyNameOf({ key }: ClientKeyEvent): KeyName | undefined {
  return isKeyName(key) ? key : undefined
}

function isKeyName(key: string): key is KeyName {
  return Object.values<string>(KeyName).includes(key)
}
