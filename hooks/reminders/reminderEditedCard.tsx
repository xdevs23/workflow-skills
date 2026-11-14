import type { RenderElement } from 'claude-code'

import type { CardDraft, CardInPane, CardWarning } from '../../types'
import { drawCardWithFields } from '../cardFields'
import type { FieldUnderCard } from '../cardFields'
import type { PaneButtonProps, PaneElements } from '../paneElements'
import type { PaneStep } from '../paneModule'
import { DONE_LABEL } from '../paneTexts'
import {
  FieldKind,
  FieldPlace,
  fieldsPlacedAt,
  isListField,
  kindOf,
  labelOf,
  optionsOf,
  valueOfField,
} from './cadenceKind'
import type { CadenceKinds, CardField, ChoiceField, ListCardField, TextField } from './cadenceKind'
import { CardFocus } from './cardFocus'
import {
  CardMode,
  endedCard,
  isCardInMode,
  pickedKind,
  saveActionOf,
  saveAndSwitchActionOf,
  typedText,
  typedValue,
} from './reminderCardState'
import type { EditedCard, EditingCard, RemindersPaneControls } from './reminderCardState'
import { kindDropdownKeyOf, textFieldKeyOf, valueFieldKeyOf } from './reminderKeys'
import { drawListItems, nextItemFieldOf } from './reminderListField'
import type { ReminderPaneAction } from './reminderPaneMessages'
import {
  BLANK_TEXT_WARNING,
  CADENCE_LABEL,
  OFF_LABEL,
  ON_LABEL,
  REMOVE_LABEL,
  TEXT_LABEL,
  TEXT_PLACEHOLDER,
  UNKNOWN_CADENCE,
} from './reminderPaneTexts'
import { Refusal } from './reminders'
import type { NextSends } from './reminderState'

// The card of the Reminders pane being edited, with its fields, and the parts of a card shared by
// every card of the pane.

/**
 * What the cards of the pane share as it is drawn: the presses, the elements, the cadence kinds,
 * the time the pane is drawn at, and the next send times put by the cadence kinds.
 */
export type DrawnPane = {
  pane: RemindersPaneControls
  elements: PaneElements
  kinds: CadenceKinds
  now: number
  nextSends: NextSends
}

/**
 * The press that saves the card `card` with the save `actionOf` makes of it, once `typed` is what
 * the press changed in the state of the pane, while that card is edited.
 */
function saveStepOf(
  typed: CardInPane | null,
  card: EditedCard,
  actionOf: (edited: EditingCard) => ReminderPaneAction,
): PaneStep<CardInPane | null, ReminderPaneAction> {
  return isCardInMode(typed, card.reminderId, CardMode.Editing)
    ? { local: typed, save: actionOf(typed) }
    : {}
}
/** Shows the yes and the keep of a removal in place of the buttons of the card. */
export function askToRemove({ pane }: DrawnPane, reminderId: string) {
  return pane.act(() => ({ local: { reminderId, mode: CardMode.WaitingForYes } }))
}

/**
 * The card `card` with its cadence and its switch, Done and Remove, and under it the fields its
 * text and the values of its cadence are typed into. The warning from the last save is drawn after
 * the fields it is about, or in the card for the kind of the cadence. Remove on a card not stored
 * yet drops the card. Every field is drawn with what its fields were last drawn anew with, and the
 * engine stores what is typed and picked after that: a value drawn anew after every change would
 * replace the typing that arrived meanwhile. The labels of the fields and of the options, and the
 * items of a list, follow what is typed into `edited`, which also marks the field with the focus.
 */
export function drawEditedCard(
  context: DrawnPane,
  edited: EditingCard,
  card: EditedCard,
  { isEnabled, isStored }: { isEnabled: boolean; isStored: boolean },
) {
  const { pane, elements, kinds } = context
  const { Box, Button, Text } = elements
  const { number, reminderId, fieldsId, opened } = card
  const { draft: typed, warning, focus } = edited
  const fields = kindOf(kinds, opened.cadence.kind)?.fields ?? []
  const labelColumns = labelColumnsOf(kinds)
  const values = { card, typed, fields }
  const warnings = warningsOf(warning)
  const box = (
    <Box
      key={`reminder-${number}`}
      borderStyle="round"
      borderColor={warning === undefined ? 'suggestion' : 'warning'}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {drawFieldLine(elements, labelColumns, CADENCE_LABEL, [
          drawKindDropdown(context, card),
          ...fieldsPlacedAt(fields, FieldPlace.BesideKindDropdown).map(({ field }) =>
            drawDropdown(context, values, field),
          ),
        ])}
        {fieldsPlacedAt(fields, FieldPlace.LineInCard).map(({ field, label }) =>
          drawFieldLine(elements, labelColumns, label, [drawDropdown(context, values, field)]),
        )}
        {fields
          .filter(isListField)
          .flatMap(field => drawListItems(pane, elements, { card, typed, field }))}
        {warnings.inCard !== undefined && <Text color="warning">{warnings.inCard}</Text>}
        <Box justifyContent="flex-end" flexWrap="wrap">
          {drawSwitch(elements, number, isEnabled, () =>
            pane.act(local =>
              saveStepOf(local, card, saved => saveAndSwitchActionOf(saved, number, !isEnabled)),
            ),
          )}
          <Button
            key={`done-${number}`}
            label={DONE_LABEL}
            onPress={() =>
              pane.act(local => saveStepOf(local, card, saved => saveActionOf(saved, number)))
            }
          />
          <Button
            key={`remove-${number}`}
            label={REMOVE_LABEL}
            dimColor
            onPress={() =>
              isStored
                ? askToRemove(context, reminderId)
                : pane.act(local => ({ local: endedCard(local, reminderId, CardMode.Editing) }))
            }
          />
        </Box>
      </Box>
    </Box>
  )

  const textField: FieldUnderCard = {
    key: textFieldKeyOf(fieldsId),
    label: TEXT_LABEL,
    value: opened.text,
    placeholder: TEXT_PLACEHOLDER,
    ...(focus.field === CardFocus.Text ? { autoFocus: true } : {}),
    submitLabel: DONE_LABEL.toLowerCase(),
    onInput: text => pane.act(local => ({ local: typedText(local, reminderId, text) })),
    onSubmit: text =>
      pane.act(local =>
        saveStepOf(typedText(local, reminderId, text), card, saved => saveActionOf(saved, number)),
      ),
  }

  return drawCardWithFields(elements, box, [
    { fields: [textField], warning: warnings.onText },
    {
      fields: fieldsPlacedAt(fields, FieldPlace.UnderCard).map(({ field }) =>
        fieldUnderCardOf(context, values, field, {
          hasFocus: focus.field === CardFocus.NextItem && focus.key === field.key,
        }),
      ),
      warning: warnings.onCadence,
    },
  ])
}

