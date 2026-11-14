import type { EngineInterface } from 'claude-code'

import type { Reminder } from '../../types'
import { AND_LIST } from '../listFormat'
import { sortedByNumber } from '../numbered'
import type { TextWithLine } from '../sendToModel'
import { CadenceProblem, readSettings } from './cadenceKind'
import type { CadenceKind } from './cadenceKind'
import { PANE_TITLE } from './reminderPaneTexts'
import { Outcome, isRemoved } from './reminders'
import { readRemindersInState } from './reminderState'

// What a cadence module calls once the cadence of its reminders comes: it reads the reminders of
// its kind that are switched on, and sends the note on those due through the channel of its event.
// The note has the texts of the reminders and a closing request to act on them, never their cadence
// or the other reminders.

/**
 * A reminder of a kind, switched on, with its settings as its kind read them, and the time it was
 * added, from which a kind may count when the reminder is due.
 */
export type ReminderOfKind<Settings> = Pick<Reminder, 'id' | 'number' | 'text' | 'addedAt'> & {
  settings: Settings
}

/**
 * The reminders of `kind` switched on in the running session, by number. A reminder whose values
 * `kind` cannot read is never sent, and its card shows the problem.
 */
export async function readEnabledReminders<Settings, Field extends string>(
  $: EngineInterface,
  kind: CadenceKind<Settings, Field>,
): Promise<ReminderOfKind<Settings>[]> {
  const inState = await readRemindersInState($)

  return inState?.outcome === Outcome.Read ? enabledRemindersOf(kind, inState.reminders) : []
}

/** The reminders of `kind` among `reminders` that are switched on and not removed, by number. */
export function enabledRemindersOf<Settings, Field extends string>(
  kind: CadenceKind<Settings, Field>,
  reminders: readonly Reminder[],
): ReminderOfKind<Settings>[] {
  return sortedByNumber(reminders).flatMap(reminder => {
    const { id, number, text, addedAt, cadence, isEnabled } = reminder
    if (!isEnabled || isRemoved(reminder) || cadence.kind !== kind.id) {
      return []
    }
    const settings = readSettings(kind, cadence.values)

    return settings instanceof CadenceProblem ? [] : [{ id, number, text, addedAt, settings }]
  })
}

/** The closing paragraph of every note, which asks the model to act on the reminders before it. */
const ACT_ON_REMINDERS =
  'Take every reminder from the user seriously and act on it. Never treat a reminder as noise. ' +
  'When a reminder is ignored, the work it asks for goes undone, mistakes follow, and the user ' +
  'gets extremely upset.'

/** The note on the reminders `due`, which are sent at once, or undefined when none is due. */
export function describeReminderNote(
  due: readonly Pick<Reminder, 'number' | 'text'>[],
): TextWithLine | undefined {
  if (due.length === 0) {
    return undefined
  }
  const sorted = sortedByNumber(due)
  const numbers = AND_LIST.format(sorted.map(({ number }) => `${number}`))
  const named = sorted.length === 1 ? `reminder ${numbers}` : `reminders ${numbers}`
  const reminders = sorted.map(({ text }) => `Reminder from the user: ${text}`)

  return {
    text: [...reminders, ACT_ON_REMINDERS].join('\n\n'),
    line: `${PANE_TITLE}: ${named} sent to Claude`,
  }
}
