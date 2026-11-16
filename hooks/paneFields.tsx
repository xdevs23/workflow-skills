import type { RenderElement } from 'claude-code'

import type { PaneElements, TextInputProps } from './paneElements'

// Claude Code 2.1.321, checked live in the terminal on 2026-11-14: an Input inside a Client never
// gets a key, while an Input drawn by the hooks module next to a Client has a caret, a bracketed
// paste goes into it, its text can be selected, and it still gets typing after a click on a Button
// of the Client. So the surface module of a pane draws no text field. It posts the text fields of
// its drawing, and the hooks module draws them as Input above the module. The hooks module records
// the text typed into each field without drawing the pane again, and sends the module each Enter
// and the texts typed by the time of each press that saves them, as field events.

/** A text field of a pane, posted by its surface module and drawn by the hooks module. */
export type PaneField = Omit<TextInputProps, 'onSubmit'>

/** The texts typed into the fields of a pane, by the key of the field. */
export type TypedTexts = Readonly<Record<string, string>>

/** What the hooks module sends to the surface module of a pane about its text fields. */
export enum FieldEventKind {
  /** Enter in a text field. */
  Submit = 'submit',
  /** The texts typed by the time of a press of the module that saves them. */
  Press = 'press',
}

/**
 * A field event before the hooks module numbered it: Enter in the field keyed `field` with its
 * whole text, under an id new to the Enter, or the answer to the press with the id `eventId` that
 * waits for the typed texts. Both contain the texts typed into the fields by then.
 */
export type UnnumberedFieldEvent = { eventId: string; typed: TypedTexts } & (
  | { kind: FieldEventKind.Submit; field: string; text: string }
  | { kind: FieldEventKind.Press }
)

/**
 * A field event, numbered in the order recorded by the hooks module, so a drawing sent late does
 * not run an event a second time.
 */
export type FieldEvent = UnnumberedFieldEvent & { number: number }

/** A text field of a drawing of a pane, and what Enter in it runs. */
export type DrawnField = { shown: PaneField; onSubmit: (text: string) => void }

/** What `draw` drew with a TextInput that draws nothing, and the text fields drawn with it. */
export function drawCollectingFields(
  elements: PaneElements,
  draw: (elements: PaneElements) => RenderElement,
): { drawn: RenderElement; fields: readonly DrawnField[] } {
  const { Box } = elements
  const fields: DrawnField[] = []
  const drawn = draw({
    ...elements,
    TextInput: ({ onSubmit, ...shown }) => {
      fields.push({ shown, onSubmit })

      return <Box key={shown.key} />
    },
  })

  return { drawn, fields }
}

/** The events of `events` numbered after `applied`, all of them before the first was applied. */
export function eventsAfter(
  events: readonly FieldEvent[],
  applied: number | null,
): readonly FieldEvent[] {
  return applied === null ? events : events.filter(({ number }) => number > applied)
}