/** The dropdown of the cadence kinds, on the kind the card `card` opened with. */
function drawKindDropdown({ pane, elements, kinds }: DrawnPane, card: EditedCard) {
  const { Dropdown } = elements

  return (
    <Dropdown
      key={kindDropdownKeyOf(card.openingId)}
      options={kinds.map(({ id, label }) => ({ value: id, label }))}
      value={card.opened.cadence.kind}
      onSelect={id => pane.act(local => ({ local: pickedKind(kinds, local, card.reminderId, id) }))}
    />
  )
}

/** A card being edited, with the values `typed` into it and the fields `fields` of its kind. */
type CardValues = { card: EditedCard; typed: CardDraft; fields: readonly CardField[] }

/**
 * The field under the card of `values` where the value of `field` is typed. The field that adds
 * the next item to a list gets the focus while the card has it there.
 */
function fieldUnderCardOf(
  { pane }: DrawnPane,
  { card, typed, fields }: CardValues,
  field: TextField | ListCardField,
  { hasFocus }: { hasFocus: boolean },
): FieldUnderCard {
  const { number, reminderId, fieldsId, opened } = card
  switch (field.kind) {
    case FieldKind.Text:
      return {
        key: valueFieldKeyOf(fieldsId, field.key),
        label: labelOf(fields, typed.cadence.values, field),
        value: valueOfField(fields, opened.cadence.values, field),
        ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
        submitLabel: DONE_LABEL.toLowerCase(),
        onInput: value =>
          pane.act(local => ({ local: typedValue(local, reminderId, { key: field.key, value }) })),
        onSubmit: value =>
          pane.act(local =>
            saveStepOf(typedValue(local, reminderId, { key: field.key, value }), card, saved =>
              saveActionOf(saved, number),
            ),
          ),
      }
    case FieldKind.List:
      return nextItemFieldOf(pane, { card, field, hasFocus })
  }
}

/** The dropdown `field` of `card`, with its options as the values `typed` label them. */
function drawDropdown(
  { pane, elements }: DrawnPane,
  { card, typed, fields }: CardValues,
  field: ChoiceField,
) {
  const { Dropdown } = elements
  const { reminderId, fieldsId, opened } = card

  return (
    <Dropdown
      key={valueFieldKeyOf(fieldsId, field.key)}
      options={optionsOf(fields, typed.cadence.values, field)}
      value={valueOfField(fields, opened.cadence.values, field)}
      onSelect={value =>
        pane.act(local => ({ local: typedValue(local, reminderId, { key: field.key, value }) }))
      }
    />
  )
}

/** One line of an edited card: `label` in a column as wide as the widest label, then `parts`. */
function drawFieldLine(
  { Box, Text }: PaneElements,
  labelColumns: number,
  label: string,
  parts: readonly RenderElement[],
) {
  return (
    <Box columnGap={1}>
      <Box width={labelColumns} flexShrink={0}>
        <Text dimColor>{label}</Text>
      </Box>
      {parts}
    </Box>
  )
}

/** The switch of the card numbered `number`, which `onPress` turns to the other state. */
export function drawSwitch(
  { Button, Text }: PaneElements,
  number: number,
  isEnabled: boolean,
  onPress: PaneButtonProps['onPress'],
) {
  const key = `switch-${number}`

  return isEnabled ? (
    <Button key={key} label={ON_LABEL} onPress={onPress}>
      <Text color="success">{ON_LABEL}</Text>
    </Button>
  ) : (
    <Button key={key} label={OFF_LABEL} dimColor onPress={onPress} />
  )
}

/**
 * The columns of the widest label in an edited card, with every dropdown of `kinds` drawn on a line
 * of its own after its label.
 */
function labelColumnsOf(kinds: CadenceKinds): number {
  const labels = [
    CADENCE_LABEL,
    ...kinds.flatMap(kind =>
      fieldsPlacedAt(kind.fields, FieldPlace.LineInCard).map(({ label }) => label),
    ),
  ]

  return Math.max(...labels.map(label => [...label].length))
}

/**
 * The text of a warning on an edited card, drawn by the part of the card it is about: after the
 * text field, after the fields of the cadence, or in the card for the kind of the cadence.
 */
type WarningsOfCard = { onText?: string; onCadence?: string; inCard?: string }

function warningsOf(warning: CardWarning | undefined): WarningsOfCard {
  switch (warning?.refusal) {
    case undefined:
      return {}
    case Refusal.BlankText:
      return { onText: BLANK_TEXT_WARNING }
    case Refusal.CadenceProblem:
      return { onCadence: warning.problem }
    case Refusal.UnknownCadence:
      return { inCard: UNKNOWN_CADENCE }
  }
}
