import { PLUGIN, skillName } from '../names'

export const AUTONOMY_COMMAND = 'autonomy'

export const AUTONOMY_MODE_SECTION = `${PLUGIN}:autonomy-mode`

export const AUTONOMOUS_IMPLEMENTATION_SKILL = skillName('autonomous-implementation')

export const WRITING_CODE_SKILL = skillName('writing-code')

export const HYGIENE_SKILL = skillName('hygiene')

export enum AutonomyWord {
  Off = 'off',
  Always = 'always',
}

export const AUTONOMY_WORDS: readonly string[] = Object.values(AutonomyWord)

export function isAutonomyWord(words: string): words is AutonomyWord {
  return AUTONOMY_WORDS.includes(words)
}
