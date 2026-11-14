/** The fields of an edited card that get the focus, through their autoFocus. */
export enum CardFocus {
  Text = 'text',
  NextItem = 'next-item',
}

/**
 * The field of an edited card that gets the focus: its text field, or the field that adds the next
 * item to the list field with the key `key`.
 */
export type FieldFocus = { field: CardFocus.Text } | { field: CardFocus.NextItem; key: string }
