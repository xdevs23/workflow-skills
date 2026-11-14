import type {
  ButtonProps,
  ClientElements,
  ElementChildren,
  InputProps,
  RenderElement,
  SelectProps,
} from 'claude-code'

// The elements a pane draws with. Its buttons, text inputs and dropdowns are drawn by the surface
// where the hooks module draws the pane, and by clientControls.tsx in its surface module.

/** A button of a pane. Every press calls its `onPress`. */
export type PaneButtonProps = Omit<ButtonProps, 'key' | 'onPress' | 'hotkey'> &
  ElementChildren & { key: string; onPress: () => Promise<void> | void }

/**
 * A text field of a pane, drawn with `value` until something is typed into it. Each change of its
 * text runs `onInput`, and Enter runs `onSubmit` with the text.
 */
export type TextInputProps = Pick<
  InputProps,
  'key' | 'label' | 'placeholder' | 'value' | 'autoFocus'
> & {
  submitLabel: string
  onInput?: (value: string) => Promise<void> | void
  onSubmit: (value: string) => Promise<void> | void
}

/** A dropdown of a pane, drawn on `value`, which a pick runs `onSelect` with. */
export type DropdownProps = Pick<SelectProps, 'key' | 'label' | 'options' | 'autoFocus'> & {
  value: string
  onSelect: (value: string) => Promise<void> | void
}

/** The elements of a pane, with its controls in place of the controls of the surface. */
export type PaneElements = Omit<ClientElements, 'Button' | 'Input' | 'Select'> & {
  Button: (props: PaneButtonProps) => RenderElement
  TextInput: (props: TextInputProps) => RenderElement
  Dropdown: (props: DropdownProps) => RenderElement
}

/** The elements of a surface that draws its controls itself: its Input and its Select. */
export function paneElementsOf({ Input, Select, ...elements }: ClientElements): PaneElements {
  return { ...elements, TextInput: Input, Dropdown: Select }
}
