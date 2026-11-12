import { AND_LIST } from '../listFormat'

/**
 * The text that denies a call, read by the model. `steps` lists what the model must load first,
 * such as "load workflow-skills:writing-style with the Skill tool".
 */
export function describeRefusal(steps: readonly string[]): string {
  return (
    'STOP. This call was refused. The rules that govern it are not loaded in this conversation: ' +
    `${AND_LIST.format(steps)}. These rules are binding, without exception. Loading them and ` +
    'sending the same call again does NOT satisfy them. Load them now, read every rule in them ' +
    'that applies to this call, and check the call against each one. Change the call wherever it ' +
    'breaks a rule. Do NOT send this call again until you have done that check.'
  )
}
