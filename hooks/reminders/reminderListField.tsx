import type { ElementTable, EngineInterface } from 'claude-code'

import type { CardDraft } from '../../types'
import type { FieldUnderCard } from '../cardFields'
import { itemsOfField } from './cadenceKind'
import type { ListCardField } from './cadenceKind'
import {
  addItemOnEnter,
  itemKeyOf,
  removeListItem,
  typeIntoNextItemField,
  valueFieldKeyOf,
} from './reminderPresses'
import type { EditedCard } from './reminderPresses'
import { ADD_ITEM_SUBMIT, REMOVE_ITEM_MARK, describeRemoveItem } from './reminderTexts'

/**
 * The items of the list field `field` of `card` as `typed`, each on a row with its remove button.
 */
export function drawListItems(
  $: EngineInterface,
  { Box, Button, Text }: Pick<ElementTable, 'Box' | 'Button' | 'Text'>,
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
          onPress={() => removeListItem($, reminderId, field, { index, item })}
        >
          {REMOVE_ITEM_MARK}
        </Button>
      </Box>
    )
  })
}

/** The field labeled as the list field `field` of `card`, whose Enter adds the next item. */
export function nextItemFieldOf(
  $: EngineInterface,
  { card, field }: { card: EditedCard; field: ListCardField },
): FieldUnderCard {
  const { reminderId, fieldsId, opened } = card

  return {
    key: valueFieldKeyOf(fieldsId, field.key),
    label: field.label,
    value: opened.nextItems[field.key] ?? '',
    ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
    submitLabel: ADD_ITEM_SUBMIT,
    onInput: typed => typeIntoNextItemField($, reminderId, { key: field.key, typed }),
    onSubmit: typed => addItemOnEnter($, card, field, typed),
  }
}
