import { AND_LIST } from '../listFormat'
import type { QualifiedSkill } from '../names'

/** The text that denies a call, read by the model, which must load `skills` first. */
export function describeRefusal(skills: readonly QualifiedSkill[]): string {
  return (
    'STOP. This call was refused. The rules that govern this call are not loaded in this ' +
    `conversation: load ${AND_LIST.format(skills)} with the Skill tool. These rules are ` +
    'binding, without exception. Loading them and sending the same call again does NOT satisfy ' +
    'them. Load them now, read every rule in them that applies to this call, and check the call ' +
    'against each one. Change the call wherever it breaks a rule. Do NOT send this call again ' +
    'until you have done that check.'
  )
}
