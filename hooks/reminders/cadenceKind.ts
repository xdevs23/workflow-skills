import type { SelectOption } from 'claude-code'

import type { Cadence, CadenceValue } from '../../types'
import { MISSHAPEN_VALUES } from './reminderPaneTexts'

// The contract by which a cadence module plugs into the reminders. A module defines its kinds as
// CadenceKind values in a file without hooks, which the surface module of the Reminders pane can
// load, and exports them through listKind. cadenceKinds.ts lists the kinds, and registeredKinds.ts
// names the function that registers the hooks of each. registerReminders calls each of those
// functions by its name: the engine loads a module only when `on` is passed to a function named at
// the top of a file or imported, so a call through the list of kinds would not load.
// The core stores the values typed into the fields of a kind and checks only that each has the
// shape of its field. Only the kind reads them.
// A kind that sends at times known ahead follows the reminders read into the state through a
// function that followReminders of registeredKinds.ts calls, and puts those times into the state
// through setNextSends of reminderState.ts, where the card shows them. A hook of the plugin on the
// writes of the state would not do: it does not see a write made by a press in the pane.

/** The kinds of value field that a cadence kind draws in the card of a reminder. */
export enum FieldKind {
  /** A field the user types the value into. */
  Text = 'text',
  /** A dropdown the user picks the value from. */
  Choice = 'choice',
  /**
   * A list of texts, each drawn on a row of its own with a button that removes it, above a field
   * whose Enter adds the text typed into it.
   */
  List = 'list',
}

/** A value field in the card of a reminder, whose value is stored under `key`. */
export type CardField<Field extends string = string> =
  | SingleValueField<Field>
  | ListCardField<Field>

/** A list field, whose items are stored under `key`. */
export type ListCardField<Field extends string = string> = {
  kind: FieldKind.List
  key: Field
  label: string
  /** The text of the empty field that adds an item. */
  placeholder?: string
}

/** A text field or a dropdown, whose text is stored under `key`. */
export type SingleValueField<Field extends string = string> = { key: Field } & (
  | {
      kind: FieldKind.Text
      /**
       * The label of the field on a card whose values `valueOf` reads, so the label can name
       * another value, such as the unit picked for an amount.
       */
      label: (valueOf: ValueOfField<Field>) => string
      /** The text the field starts with, on a new card and on a card picking the kind. */
      initial?: string
      placeholder?: string
    }
  | {
      kind: FieldKind.Choice
      label?: string
      /**
       * The options of the dropdown on a card whose values `valueOf` reads, so a label can agree
       * with another value, such as "hour" beside an amount of 1. Their values are the same on
       * every card, the first is the default, and `valueOf` is never asked for this field.
       */
      options: (valueOf: ValueOfField<Field>) => readonly [SelectOption, ...SelectOption[]]
    }
)

/** A text field, whose text is stored under `key`. */
export type TextField<Field extends string = string> = Extract<
  SingleValueField<Field>,
  { kind: FieldKind.Text }
>

/** A dropdown, whose value is stored under `key`. */
export type ChoiceField<Field extends string = string> = Extract<
  SingleValueField<Field>,
  { kind: FieldKind.Choice }
>

/** Where the edited card of a reminder draws a field. */
export enum FieldPlace {
  /** On the cadence line, beside the kind dropdown. */
  BesideKindDropdown = 'besideKindDropdown',
  /** In the card, on a line of its own after its label. */
  LineInCard = 'lineInCard',
  /** Under the card, at the full width of the pane, after its label. */
  UnderCard = 'underCard',
}

/** A field of a card with the place where the edited card draws it. */
type PlacedField =
  | { place: FieldPlace.BesideKindDropdown; field: ChoiceField }
  | { place: FieldPlace.LineInCard; field: ChoiceField; label: string }
  | { place: FieldPlace.UnderCard; field: TextField | ListCardField }

/**
 * Where the edited card draws `field`. A dropdown with a label is drawn in the card on a line of
 * its own after that label. A dropdown without a label is drawn beside the kind dropdown. A text
 * field and the field that adds an item to a list are drawn under the card after their label.
 */
function placeOf(field: CardField): PlacedField {
  switch (field.kind) {
    case FieldKind.Choice:
      return field.label === undefined
        ? { place: FieldPlace.BesideKindDropdown, field }
        : { place: FieldPlace.LineInCard, field, label: field.label }
    case FieldKind.Text:
    case FieldKind.List:
      return { place: FieldPlace.UnderCard, field }
  }
}

/** The fields of `fields` that the edited card draws at `place`, in their order. */
export function fieldsPlacedAt<Place extends FieldPlace>(
  fields: readonly CardField[],
  place: Place,
): Extract<PlacedField, { place: Place }>[] {
  return fields
    .map(placeOf)
    .filter((placed): placed is Extract<PlacedField, { place: Place }> => placed.place === place)
}

