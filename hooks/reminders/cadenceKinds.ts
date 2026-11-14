import type { CadenceKinds } from './cadenceKind'
import { EVENT_CADENCES } from './eventKinds'
import { PHRASE_CADENCE } from './phraseKind'
import { TIME_CADENCE } from './timeKind'

/** The cadence kinds of the reminders, in the order of the kind dropdown of a card. */
export const CADENCE_KINDS: CadenceKinds = [PHRASE_CADENCE, TIME_CADENCE, ...EVENT_CADENCES]
