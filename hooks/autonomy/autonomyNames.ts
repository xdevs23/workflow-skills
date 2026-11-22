import { PLUGIN, skillName } from '../names'

export const AUTONOMY_COMMAND = 'autonomy'

export const AUTONOMY_GOAL_WORD = 'autonomy'

export const AUTONOMY_MODE_SECTION = `${PLUGIN}:autonomy-mode`

export const IMPLEMENT_SKILL = skillName('implement')

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

export enum GoalAutonomyWord {
  On = 'on',
  Off = 'off',
}

const GOAL_AUTONOMY_WORDS: readonly string[] = Object.values(GoalAutonomyWord)

function isGoalAutonomyWord(words: string): words is GoalAutonomyWord {
  return GOAL_AUTONOMY_WORDS.includes(words)
}

const GOAL_AUTONOMY_FORM = new RegExp(
  `^(?<goalNumber>\\d+)\\s+${AUTONOMY_GOAL_WORD}\\s+(?<word>\\S+)$`,
  'u',
)

export type GoalAutonomyForm = { goalNumber: number; word: GoalAutonomyWord }

export function readGoalAutonomyForm(text: string): GoalAutonomyForm | undefined {
  const { goalNumber, word } = GOAL_AUTONOMY_FORM.exec(text)?.groups ?? {}

  return goalNumber === undefined || word === undefined || !isGoalAutonomyWord(word)
    ? undefined
    : { goalNumber: Number(goalNumber), word }
}