/**
 * The value in the field with the key `field`: the text typed into a text field, or the value of
 * the option picked in a dropdown. A key of no such field reads as an empty text.
 */
export type ValueOfField<Field extends string> = (field: Field) => string

/** The items added to the list field with the key `field`, none for a key of no list field. */
export type ItemsOfField<Field extends string> = (field: Field) => readonly string[]

export function isListField<Field extends string>(
  field: CardField<Field>,
): field is ListCardField<Field> {
  return field.kind === FieldKind.List
}

function isSingleValueField<Field extends string>(
  field: CardField<Field>,
): field is SingleValueField<Field> {
  return !isListField(field)
}

/** What is wrong with the values typed into the fields of a card, shown under them. */
export class CadenceProblem {
  readonly text: string

  constructor(text: string) {
    this.text = text
  }
}

/**
 * A kind of cadence, an entry in the kind dropdown of a card, with the keys `Field` of its fields.
 */
export type CadenceKind<Settings, Field extends string = string> = {
  /** The name under which the reminders of the kind are stored, never shown and never changed. */
  id: string
  /** The entry in the kind dropdown, and the start of a cadence line the kind does not write. */
  label: string
  /** The value fields of the card, in the order they are drawn. */
  fields: readonly CardField<Field>[]
  /** Reads the values of the fields into the settings of a reminder, or the problem with them. */
  read: (valueOf: ValueOfField<Field>, itemsOf: ItemsOfField<Field>) => Settings | CadenceProblem
  /**
   * The values `values` stored by an earlier version of the kind as this version stores them, or
   * the problem with them. Applied before the values are read and before a card draws them.
   */
  upgradeStored?: (values: Cadence['values']) => Cadence['values'] | CadenceProblem
  /**
   * The cadence line of a card on a reminder with `settings`, for a kind that writes its own. The
   * line of any other kind is its label, then the value of each field as the card shows it.
   */
  describe?: (settings: Settings) => string
}

/** A cadence kind as the core lists it, with the type of its settings hidden. */
export type ListedKind = {
  id: string
  label: string
  fields: readonly CardField[]
  /**
   * The values `values` stored for the kind as this version stores them, each of the shape of its
   * field, or the problem with them.
   */
  readValues: (values: Cadence['values']) => Cadence['values'] | CadenceProblem
  /** The problem with the values `values` stored for the kind, if the kind reads one. */
  problemOf: (values: Cadence['values']) => CadenceProblem | undefined
  /** The cadence line of a card on the values `values`. */
  describe: (values: Cadence['values']) => string
}

/** The cadence kinds of the kind dropdown of a card, in its order. A card starts on the first. */
export type CadenceKinds = readonly [ListedKind, ...ListedKind[]]

/** The kind of `kinds` with the id `id`, if one has it. */
export function kindOf(kinds: CadenceKinds, id: string): ListedKind | undefined {
  return kinds.find(kind => kind.id === id)
}

/** `kind` as the core lists it. */
export function listKind<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
): ListedKind {
  const { id, label, fields, describe } = kind

  return {
    id,
    label,
    fields,
    readValues: stored => readValuesOf(kind, stored),
    problemOf: stored => {
      const read = readSettings(kind, stored)

      return read instanceof CadenceProblem ? read : undefined
    },
    describe: stored => {
      const values = readValuesOf(kind, stored)
      if (values instanceof CadenceProblem) {
        return label
      }
      const read = readShapedValues(kind, values)

      return describe === undefined || read instanceof CadenceProblem
        ? describeFields(kind, values)
        : describe(read)
    },
  }
}

/**
 * Reads the values `stored` for `kind` into its settings. A field without a stored value reads as
 * its default.
 */
export function readSettings<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  stored: Cadence['values'],
): Settings | CadenceProblem {
  const values = readValuesOf(kind, stored)

  return values instanceof CadenceProblem ? values : readShapedValues(kind, values)
}

/**
 * The values `stored` for `kind`, upgraded by the kind, or the problem with them: the problem of
 * the upgrade, or a value not of the shape of its field, a text for a text field or a dropdown and
 * a list for a list field.
 */
function readValuesOf<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  stored: Cadence['values'],
): Cadence['values'] | CadenceProblem {
  const values = kind.upgradeStored?.(stored) ?? stored
  if (values instanceof CadenceProblem) {
    return values
  }

  return kind.fields.every(field => hasShapeOf(field, values[field.key]))
    ? values
    : new CadenceProblem(MISSHAPEN_VALUES)
}

