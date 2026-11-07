import type {
  ElementTable,
  EngineInterface,
  MatchedHook,
  RenderElement,
  ResolveInput,
  UiOpenResult,
} from 'claude-code'

import type { Cadence, CardDraft, CardInPane, CardWarning, Reminder } from '../../types'
import { sortedByNumber } from '../numbered'
import { DONE_LABEL } from '../paneTexts'
import { describeUnreadableRecord } from '../pluginStore'
import { drawsFields } from '../surfaces'
import type { SurfaceWithFields } from '../surfaces'
import { FieldKind, kindOf, optionsOf, valueOfField } from './cadenceKind'
import type { CadenceKinds, CardField } from './cadenceKind'
import { loadRemindersIntoState } from './reminderActions'
import { REMINDERS_PANE } from './reminderNames'
import {
  askToRemove,
  finishCard,
  kindDropdownKeyOf,
  pickKind,
  removeOnScreen,
  startAdding,
  startEditing,
  submitText,
  submitValue,
  switchCard,
  switchOnScreen,
  textFieldKeyOf,
  typeText,
  typeValue,
  valueFieldKeyOf,
} from './reminderPresses'
import type { EditedCard, PaneContext } from './reminderPresses'
import { Outcome, Refusal, nextNumberOf, shownRemindersOf } from './reminders'
import {
  CardMode,
  dropCard,
  readCardInState,
  readNextSends,
  readRemindersInState,
  readSavingReminder,
} from './reminderState'
import type { NextSends } from './reminderState'
import type { Failed, ReadReminders } from './reminderStore'
import {
  ADD_LABEL,
  BLANK_TEXT_WARNING,
  CADENCE_LABEL,
  EDIT_LABEL,
  FIELDS_IN_TERMINAL_ONLY,
  KEEP_LABEL,
  OFF_LABEL,
  ON_LABEL,
  PANE_TITLE,
  REMINDERS_LOADING,
  REMOVE_LABEL,
  SAVING,
  TEXT_LABEL,
  TEXT_PLACEHOLDER,
  UNKNOWN_CADENCE,
  YES_REMOVE_LABEL,
  describeNextSend,
  describeNotRead,
  describeRemoveQuestion,
} from './reminderTexts'

/** The elements every surface draws, which the cards use. */
type CardElements = Pick<ElementTable, 'Box' | 'Button' | 'Text'>

type DrawPane = MatchedHook<'ui.render', { component: 'Pane'; requestId: typeof REMINDERS_PANE }>

/** The card edited in the pane, as the state has it. */
type EditingCard = Extract<CardInPane, { mode: CardMode.Editing }>

/** The surface of a pane with input fields, which the cards are edited on. */
type FieldsInput = ResolveInput<'Pane', SurfaceWithFields>

/**
 * What the cards of the pane share as it is drawn: what the presses share, the time the pane is
 * drawn at, the next send times put by the cadence kinds, and the id of the reminder whose save
 * runs, if one runs.
 */
type DrawnPane = PaneContext & { now: number; nextSends: NextSends; savingId: string | null }

/** The reminders of the session read again from the store, and the Reminders pane opened on them. */
type PaneOnFreshReminders = { loaded: ReadReminders | Failed; opened: UiOpenResult }

/**
 * Reads the reminders of the session again into the state, and opens the Reminders pane, which
 * shows them.
 */
export async function openRemindersPane($: EngineInterface): Promise<PaneOnFreshReminders> {
  const loaded = await loadRemindersIntoState($, await $.session.id())
  const opened = await $.ui.open({ id: REMINDERS_PANE, title: PANE_TITLE, focus: true })

  return { loaded, opened }
}

/**
 * Draws the cards of the reminders, with the kinds `kinds` in the kind dropdown. Only a surface
 * with input fields edits and adds reminders, so the other surfaces draw each card with its switch
 * and its Remove.
 */
