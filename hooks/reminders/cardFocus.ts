/** The fields of a card that a press moves the focus to. */
export enum CardFocus {
  Text = 'text',
  NextItem = 'next-item',
}

/** A field of a card, with the number of the card. */
export type FocusTarget = { field: CardFocus; number: number }
