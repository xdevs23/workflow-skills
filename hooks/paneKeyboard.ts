import type { ClientKeyEvent, ClientPointerEvent } from 'claude-code'

import { KeyName, keyNameOf } from './surfaceKeys'

// The focus of the controls drawn by a pane module, and the keys sent to it, which the focused
// control acts on. Tab and Shift+Tab move the focus in the order the controls are drawn.

/** The kinds of the controls that a pane module draws. */
export enum ControlKind {
  Button = 'button',
  TextInput = 'text-input',
  Dropdown = 'dropdown',
}

/**
 * The control with the focus, by its key and its place in the Tab order. A dropdown has the option
 * marked in its open list, null while the list is closed.
 */
export type ControlFocus = { key: string; index: number } & (
  | { kind: ControlKind.Button | ControlKind.TextInput }
  | { kind: ControlKind.Dropdown; marked: string | null }
)

/**
 * A value entered into a control, and the value the pane drew the control with at that moment. As
 * in an Input, the entered value shows until the pane draws the control with another value.
 */
export type EnteredValue = { value: string; drawnOver: string }

/** The value shown by a control drawn with `drawn`, once `entered` was entered into it. */
export function shownValueOf(entered: EnteredValue | undefined, drawn: string): string {
  return entered?.drawnOver === drawn ? entered.value : drawn
}

/** The keyboard of a pane drawn by its surface module. */
export type PaneKeyboard = {
  /**
   * Whether the keys went to the pane since it opened: the surface sent the module a key, or a
   * click outside the Buttons of the pane. The pane draws its focus only from then on.
   */
  hasKeys: boolean
  focus: ControlFocus | null
  /** The keys of the controls drawn with autoFocus in the last drawing. */
  autoFocusDrawn: readonly string[]
  /** The text typed into each text input, by the key of the text input. */
  typed: Readonly<Record<string, EnteredValue>>
  /**
   * The option picked in each dropdown of the last drawing, by the key of the dropdown. A dropdown
   * drawn again after a drawing without it shows the value the pane draws it with.
   */
  picked: Readonly<Record<string, EnteredValue>>
}

export const NEW_KEYBOARD: PaneKeyboard = {
  hasKeys: false,
  focus: null,
  autoFocusDrawn: [],
  typed: {},
  picked: {},
}

/**
 * The keyboard of a pane as it is at the call, and how it is changed. A change made by one step of
 * an event is seen by the next step of the same event.
 */
export type KeyboardStore = {
  read: () => PaneKeyboard
  update: (change: (keyboard: PaneKeyboard) => PaneKeyboard) => void
}

/** A control in the Tab order, and what a key does to it while it has the focus. */
export type TabStop = {
  key: string
  kind: ControlKind
  autoFocus: boolean
  onKey: (event: ClientKeyEvent) => Promise<void> | void
}

/**
 * The place in `tabOrder` of the control with the focus. Where that control is no longer drawn,
 * the focus moves to the first control with autoFocus drawn since, such as a text input opened by
 * a press, and to none where no such control was drawn.
 */
function focusedIndexOf(
  tabOrder: readonly TabStop[],
  { focus, autoFocusDrawn }: PaneKeyboard,
): number | undefined {
  const kept = tabOrder.findIndex(stop => stop.key === focus?.key)
  if (kept >= 0) {
    return kept
  }
  const opened = tabOrder.findIndex(stop => stop.autoFocus && !autoFocusDrawn.includes(stop.key))

  return opened >= 0 ? opened : undefined
}

/**
 * The place of the control that Tab, or Shift+Tab where `isBack`, moves the focus to from `index`
 * among `count` controls, around the end of the order: the first or the last from no focus.
 */
function tabbedIndexOf(count: number, index: number | undefined, isBack: boolean) {
  if (count === 0) {
    return undefined
  }
  const step = isBack ? -1 : 1

  return ((index ?? (isBack ? 0 : -1)) + step + count) % count
}

/**
 * `keyboard` with the focus on the control at `index` of `tabOrder`, none where `index` is
 * undefined. A focus moved to another control closes the list of a dropdown.
 */