export async function drawRemindersPane(
  kinds: CadenceKinds,
  $: EngineInterface,
  e: Parameters<DrawPane>[1],
): Promise<Awaited<ReturnType<DrawPane>>> {
  const [inState, card, savingId, nextSends, now] = await Promise.all([
    readRemindersInState($),
    readCardInState($),
    readSavingReminder($),
    readNextSends($),
    $.clock.now(),
  ])
  const elements = $.ui.resolve(e)
  const { Box, Button, Text } = elements
  if (inState === null) {
    return <Text dimColor>{REMINDERS_LOADING}</Text>
  }
  if (inState.outcome === Outcome.Failed) {
    return <Text color="warning">{describeNotRead(inState)}</Text>
  }
  const { sessionId, reminders, unreadableKeys } = inState
  const context = { kinds, sessionId, now, nextSends, savingId }
  const shown = sortedByNumber(shownRemindersOf(reminders))
  const nextNumber = nextNumberOf(reminders)
  const edited = card?.mode === CardMode.Editing ? card : undefined
  const added =
    edited !== undefined && !reminders.some(each => each.id === edited.reminderId)
      ? edited
      : undefined

  return (
    <Box flexDirection="column">
      {unreadableKeys.map(key => (
        <Text key={`unreadable-${key}`} color="warning">
          {describeUnreadableRecord(key)}
        </Text>
      ))}
      {shown.map(reminder => {
        const { id, number, isEnabled } = reminder
        if (edited?.reminderId === id && drawsFields(e)) {
          return drawEditedCard($, e, context, editedCardOf(number, edited), {
            isEnabled,
            isStored: true,
            warning: edited.warning,
            typed: edited.draft,
          })
        }
        const isWaitingForYes = card?.mode === CardMode.WaitingForYes && card.reminderId === id

        return drawCard($, elements, context, reminder, {
          isWaitingForYes,
          canEdit: drawsFields(e),
        })
      })}
      {!drawsFields(e) ? (
        <Text dimColor>{FIELDS_IN_TERMINAL_ONLY}</Text>
      ) : added !== undefined ? (
        drawEditedCard($, e, context, editedCardOf(nextNumber, added), {
          isEnabled: false,
          isStored: false,
          warning: added.warning,
          typed: added.draft,
        })
      ) : (
        <Box>
          <Button
            key="add-reminder"
            label={ADD_LABEL}
            onPress={() => startAdding($, context, nextNumber)}
          >
            <Text color="claude">{ADD_LABEL}</Text>
          </Button>
        </Box>
      )}
    </Box>
  )
}

/** The card numbered `number` as `edited`, the card edited in the pane, has it. */
function editedCardOf(number: number, edited: EditingCard): EditedCard {
  const { reminderId, openingId, fieldsId, opened } = edited

  return { number, reminderId, openingId, fieldsId, opened }
}

/**
 * The card of `reminder` with its text, its cadence and its buttons: the switch, Edit where the
 * surface edits cards, and Remove, or the question to remove the reminder in their place.
 */
