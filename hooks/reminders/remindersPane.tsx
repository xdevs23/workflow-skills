import type { RenderElement } from 'claude-code'

import type { Cadence, CardInPane, Reminder } from '../../types'
import { sortedByNumber } from '../numbered'
import { paneModuleOf } from '../paneModule'
import type { PaneMachine, PaneSurface } from '../paneModule'
import { kindOf } from './cadenceKind'
import { CADENCE_KINDS } from './cadenceKinds'
import {
  CardMode,
  addedCardOf,
  editedCardOf,
  endedCard,
  isCardInMode,
  settleCard,
} from './reminderCardState'
import type { EditedCard, EditingCard, RemindersPaneControls } from './reminderCardState'
import { askToRemove, drawEditedCard, drawSwitch } from './reminderEditedCard'
import type { DrawnPane } from './reminderEditedCard'
import { ReminderPaneActionKind, RemindersShown } from './reminderPaneMessages'
import type {
  ReminderPaneAction,
  ReminderSaveResult,
  RemindersPaneView,
} from './reminderPaneMessages'
import {
  ADD_LABEL,
  EDIT_LABEL,
  FIELDS_IN_TERMINAL_ONLY,
  KEEP_LABEL,
  REMINDERS_LOADING,
  REMOVE_LABEL,
  SAVING,
  UNKNOWN_CADENCE,
  YES_REMOVE_LABEL,
  describeNextSend,
  describeRemoveQuestion,
} from './reminderPaneTexts'
import { nextNumberOf, shownRemindersOf } from './reminders'

// The Reminders pane, drawn on the drawing thread. A press, the typed text, the picked kind and the
// question to remove a reminder change the state of this module at once. Each save goes on the
// queue, and the card it changes is drawn dim with what runs, without its controls, until its
// result arrives. The other cards can still be pressed, and their saves go on the queue.

/**
 * Draws the cards of the reminders. Only a surface with input fields edits and adds reminders, so
 * the other surfaces draw each card with its switch and its Remove.
 */
function drawRemindersPane(
  view: RemindersPaneView,
  pane: RemindersPaneControls,
  surface: PaneSurface,
): RenderElement {
  const { elements, drawsFields } = surface
  const { Box, Button, Text } = elements
  switch (view.shown) {
    case RemindersShown.Loading:
      return <Text dimColor>{REMINDERS_LOADING}</Text>
    case RemindersShown.NotRead:
      return <Text color="warning">{view.failure}</Text>
    case RemindersShown.Read:
      break
  }
  const { reminders, unreadable } = view
  const context: DrawnPane = {
    pane,
    elements,
    kinds: CADENCE_KINDS,
    now: view.now,
    nextSends: view.nextSends,
  }
  const savingIds = new Set(pane.saves.map(save => save.reminderId))
  const card = pane.local
  const shown = sortedByNumber(shownRemindersOf(reminders))
  const nextNumber = nextNumberOf(reminders)
  const edited = card?.mode === CardMode.Editing ? card : undefined
  const added =
    edited !== undefined && !reminders.some(each => each.id === edited.reminderId)
      ? edited
      : undefined

  return (
    <Box flexDirection="column">
      {unreadable.map(text => (
        <Text color="warning">{text}</Text>
      ))}
      {shown.map(reminder => {
        const { id, number, isEnabled } = reminder
        if (savingIds.has(id)) {
          return drawSavingCard(context, number, edited?.reminderId === id ? edited : reminder)
        }
        if (edited?.reminderId === id && drawsFields) {
          return drawEditedCard(context, edited, drawnCardOf(number, edited), {
            isEnabled,
            isStored: true,
          })
        }
        const isWaitingForYes = card?.mode === CardMode.WaitingForYes && card.reminderId === id

        return drawCard(context, reminder, { isWaitingForYes, canEdit: drawsFields })
      })}
      {!drawsFields ? (
        <Text dimColor>{FIELDS_IN_TERMINAL_ONLY}</Text>
      ) : added !== undefined && savingIds.has(added.reminderId) ? (
        drawSavingCard(context, nextNumber, added)
      ) : added !== undefined ? (
        drawEditedCard(context, added, drawnCardOf(nextNumber, added), {
          isEnabled: false,
          isStored: false,
        })
      ) : (
        <Box>
          <Button
            key="add-reminder"
            label={ADD_LABEL}
            onPress={() => pane.act(() => ({ local: addedCardOf(context.kinds) }))}
          >
            <Text color="claude">{ADD_LABEL}</Text>
          </Button>
        </Box>
      )}
    </Box>
  )
}
/** The card numbered `number` as `edited`, the card edited in the pane, has it. */
function drawnCardOf(number: number, edited: EditingCard): EditedCard {
  const { reminderId, openingId, fieldsId, opened } = edited

  return { number, reminderId, openingId, fieldsId, opened }
}
/**
 * The card numbered `number` while a save of its reminder is on the queue: dim, with the text of
 * `shown`, the reminder or the card typed, and what runs, without its controls.
 */