export function withFocusAt(
  keyboard: PaneKeyboard,
  tabOrder: readonly TabStop[],
  index: number | undefined,
): PaneKeyboard {
  const stop = index === undefined ? undefined : tabOrder[index]
  const { focus } = keyboard
  if (stop === undefined || index === undefined) {
    return focus === null ? keyboard : { ...keyboard, focus: null }
  }
  if (stop.key === focus?.key) {
    return focus.index === index ? keyboard : { ...keyboard, focus: { ...focus, index } }
  }
  const moved = { key: stop.key, index }

  return {
    ...keyboard,
    focus:
      stop.kind === ControlKind.Dropdown
        ? { ...moved, kind: stop.kind, marked: null }
        : { ...moved, kind: stop.kind },
  }
}

/** The option marked in the open list of the dropdown keyed `key`, null where it is not open. */
export function markedIn({ focus }: PaneKeyboard, key: string): string | null {
  return focus?.key === key && focus.kind === ControlKind.Dropdown ? focus.marked : null
}

/** `keyboard` with `marked` marked in the list of the focused dropdown keyed `key`. */
export function withMarked(
  keyboard: PaneKeyboard,
  key: string,
  marked: string | null,
): PaneKeyboard {
  const { focus } = keyboard

  return focus?.key === key && focus.kind === ControlKind.Dropdown
    ? { ...keyboard, focus: { ...focus, marked } }
    : keyboard
}

/**
 * `keyboard` after the controls in `tabOrder` are drawn: with the focus where it moved, the
 * controls drawn with autoFocus, and the picks of the dropdowns drawn. The same `keyboard` where
 * nothing changed.
 */
export function keyboardAfterDrawing(
  tabOrder: readonly TabStop[],
  keyboard: PaneKeyboard,
): PaneKeyboard {
  const focused = withFocusAt(keyboard, tabOrder, focusedIndexOf(tabOrder, keyboard))
  const autoFocusDrawn = tabOrder.filter(each => each.autoFocus).map(each => each.key)
  const isSameAutoFocus =
    autoFocusDrawn.length === keyboard.autoFocusDrawn.length &&
    autoFocusDrawn.every((key, at) => key === keyboard.autoFocusDrawn[at])
  const picksDrawn = Object.entries(keyboard.picked).filter(([key]) =>
    tabOrder.some(stop => stop.key === key),
  )
  const isSamePicks = picksDrawn.length === Object.keys(keyboard.picked).length

  return focused === keyboard && isSameAutoFocus && isSamePicks
    ? keyboard
    : { ...focused, autoFocusDrawn, picked: Object.fromEntries(picksDrawn) }
}

/** `keyboard` with the keys in the pane, the same `keyboard` where they already are. */
function withKeys(keyboard: PaneKeyboard): PaneKeyboard {
  return keyboard.hasKeys ? keyboard : { ...keyboard, hasKeys: true }
}

/**
 * Sets `hasKeys` once `event` is a left click on the pane. The surface sends pointer
 * events only for clicks outside Buttons, and such a click sends every later key to the pane
 * (Claude Code 2.1.321, checked live in the terminal on 2026-11-14). The focus does not move,
 * since the event does not tell which part of the pane was clicked.
 */
export function sendPointerToPane(store: KeyboardStore, event: ClientPointerEvent): void {
  if (event.type === 'down' && event.button === 'left') {
    store.update(withKeys)
  }
}

/**
 * Sends `event` to the control with the focus in `tabOrder`. Tab and Shift+Tab move the focus to
 * the next and to the previous control.
 */
export function sendKeyToFocusedControl(
  tabOrder: readonly TabStop[],
  store: KeyboardStore,
  event: ClientKeyEvent,
): Promise<void> | void {
  store.update(withKeys)
  const index = focusedIndexOf(tabOrder, store.read())
  if (keyNameOf(event) === KeyName.Tab) {
    const tabbed = tabbedIndexOf(tabOrder.length, index, event.shift === true)
    store.update(keyboard => withFocusAt(keyboard, tabOrder, tabbed))
    return
  }
  if (index !== undefined) {
    return tabOrder[index]?.onKey(event)
  }
}