function drawCard(
  $: EngineInterface,
  elements: CardElements,
  context: DrawnPane,
  reminder: Reminder,
  { isWaitingForYes, canEdit }: { isWaitingForYes: boolean; canEdit: boolean },
) {
  const { nextSends, savingId } = context
  const { Box, Button, Text } = elements
  const { id, number, isEnabled, cadence } = reminder
  const card = { number, reminderId: id }

  return (
    <Box
      key={`reminder-${number}`}
      borderStyle="round"
      borderColor={isWaitingForYes ? 'warning' : 'subtle'}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text bold>{reminder.text}</Text>
        {drawCadence(elements, context, cadence, nextSends[cadence.kind]?.[id])}
        {savingId === id && <Text dimColor>{SAVING}</Text>}
        {isWaitingForYes ? (
          <Box columnGap={1} flexWrap="wrap">
            <Text color="warning">{describeRemoveQuestion(number)}</Text>
            <Button
              key={`confirm-remove-${number}`}
              label={YES_REMOVE_LABEL}
              variant="primary"
              onPress={() => removeOnScreen($, context, card)}
            />
            <Button
              key={`keep-${number}`}
              label={KEEP_LABEL}
              onPress={() => dropCard($, id, CardMode.WaitingForYes)}
            />
          </Box>
        ) : (
          <Box justifyContent="flex-end" flexWrap="wrap">
            {drawSwitch(elements, number, isEnabled, () =>
              switchOnScreen($, context, card, !isEnabled),
            )}
            {canEdit && (
              <Button
                key={`edit-${number}`}
                label={EDIT_LABEL}
                dimColor
                onPress={() => startEditing($, context, reminder)}
              />
            )}
            <Button
              key={`remove-${number}`}
              label={REMOVE_LABEL}
              dimColor
              onPress={() => askToRemove($, context, id)}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * The cadence line of a card, with the next time the reminder is sent, `nextSendAt`, when it is
 * known, and the problem with its values below it. A kind missing from `kinds` is drawn as unknown.
 */
function drawCadence(
  { Box, Text }: CardElements,
  { kinds, now }: DrawnPane,
  cadence: Cadence,
  nextSendAt: number | undefined,
) {
  const kind = kindOf(kinds, cadence.kind)
  if (kind === undefined) {
    return <Text color="warning">{UNKNOWN_CADENCE}</Text>
  }
  const problem = kind.problemOf(cadence.values)

  return (
    <Box flexDirection="column">
      <Box columnGap={1} flexWrap="wrap">
        <Text color="suggestion">{kind.describe(cadence.values)}</Text>
        {nextSendAt !== undefined && <Text dimColor>{describeNextSend(nextSendAt, now)}</Text>}
      </Box>
      {problem !== undefined && <Text color="warning">{problem.text}</Text>}
    </Box>
  )
}

/**
 * The card `card` with its text and its cadence in fields, the warning on its last save, and its
 * switch, Done and Remove. Remove on a card not stored yet drops the card. Every field is drawn
 * with what its fields were last drawn anew with, and the engine stores what is typed and picked
 * after that: a value drawn anew after every change would replace the typing that arrived meanwhile.
 * The labels of the options follow what is `typed`.
 */
function drawEditedCard(
  $: EngineInterface,
  e: FieldsInput,
  context: DrawnPane,
  card: EditedCard,
  shown: {
    isEnabled: boolean
    isStored: boolean
    warning: CardWarning | undefined
    typed: CardDraft
  },
) {
  const elements = $.ui.resolve(e)
  const { Box, Button, Input, Text } = elements
  const { kinds, savingId } = context
  const { number, reminderId, fieldsId, opened } = card
  const { isEnabled, isStored, warning, typed } = shown
  const fields = kindOf(kinds, opened.cadence.kind)?.fields ?? []
  const labelColumns = labelColumnsOf(kinds)

  return (
    <Box
      key={`reminder-${number}`}
      borderStyle="round"
      borderColor={warning === undefined ? 'suggestion' : 'warning'}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        {drawFieldLine(elements, labelColumns, TEXT_LABEL, [
          <Input
            key={textFieldKeyOf(fieldsId)}
            value={opened.text}
            placeholder={TEXT_PLACEHOLDER}
            submitLabel={DONE_LABEL.toLowerCase()}
            onInput={text => typeText($, reminderId, text)}
            onSubmit={text => submitText($, context, card, text)}
          />,
        ])}
        {drawFieldLine(elements, labelColumns, CADENCE_LABEL, [
          drawKindDropdown($, e, context, card),
          ...fields
            .filter(field => field.label === undefined)
            .map(field => drawValueField($, e, context, { card, typed, fields, field })),
        ])}
        {fields.flatMap(field =>
          field.label === undefined
            ? []
            : [
                drawFieldLine(elements, labelColumns, field.label, [
                  drawValueField($, e, context, { card, typed, fields, field }),
                ]),
              ],
        )}
        {warning !== undefined && <Text color="warning">{describeWarning(warning)}</Text>}
        {savingId === reminderId && <Text dimColor>{SAVING}</Text>}
        <Box justifyContent="flex-end" flexWrap="wrap">
          {drawSwitch(elements, number, isEnabled, () =>
            switchCard($, context, card, !isEnabled),
          )}
          <Button
            key={`done-${number}`}
            label={DONE_LABEL}
            onPress={() => finishCard($, context, card)}
          />
          <Button
            key={`remove-${number}`}
            label={REMOVE_LABEL}
            dimColor
            onPress={() =>
              isStored
                ? askToRemove($, context, reminderId)
                : dropCard($, reminderId, CardMode.Editing)
            }
          />
        </Box>
      </Box>
    </Box>
  )
}

/** The dropdown of the cadence kinds, on the kind the card `card` opened with. */
function drawKindDropdown($: EngineInterface, e: FieldsInput, pane: PaneContext, card: EditedCard) {
  const { Select } = $.ui.resolve(e)

  return (
    <Select
      key={kindDropdownKeyOf(card.openingId)}
      options={pane.kinds.map(({ id, label }) => ({ value: id, label }))}
      value={card.opened.cadence.kind}
      onSelect={id => pickKind($, pane, card.reminderId, id)}
    />
  )
}

/**
 * The field `field` of the cadence of `card`, one of the fields `fields` of its kind: a text
 * field, or a dropdown of its options as the values `typed` label them.
 */
function drawValueField(
  $: EngineInterface,
  e: FieldsInput,
  pane: PaneContext,
  {
    card,
    typed,
    fields,
    field,
  }: { card: EditedCard; typed: CardDraft; fields: readonly CardField[]; field: CardField },
) {
  const { Input, Select } = $.ui.resolve(e)
  const { reminderId, fieldsId, opened } = card
  const key = valueFieldKeyOf(fieldsId, field.key)
  const value = valueOfField(fields, opened.cadence.values, field.key)
  const typeInto = (typed: string) => typeValue($, reminderId, field.key, typed)
  switch (field.kind) {
    case FieldKind.Text:
      return (
        <Input
          key={key}
          value={value}
          {...(field.placeholder === undefined ? {} : { placeholder: field.placeholder })}
          submitLabel={DONE_LABEL.toLowerCase()}
          onInput={typeInto}
          onSubmit={typed =>
            submitValue($, pane, card, { key: field.key, value: typed })
          }
        />
      )
    case FieldKind.Choice:
      return (
        <Select
          key={key}
          options={optionsOf(fields, typed.cadence.values, field)}
          value={value}
          onSelect={typeInto}
        />
      )
  }
}

/** One line of an edited card: `label` in a column as wide as the widest label, then `parts`. */
function drawFieldLine(
  { Box, Text }: CardElements,
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
function drawSwitch(
  { Button, Text }: CardElements,
  number: number,
  isEnabled: boolean,
  onPress: () => Promise<void>,
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

/** The columns of the widest label of an edited card, with every labeled field of `kinds`. */
function labelColumnsOf(kinds: CadenceKinds): number {
  const labels = [
    TEXT_LABEL,
    CADENCE_LABEL,
    ...kinds.flatMap(kind => kind.fields.flatMap(field => field.label ?? [])),
  ]

  return Math.max(...labels.map(label => [...label].length))
}

function describeWarning(warning: CardWarning): string {
  switch (warning.refusal) {
    case Refusal.BlankText:
      return BLANK_TEXT_WARNING
    case Refusal.UnknownCadence:
      return UNKNOWN_CADENCE
    case Refusal.CadenceProblem:
      return warning.problem
  }
}
