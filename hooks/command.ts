import type { CommandSpec, EngineInterface } from 'claude-code'

import type { RuleCheckerSettings } from '../types'
import {
  activeSettings,
  checkSkills,
  LoadKind,
  MODELS,
  SaveKind,
  saveSettings,
  SkillsKind,
} from './checker-settings.ts'
import type { LoadProblem, RejectedSkills, SaveResult, SettingsChange } from './checker-settings.ts'
import { FileProblem } from './session-file.ts'

// The first word of the arguments of the command.
const Word = { On: 'on', Off: 'off', Model: 'model', Skills: 'skills' } as const
type Word = (typeof Word)[keyof typeof Word]

const ParseKind = { Change: 'change', Skills: 'skills', Rejected: 'rejected' } as const

// The change the words after the first one select, the skills to check against the skills of the
// plugin before they change, or the reason no change was made.
type Parsed =
  | { kind: typeof ParseKind.Change; change: SettingsChange }
  | { kind: typeof ParseKind.Skills; names: readonly string[] }
  | { kind: typeof ParseKind.Rejected; reason: string }

type Action = {
  // The first word and the arguments after it, as the hint and the usage show them.
  hint: string
  parse: (words: readonly string[]) => Parsed
}

// The output of the command, and whether the change it made switched the checker on.
export type CommandReply = { text: string; isStarted: boolean }

const FILE_PROBLEM_TEXT: Record<FileProblem, string> = {
  [FileProblem.NotJson]: 'is not JSON',
  [FileProblem.NotObject]: 'is not a JSON object',
}

const CHECKER_OFF = 'so the rule checker is off for this session'

const NOT_SAVED =
  'This session has no transcript, so these settings apply until it ends and are not saved.'

const FOLDER_UNKNOWN =
  'The folder of this session is not known yet, so the settings cannot be saved. Send a prompt, then run the command again.'

const listed = (names: readonly string[]): string => names.join(', ')

const settingsChange = (change: SettingsChange): Parsed => ({ kind: ParseKind.Change, change })

const rejected = (reason: string): Parsed => ({ kind: ParseKind.Rejected, reason })

const switchTo =
  (enabled: boolean) =>
  (words: readonly string[]): Parsed =>
    words.length === 0
      ? settingsChange({ enabled })
      : rejected(`Unknown argument "${words.join(' ')}". ${USAGE}`)

const skillsProblem = (skills: RejectedSkills): string =>
  skills.kind === SkillsKind.Empty
    ? 'The list of skills is empty.'
    : `Unknown skills: ${listed(skills.unknown)}.`

const ACTIONS: Record<Word, Action> = {
  [Word.On]: { hint: Word.On, parse: switchTo(true) },
  [Word.Off]: { hint: Word.Off, parse: switchTo(false) },
  [Word.Model]: {
    hint: `${Word.Model} <name>`,
    parse: words => {
      const model = MODELS.find(name => name === words[0])
      return model !== undefined && words.length === 1
        ? settingsChange({ model })
        : rejected(`Name one of the models ${listed(MODELS)}.`)
    },
  },
  [Word.Skills]: {
    hint: `${Word.Skills} <names>`,
    parse: words => ({ kind: ParseKind.Skills, names: words }),
  },
}

const HINTS = Object.values(ACTIONS).map(action => action.hint)

const USAGE = `Use ${listed(HINTS)}, or the command alone to show the settings.`

export const COMMAND: CommandSpec = {
  name: 'rule-checker',
  description:
    'Switch the rule checker on or off for this session, or set the model and the skills it applies',
  argumentHint: `[${HINTS.join(' | ')}]`,
}

const settingsText = ({ enabled, model, skills }: RuleCheckerSettings): string =>
  [
    `Rule checker: ${enabled ? 'on' : 'off'} for this session`,
    `Model: ${model}`,
    `Skills: ${listed(skills)}`,
  ].join('\n')

const unchanged = (text: string): CommandReply => ({ text, isStarted: false })

function savedReply(saved: SaveResult): CommandReply {
  switch (saved.kind) {
    case SaveKind.Applied: {
      const text = settingsText(saved.settings)
      return { text: saved.isSaved ? text : `${text}\n${NOT_SAVED}`, isStarted: saved.isStarted }
    }
    case SaveKind.FolderUnknown:
      return unchanged(FOLDER_UNKNOWN)
    case SaveKind.FileUnreadable:
      return unchanged(
        `${saved.path} ${FILE_PROBLEM_TEXT[saved.problem]}, so the settings were not saved. Fix or delete the file, then run the command again.`,
      )
  }
}

// Runs the command. Words are separated by spaces or commas.
export async function runCommand($: EngineInterface, args: string): Promise<CommandReply> {
  const [first, ...words] = args.split(/[\s,]+/).filter(word => word !== '')
  if (first === undefined) return unchanged(settingsText(await activeSettings($)))
  const word = Object.values(Word).find(known => known === first)
  if (word === undefined) return unchanged(`Unknown argument "${first}". ${USAGE}`)
  const parsed = ACTIONS[word].parse(words)
  switch (parsed.kind) {
    case ParseKind.Rejected:
      return unchanged(parsed.reason)
    case ParseKind.Change:
      return savedReply(await saveSettings($, parsed.change))
    case ParseKind.Skills: {
      const skills = await checkSkills($, parsed.names)
      return skills.kind === SkillsKind.Known
        ? savedReply(await saveSettings($, { skills: skills.skills }))
        : unchanged(
            `${skillsProblem(skills)} Name one or more of the skills ${listed(skills.available)}.`,
          )
    }
  }
}

// The notice for settings stored for a session that are not put in force, with the step that
// repairs them.
export function loadProblemText(problem: LoadProblem): string {
  switch (problem.kind) {
    case LoadKind.FileUnreadable:
      return `${problem.path} ${FILE_PROBLEM_TEXT[problem.problem]}, ${CHECKER_OFF}. Fix or delete the file, then run /rule-checker on.`
    case LoadKind.Invalid:
      return `The rule checker settings in ${problem.path} are not valid, ${CHECKER_OFF}. Run /rule-checker on to replace them with the defaults.`
    case LoadKind.SkillsRejected:
      return `The rule checker settings in ${problem.path} are not valid, ${CHECKER_OFF}. ${skillsProblem(problem.skills)} Run /rule-checker skills with one or more of ${listed(problem.skills.available)}, then /rule-checker on.`
  }
}
