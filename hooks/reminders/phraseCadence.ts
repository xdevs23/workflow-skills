import type { MatchedHook, On } from 'claude-code'

import { EVERY_EVENT } from '../everyEvent'
import type { EveryEvent } from '../everyEvent'
import { withoutQuotedText } from '../quotedText'
import { stopWithNote } from '../sendToModel'
import { PHRASE_KIND } from './phraseKind'
import { describeReminderNote, readEnabledReminders } from './reminderDelivery'

// The cadence "when Claude says": a reminder is sent when the main conversation ends its turn on a
// message that contains one of the phrases of the reminder. A phrase inside quoted text does not
// count, since the message only mentions it there.

/** Registers the hook that sends the reminders of the kind "when Claude says". */
export function registerPhraseCadence(on: On): void {
  on('classic.Stop', EVERY_EVENT, sendRemindersOnPhrase)
}

/**
 * Blocks the end of a turn of the main conversation on a message that contains a phrase of a
 * reminder switched on, outside quoted text, with the note on those reminders as the reason, as
 * stopWithNote does. The end that follows the block passes, so a reply that says the phrase again
 * does not send the reminder again.
 */
const sendRemindersOnPhrase: MatchedHook<'classic.Stop', EveryEvent> = ($, e, next) =>
  stopWithNote(e, next, async message => {
    const said = withoutQuotedText(message)
    const due = (await readEnabledReminders($, PHRASE_KIND)).filter(({ settings }) =>
      settings.phrases.some(phrase => phrase.test(said)),
    )
    const note = describeReminderNote(due)
    if (note === undefined) {
      return undefined
    }
    $.ui.log(note.line)

    return note.text
  })
