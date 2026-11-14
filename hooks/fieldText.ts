import type { ClientKeyEvent } from 'claude-code'

import { KeyName, keyNameOf } from './surfaceKeys'

/** What each special key does to the text of a field: the edited text, or undefined for none. */
const EDIT_BY_KEY: Record<KeyName, (text: string) => string | undefined> = {
  [KeyName.Backspace]: text => [...text].slice(0, -1).join(''),
  [KeyName.Space]: text => `${text} `,
  [KeyName.Return]: () => undefined,
  [KeyName.Tab]: () => undefined,
  [KeyName.Delete]: () => undefined,
  [KeyName.Up]: () => undefined,
  [KeyName.Down]: () => undefined,
  [KeyName.Left]: () => undefined,
  [KeyName.Right]: () => undefined,
  [KeyName.Home]: () => undefined,
  [KeyName.End]: () => undefined,
  [KeyName.PageUp]: () => undefined,
  [KeyName.PageDown]: () => undefined,
}

// The surface sends characters typed in quick succession and a paste as one key. A line break or
// a tab in it becomes one space, since a field contains one line. A key with any other control
// character, such as Escape, is the escape sequence of a key without a name, e.g. a function key.
const LINE_BREAKS_AND_TABS = /[\r\n\t]+/u
const OTHER_CONTROL_CHARACTER = /[^\P{Cc}\r\n\t]/u

/** The text typed by a key without a name, on one line, or undefined where it types none. */
function typedTextOf({ key }: ClientKeyEvent): string | undefined {
  if (OTHER_CONTROL_CHARACTER.test(key)) {
    return undefined
  }
  const typed = key.split(LINE_BREAKS_AND_TABS).filter(part => part !== '').join(' ')

  return typed === '' ? undefined : typed
}

/**
 * `text` after `event`: with the typed text or a space appended, or with its last character
 * removed by Backspace. Undefined for a key that does not edit text, and for any key held with
 * Ctrl or Meta.
 */
export function editedBy(text: string, event: ClientKeyEvent): string | undefined {
  if (event.ctrl === true || event.meta === true) {
    return undefined
  }
  const name = keyNameOf(event)
  if (name !== undefined) {
    return EDIT_BY_KEY[name](text)
  }
  const typed = typedTextOf(event)

  return typed === undefined ? undefined : text + typed
}
