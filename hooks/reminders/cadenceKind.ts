import type { On, SelectOption } from 'claude-code'

import type { Cadence } from '../../types'

// The contract by which a cadence module plugs into the reminders. A module defines its kinds as
// CadenceKind values, and exports them through listKind with the function that registers its
// hooks. registeredKinds.ts lists the kinds, and registerReminders calls each of those functions
// by its name: the engine loads a module only when `on` is passed to a function named at the top
// of a file or imported, so a call through the list of kinds would not load.
// The core stores the values typed into the fields of a kind unread, and only the kind reads them.
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
}

/**
 * A value field in the card of a reminder, whose value is stored under `key`. A field with a label
 * is drawn on a line of its own after that label, and a field without one beside the kind dropdown.
 */
export type CardField<Field extends string = string> = { key: Field; label?: string } & (
  | {
      kind: FieldKind.Text
      /** The text the field starts with, on a new card and on a card picking the kind. */
      initial?: string
      placeholder?: string
    }
  | {
      kind: FieldKind.Choice
      /**
       * The options of the dropdown on a card whose values `valueOf` reads, so a label can agree
       * with another value, such as "hour" beside an amount of 1. Their values are the same on
       * every card, the first is the default, and `valueOf` is never asked for this field.
       */
      options: (valueOf: ValueOfField<Field>) => readonly [SelectOption, ...SelectOption[]]
    }
)

/**
 * The value in the field with the key `field`: the text typed into a text field, or the value of
 * the option picked in a dropdown.
 */
export type ValueOfField<Field extends string> = (field: Field) => string

/** What is wrong with the values typed into the fields of a card, shown under them. */
export class CadenceProblem {
  readonly text: string

  constructor(text: string) {
    this.text = text
  }
}

/** A kind of cadence, an entry in the kind dropdown of a card. */
export type CadenceKind<Settings, Field extends string = string> = {
  /** The name under which the reminders of the kind are stored, never shown and never changed. */
  id: string
  /** The entry in the kind dropdown, and the start of a cadence line the kind does not write. */
  label: string
  /** The value fields of the card, in the order they are drawn. */
  fields: readonly CardField<Field>[]
  /** Reads the values of the fields into the settings of a reminder, or the problem with them. */
  read: (valueOf: ValueOfField<Field>) => Settings | CadenceProblem
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
  /** The problem with the values `values` stored for the kind, if the kind reads one. */
  problemOf: (values: Cadence['values']) => CadenceProblem | undefined
  /** The cadence line of a card on the values `values`. */
  describe: (values: Cadence['values']) => string
  /** Registers the hooks that send the reminders of the kind. */
  register: (on: On) => void
}

/** The cadence kinds of the kind dropdown of a card, in its order. A card starts on the first. */
export type CadenceKinds = readonly [ListedKind, ...ListedKind[]]

/** The kind of `kinds` with the id `id`, if one has it. */
export function kindOf(kinds: CadenceKinds, id: string): ListedKind | undefined {
  return kinds.find(kind => kind.id === id)
}

/** `kind` as the core lists it, with `register`, the function that registers its hooks. */
export function listKind<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  register: (on: On) => void,
): ListedKind {
  const { id, label, fields, describe } = kind

  return {
    id,
    label,
    fields,
    problemOf: values => {
      const read = readSettings(kind, values)

      return read instanceof CadenceProblem ? read : undefined
    },
    describe: values => {
      const read = readSettings(kind, values)

      return describe === undefined || read instanceof CadenceProblem
        ? describeFields(kind, values)
        : describe(read)
    },
    register,
  }
}

/**
 * Reads the values `values` stored for `kind` into its settings. A field without a stored value
 * reads as its default.
 */
export function readSettings<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  values: Cadence['values'],
): Settings | CadenceProblem {
  return kind.read(key => valueOfField(kind.fields, values, key))
}

/** The cadence of `kind` with every field at its default, as a card picking the kind starts. */
export function defaultCadenceOf(kind: ListedKind): Cadence {
  return {
    kind: kind.id,
    values: Object.fromEntries(
      kind.fields.map(field => [field.key, valueOfField(kind.fields, {}, field.key)]),
    ),
  }
}

/**
 * The value of the field with the key `key` in `values`, or the default of that field: the first
 * option of a dropdown, and the initial text of a text field, empty without one.
 */
export function valueOfField(
  fields: readonly CardField[],
  values: Cadence['values'],
  key: string,
): string {
  const field = fields.find(each => each.key === key)

  return values[key] ?? (field === undefined ? '' : defaultValueOf(fields, values, field))
}

/** The options of the dropdown `field`, one of `fields`, on a card with the values `values`. */
export function optionsOf(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: Extract<CardField, { kind: FieldKind.Choice }>,
): readonly [SelectOption, ...SelectOption[]] {
  return field.options(key => valueOfField(fields, values, key))
}

/**
 * The cadence line of a card on a kind that writes none of its own, or on values it cannot read:
 * the label of the kind, then the value of each field as the card shows it, a dropdown by the
 * label of its option.
 */
function describeFields(
  kind: Pick<ListedKind, 'label' | 'fields'>,
  values: Cadence['values'],
): string {
  const shown = kind.fields.map(field => {
    const value = valueOfField(kind.fields, values, field.key)
    switch (field.kind) {
      case FieldKind.Text:
        return value.trim()
      case FieldKind.Choice:
        return (
          optionsOf(kind.fields, values, field).find(option => option.value === value)?.label ??
          value
        )
    }
  })

  return [kind.label, ...shown].filter(part => part !== '').join(' ')
}

function defaultValueOf(
  fields: readonly CardField[],
  values: Cadence['values'],
  field: CardField,
): string {
  switch (field.kind) {
    case FieldKind.Text:
      return field.initial ?? ''
    case FieldKind.Choice:
      return optionsOf(fields, values, field)[0].value
  }
}
