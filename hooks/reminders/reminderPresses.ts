import type { EngineInterface } from 'claude-code'

import type { CardDraft } from '../../types'
import { showFailure } from '../failureToast'
import type { FailedStoreCall } from '../pluginStore'
import { CADENCE_KINDS } from './cadenceKinds'
import {
  removeReminderOfSession,
  saveDraftOfSession,
  switchReminderOfSession,
} from './reminderActions'
import { ReminderPaneActionKind, ReminderSaveOutcome } from './reminderPaneMessages'
import type { ReminderPaneAction, ReminderSaveResult } from './reminderPaneMessages'
import { Outcome, checkDraft } from './reminders'
import type { ReminderChange } from './reminderStore'
import {
  describeNotRemoved,
  describeNotSaved,
  describeNotSwitched,
  describeRemovedMeanwhile,
} from './reminderTexts'

// What a save made in the Reminders pane does.

/** Runs `action`, a save of the Reminders pane, on the reminders of the session. */
export async function saveReminderPaneAction(
  $: EngineInterface,
  action: ReminderPaneAction,
): Promise<ReminderSaveResult> {
  const sessionId = await $.session.id()
  const { reminderId, number } = action
  switch (action.kind) {
    case ReminderPaneActionKind.Save:
      return saveCard($, sessionId, action)
    case ReminderPaneActionKind.SaveAndSwitch: {
      const saved = await saveCard($, sessionId, action)
      if (saved.outcome === ReminderSaveOutcome.CardSaved) {
        const switched = await switchReminderOfSession($, sessionId, reminderId, action.isEnabled)
        showChangeFailure($, number, switched, describeNotSwitched)
      }

      return saved
    }
    case ReminderPaneActionKind.Switch: {
      const switched = await switchReminderOfSession($, sessionId, reminderId, action.isEnabled)
      showChangeFailure($, number, switched, describeNotSwitched)

      return resultOfChange(switched)
    }
    case ReminderPaneActionKind.Remove: {
      const removed = await removeReminderOfSession($, sessionId, reminderId)
      showChangeFailure($, number, removed, describeNotRemoved)

      return resultOfChange(removed)
    }
  }
}

/** The result of a save whose hook failed. */
export const FAILED_REMINDER_SAVE: ReminderSaveResult = { outcome: ReminderSaveOutcome.Failed }

/**
 * Saves `card`, what was typed into the card of its reminder, and returns the cadence saved when
 * the store has it now. A card refused as typed returns the warning it shows.
 */
async function saveCard(
  $: EngineInterface,
  sessionId: string,
  card: Extract<ReminderPaneAction, { draft: CardDraft }>,
): Promise<ReminderSaveResult> {
  const checked = checkDraft(card.draft, CADENCE_KINDS)
  if (checked.outcome === Outcome.Refused) {
    return { outcome: ReminderSaveOutcome.CardRefused, warning: checked }
  }
  const saved = await saveDraftOfSession($, sessionId, card.reminderId, checked)
  showChangeFailure($, card.number, saved, describeNotSaved)
  const result = resultOfChange(saved)

  return result.outcome === ReminderSaveOutcome.Saved
    ? { outcome: ReminderSaveOutcome.CardSaved, cadence: checked.cadence }
    : result
}

/** How `change` ended for the pane. */
function resultOfChange(change: ReminderChange): ReminderSaveResult {
  switch (change.outcome) {
    case Outcome.Failed:
      return FAILED_REMINDER_SAVE
    case Outcome.Refused:
      return { outcome: ReminderSaveOutcome.Removed }
    case Outcome.Changed:
    case Outcome.Unchanged:
      return { outcome: ReminderSaveOutcome.Saved }
  }
}

/**
 * Shows a toast for `change` of the reminder numbered `number` that did not happen: the failure of
 * the store as `describeFailure` writes it, or the removal of the reminder since the card was
 * drawn.
 */
function showChangeFailure(
  $: EngineInterface,
  number: number,
  change: ReminderChange,
  describeFailure: (failed: FailedStoreCall) => string,
): void {
  switch (change.outcome) {
    case Outcome.Failed:
      showFailure($, describeFailure(change))
      break
    case Outcome.Refused:
      $.ui.toast(describeRemovedMeanwhile(number))
      break
    case Outcome.Changed:
    case Outcome.Unchanged:
      break
  }
}
