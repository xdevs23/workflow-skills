// The keys of the fields of an edited card in the Reminders pane, new for each opening of the card
// or each time its fields are drawn anew.

/** The key of the text field of a card with the fields `fieldsId`. */
export function textFieldKeyOf(fieldsId: string): string {
  return `text-${fieldsId}`
}

/** The key of the kind dropdown of the opening `openingId` of a card. */
export function kindDropdownKeyOf(openingId: string): string {
  return `kind-${openingId}`
}

/** The key of the value field with the key `fieldKey` of a card with the fields `fieldsId`. */
export function valueFieldKeyOf(fieldsId: string, fieldKey: string): string {
  return `field-${fieldsId}-${fieldKey}`
}

/**
 * The key of the button that removes the item at `index` of the list field with the key `fieldKey`,
 * on the opening `openingId` of a card.
 */
export function itemKeyOf(openingId: string, fieldKey: string, index: number): string {
  return `item-${openingId}-${fieldKey}-${index}`
}