function drawSavingCard(
  { elements }: DrawnPane,
  number: number,
  shown: Reminder | EditingCard,
) {
  const { Box, Text } = elements

  return (
    <Box
      key={`reminder-${number}`}
      borderStyle="round"
      borderColor="subtle"
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text bold dimColor>
          {'draft' in shown ? shown.draft.text : shown.text}
        </Text>
        <Text dimColor>{SAVING}</Text>
      </Box>
    </Box>
  )
}

/**
 * The card of `reminder` with its text, its cadence and its buttons: the switch, Edit where the
 * surface edits cards, and Remove, or the question to remove the reminder in their place.
 */
function drawCard(
  context: DrawnPane,
  reminder: Reminder,
  { isWaitingForYes, canEdit }: { isWaitingForYes: boolean; canEdit: boolean },
) {
  const { pane, elements, kinds, nextSends } = context
  const { Box, Button, Text } = elements
  const { id, number, isEnabled, cadence } = reminder
  const named = { reminderId: id, number }

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
        {drawCadence(context, cadence, nextSends[cadence.kind]?.[id])}
        {isWaitingForYes ? (
          <Box columnGap={1} flexWrap="wrap">
            <Text color="warning">{describeRemoveQuestion(number)}</Text>
            <Button
              key={`confirm-remove-${number}`}
              label={YES_REMOVE_LABEL}
              variant="primary"
              onPress={() =>
                pane.act(local =>
                  isCardInMode(local, id, CardMode.WaitingForYes)
                    ? { local: null, save: { kind: ReminderPaneActionKind.Remove, ...named } }
                    : {},
                )
              }
            />
            <Button
              key={`keep-${number}`}
              label={KEEP_LABEL}
              autoFocus
              onPress={() =>
                pane.act(local => ({ local: endedCard(local, id, CardMode.WaitingForYes) }))
              }
            />
          </Box>
        ) : (
          <Box justifyContent="flex-end" flexWrap="wrap">
            {drawSwitch(elements, number, isEnabled, () =>
              pane.act(() => ({
                save: { kind: ReminderPaneActionKind.Switch, ...named, isEnabled: !isEnabled },
              })),
            )}
            {canEdit && (
              <Button
                key={`edit-${number}`}
                label={EDIT_LABEL}
                dimColor
                onPress={() =>
                  pane.act(() => ({ local: editedCardOf(kinds, reminder) }))
                }
              />
            )}
            <Button
              key={`remove-${number}`}
              label={REMOVE_LABEL}
              dimColor
              onPress={() => askToRemove(context, id)}
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
  { elements, kinds, now }: DrawnPane,
  cadence: Cadence,
  nextSendAt: number | undefined,
) {
  const { Box, Text } = elements
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
export const REMINDERS_PANE_MACHINE: PaneMachine<
  RemindersPaneView,
  CardInPane | null,
  ReminderPaneAction,
  ReminderSaveResult
> = { initial: null, settle: settleCard, draw: drawRemindersPane }

export default paneModuleOf(REMINDERS_PANE_MACHINE)
