import type { ElementTable, EngineInterface } from 'claude-code'

import type { CardDraft } from '../../types'
import type { SurfaceWithFields } from '../surfaces'
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

/** The elements of a surface with input fields that a list field is drawn with. */
type ListElements = Pick<ElementTable<SurfaceWithFields>, 'Box' | 'Button' | 'Input' | 'Text'>

/**
 * The list field `field` of the cadence of `card`: its items as `typed`, each on a row with its
 * remove button, above the field that adds the next item.
 */
export function drawListField(
  $: EngineInterface,
  { Box, Button, Input, Text }: ListElements,
  { card, typed, field }: { card: EditedCard; typed: CardDraft; field: ListCardField },
) {
  const { reminderId, openingId, fieldsId, opened } = card
  const key = valueFieldKeyOf(fieldsId, field.key)

  return (
    <Box key={`${key}-list`} flexDirection="column" flexGrow={1} flexShrink={1}>
      {itemsOfField(field, typed.cadence.values).map((item, index) => {
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
      })}
      <Input
        key={key}
        value={opened.nextItems[field.key] ?? ''}
        {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
        submitLabel={ADD_ITEM_SUBMIT}
        onInput={typed => typeIntoNextItemField($, reminderId, { key: field.key, typed })}
        onSubmit={typed => addItemOnEnter($, card, field, typed)}
      />
    </Box>
  )
}