/** Whether `value` is absent or of the shape of `field`. */
function hasShapeOf(field: CardField, value: CadenceValue | undefined): boolean {
  return value === undefined || isListField(field) === (typeof value !== 'string')
}

/** Reads the values `values` of `kind`, each of the shape of its field, into its settings. */
function readShapedValues<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  values: Cadence['values'],
): Settings | CadenceProblem {
  return kind.read(
    key => valueOfKey(kind.fields, values, key),
    key => itemsOfKey(kind.fields, values, key),
  )
}

/** The cadence of `kind` with every field at its default, as a card picking the kind starts. */
export function defaultCadenceOf(kind: ListedKind): Cadence {
  return {
    kind: kind.id,
    values: Object.fromEntries(
      kind.fields.map(field => [field.key, defaultValueOf(kind.fields, field)]),
    ),
  }
}

/**
 * The text of the text field or dropdown `field`, one of `fields`, in `values` read by readValues,
 * or the default of that field: the first option of a dropdown, and the initial text of a text
 * field, empty without one.
 */
export function valueOfField(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: SingleValueField,
): string {
  const stored = values[field.key]

  return typeof stored === 'string' ? stored : defaultTextOf(fields, values, field)
}

/** The items of the list field `field` in `values` read by readValues, none without stored ones. */
export function itemsOfField(field: ListCardField, values: Cadence['values']): readonly string[] {
  const stored = values[field.key]

  return typeof stored === 'object' ? stored : []
}

/**
 * `values` with `typed`, without the white space around it, added as the last item of the list
 * field `field`. A blank `typed` adds nothing.
 */
export function addItem(
  field: ListCardField,
  values: Cadence['values'],
  typed: string,
): Cadence['values'] {
  const item = typed.trim()

  return item === '' ? values : { ...values, [field.key]: [...itemsOfField(field, values), item] }
}

/**
 * `values` without the item at `index` of the list field `field`, while that item is `item`. A
 * row drawn before the items changed names an item that may have moved, which is left in place.
 */
export function removeItem(
  field: ListCardField,
  values: Cadence['values'],
  { index, item }: { index: number; item: string },
): Cadence['values'] {
  const items = itemsOfField(field, values)

  return items[index] === item
    ? { ...values, [field.key]: items.filter((_, at) => at !== index) }
    : values
}

/** The label of the text field `field`, one of `fields`, on a card with the values `values`. */
export function labelOf(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: TextField,
): string {
  return field.label(key => valueOfKey(fields, values, key))
}

/** The options of the dropdown `field`, one of `fields`, on a card with the values `values`. */
export function optionsOf(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: ChoiceField,
): readonly [SelectOption, ...SelectOption[]] {
  return field.options(key => valueOfKey(fields, values, key))
}

/** The text of the text field or dropdown of `fields` with the key `key` in `values`. */
function valueOfKey(fields: readonly CardField[], values: Cadence['values'], key: string): string {
  const field = fields.filter(isSingleValueField).find(each => each.key === key)

  return field === undefined ? '' : valueOfField(fields, values, field)
}

/** The items of the list field of `fields` with the key `key` in `values`. */
function itemsOfKey(
  fields: readonly CardField[],
  values: Cadence['values'],
  key: string,
): readonly string[] {
  const field = fields.filter(isListField).find(each => each.key === key)

  return field === undefined ? [] : itemsOfField(field, values)
}

/**
 * The cadence line of a card on a kind that writes none of its own, or on values it cannot read:
 * the label of the kind, then the value of each field as the card shows it, a dropdown by the
 * label of its option, and a list by its items in double quotes.
 */
function describeFields(
  kind: Pick<ListedKind, 'label' | 'fields'>,
  values: Cadence['values'],
): string {
  const shown = kind.fields.map(field => {
    switch (field.kind) {
      case FieldKind.Text:
        return valueOfField(kind.fields, values, field).trim()
      case FieldKind.Choice: {
        const value = valueOfField(kind.fields, values, field)

        return (
          optionsOf(kind.fields, values, field).find(option => option.value === value)?.label ??
          value
        )
      }
      case FieldKind.List:
        return itemsOfField(field, values)
          .map(item => `"${item}"`)
          .join(', ')
    }
  })

  return [kind.label, ...shown].filter(part => part !== '').join(' ')
}

/** The value `field`, one of `fields`, reads as without a stored value. */
function defaultValueOf(fields: readonly CardField[], field: CardField): CadenceValue {
  return isListField(field) ? [] : defaultTextOf(fields, {}, field)
}

/** The text a text field or a dropdown reads as without a stored text. */
function defaultTextOf(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: SingleValueField,
): string {
  switch (field.kind) {
    case FieldKind.Text:
      return field.initial ?? ''
    case FieldKind.Choice:
      return optionsOf(fields, values, field)[0].value
  }
}
