import type { CardDraft } from '../../types'
import type { FieldUnderCard } from '../cardFields'
import type { PaneElements } from '../paneElements'
import { itemsOfField } from './cadenceKind'
import type { ListCardField } from './cadenceKind'
import { addedItem, removedItem, typedNextItem } from './reminderCardState'
import type { EditedCard, RemindersPaneControls } from './reminderCardState'
import { itemKeyOf, valueFieldKeyOf } from './reminderKeys'
import { ADD_ITEM_SUBMIT, REMOVE_ITEM_MARK, describeRemoveItem } from './reminderPaneTexts'

/**
 * The items of the list field `field` of `card` as `typed`, each on a row with its remove button.
 */
export function drawListItems(
  pane: RemindersPaneControls,
  { Box, Button, Text }: PaneElements,
  { card, typed, field }: { card: EditedCard; typed: CardDraft; field: ListCardField },
) {
  const { reminderId, openingId } = card

  return itemsOfField(field, typed.cadence.values).map((item, index) => {
    const itemKey = itemKeyOf(openingId, field.key, index)

    return (
      <Box key={`${itemKey}-row`} columnGap={1}>
        <Text>{item}</Text>
        <Button
          key={itemKey}
          label={describeRemoveItem(item)}
          dimColor
          onPress={() =>
            pane.act(local => ({ local: removedItem(local, reminderId, field, { index, item }) }))
          }
        >
          {REMOVE_ITEM_MARK}
        </Button>
      </Box>
    )
  })
}

/**
 * The field labeled as the list field `field` of `card`, whose Enter adds the next item. It gets
 * the focus while the card has it on this field.
 */
export function nextItemFieldOf(
  pane: RemindersPaneControls,
  { card, field, hasFocus }: { card: EditedCard; field: ListCardField; hasFocus: boolean },
): FieldUnderCard {
  const { reminderId, fieldsId, opened } = card

  return {
    key: valueFieldKeyOf(fieldsId, field.key),
    label: field.label,
    value: opened.nextItems[field.key] ?? '',
    ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
    ...(hasFocus ? { autoFocus: true } : {}),
    submitLabel: ADD_ITEM_SUBMIT,
    onInput: typed =>
      pane.act(local => ({ local: typedNextItem(local, reminderId, { key: field.key, typed }) })),
    onSubmit: typed => pane.act(local => ({ local: addedItem(local, reminderId, field, typed) })),
  }
}
