import type { ClientKeyEvent } from 'claude-code'

/**
 * The names the surface writes in `key` for the special keys. Source: keys sent to the onKey
 * listener of a surface module by Claude Code 2.1.321 in the terminal, checked live on 2026-11-14.
 * Shift+Tab arrives as Tab with `shift`. Function keys and Insert arrive as the escape sequence
 * sent by the terminal. The surface sends typed text in the same field, so text typed in one burst
 * that equals a name, such as "end", is read as that key. A name missing from this list, such as
 * one sent by another surface, is read as typed text.
 */
export enum KeyName {
  Return = 'return',
  Tab = 'tab',
  Space = 'space',
  Backspace = 'backspace',
  Delete = 'delete',
  Up = 'up',
  Down = 'down',
  Left = 'left',
  Right = 'right',
  Home = 'home',
  End = 'end',
  PageUp = 'pageup',
  PageDown = 'pagedown',
}

/** The special key of `event`, or undefined for typed text or a key without a name. */
export function keyNameOf({ key }: ClientKeyEvent): KeyName | undefined {
  return isKeyName(key) ? key : undefined
}

function isKeyName(key: string): key is KeyName {
  return Object.values<string>(KeyName).includes(key)
}
