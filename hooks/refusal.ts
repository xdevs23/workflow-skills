import { DECISION_AS_DRAFT } from './decisionDraft'
import type { HintKindName, HintRoaster } from './hintKind'
import type { HintText, SharedStep } from './hintText'

/** A shape of text refused at the end of a turn, with the reason why. */
export type Refusal<Name extends HintKindName = HintKindName> = {
  /** The name of the hint kind of the refusal. */
  name: Name
  pattern: RegExp
  reason: HintText
  roaster: HintRoaster
}

/** The step shared by refusals whose text leaves to the user work already decided. */
const DO_DECIDED_WORK: SharedStep = {
  text:
    "The rules, the records in the project and the user's recorded words already set the " +
    'answer. Do the work that answer needs now, and say in your message what you chose.',
}

/** The end of the reason of a refusal whose text leaves to the user work already decided. */
export const DECIDED_WORK_REMEDY: HintText = [DO_DECIDED_WORK, DECISION_AS_DRAFT]
