// The dropdowns drawn by a pane module: the one whose list is open, and the option picked in each.
// A press on the head of a dropdown opens or closes its list, and a press on any other control of
// the pane closes it.

/**
 * A value entered into a control, and the value the pane drew the control with at that moment. As
 * in an Input, the entered value shows until the pane draws the control with another value.
 */
export type EnteredValue = { value: string; drawnOver: string }

/** The value shown by a control drawn with `drawn`, once `entered` was entered into it. */
export function shownValueOf(entered: EnteredValue | undefined, drawn: string): string {
  return entered?.drawnOver === drawn ? entered.value : drawn
}

/** The dropdowns of a pane drawn by its surface module. */
export type PaneDropdowns = {
  /** The key of the dropdown whose list is open, null while every list is closed. */
  openDropdown: string | null
  /**
   * The option picked in each dropdown of the last drawing, by the key of the dropdown. A dropdown
   * drawn again after a drawing without it shows the value the pane draws it with.
   */
  picked: Readonly<Record<string, EnteredValue>>
}

export const NEW_DROPDOWNS: PaneDropdowns = { openDropdown: null, picked: {} }

/**
 * The dropdowns of a pane as they are at the call, and how they are changed. A change made by one
 * step of an event is seen by the next step of the same event.
 */
export type DropdownStore = {
  read: () => PaneDropdowns
  update: (change: (dropdowns: PaneDropdowns) => PaneDropdowns) => void
}

/** `dropdowns` with every list closed. */
export function withListsClosed(dropdowns: PaneDropdowns): PaneDropdowns {
  return dropdowns.openDropdown === null ? dropdowns : { ...dropdowns, openDropdown: null }
}

/** `dropdowns` with the list of the dropdown keyed `key` closed where open, and open otherwise. */
export function withListToggled(dropdowns: PaneDropdowns, key: string): PaneDropdowns {
  return { ...dropdowns, openDropdown: dropdowns.openDropdown === key ? null : key }
}

/**
 * `dropdowns` after the dropdowns keyed `drawn` are drawn: with the list of a dropdown no longer
 * drawn closed, and the picks of the dropdowns drawn. The same `dropdowns` where nothing changed.
 */
export function dropdownsAfterDrawing(
  drawn: readonly string[],
  dropdowns: PaneDropdowns,
): PaneDropdowns {
  const openDropdown = drawn.find(key => key === dropdowns.openDropdown) ?? null
  const picksDrawn = Object.entries(dropdowns.picked).filter(([key]) => drawn.includes(key))
  const isSamePicks = picksDrawn.length === Object.keys(dropdowns.picked).length

  return openDropdown === dropdowns.openDropdown && isSamePicks
    ? dropdowns
    : { openDropdown, picked: Object.fromEntries(picksDrawn) }
}
