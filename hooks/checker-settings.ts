import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { RuleCheckerModel as ModelName, RuleCheckerSettings } from '../types'
import { isRecord } from './json.ts'
import type { Json } from './json.ts'
import { pluginSkills } from './rules.ts'
import {
  FolderKind,
  readSection,
  SectionKind,
  sessionFolder,
  writeSection,
  WriteKind,
} from './session-file.ts'
import type { FileProblem } from './session-file.ts'

// The models that can check the work, as the plugin types declare them.
export const RuleCheckerModel = {
  Haiku: 'claude-haiku-5-5',
  Sonnet: 'claude-sonnet-5-5',
} as const satisfies Record<string, ModelName>
export const MODELS: readonly ModelName[] = Object.values(RuleCheckerModel)

// One change of the settings, as the command makes it.
export type SettingsChange =
  | Pick<RuleCheckerSettings, 'enabled'>
  | Pick<RuleCheckerSettings, 'model'>
  | Pick<RuleCheckerSettings, 'skills'>

export const SkillsKind = { Known: 'known', Empty: 'empty', Unknown: 'unknown' } as const

// A list of skills checked against the skills of the plugin: skills of the plugin without repeats,
// an empty list, or a list with names that are not skills of the plugin.
type SkillsCheck =
  | { kind: typeof SkillsKind.Known; skills: readonly string[] }
  | { kind: typeof SkillsKind.Empty; available: readonly string[] }
  | { kind: typeof SkillsKind.Unknown; unknown: readonly string[]; available: readonly string[] }

export type RejectedSkills = Exclude<SkillsCheck, { kind: typeof SkillsKind.Known }>

export const LoadKind = {
  Loaded: 'loaded',
  FileUnreadable: 'file-unreadable',
  Invalid: 'invalid',
  SkillsRejected: 'skills-rejected',
} as const

// The reasons the settings stored for a session are not put in force.
export type LoadProblem =
  | { kind: typeof LoadKind.FileUnreadable; path: string; problem: FileProblem }
  | { kind: typeof LoadKind.Invalid; path: string }
  | { kind: typeof LoadKind.SkillsRejected; path: string; skills: RejectedSkills }

type LoadResult = { kind: typeof LoadKind.Loaded; isStarted: boolean } | LoadProblem

export const SaveKind = {
  Applied: 'applied',
  FolderUnknown: 'folder-unknown',
  FileUnreadable: 'file-unreadable',
} as const

// The settings in force after a change, whether the change switched the checker on and whether it
// was saved, which it is not for a session without a transcript; or the reason no change was made.
export type SaveResult =
  | {
      kind: typeof SaveKind.Applied
      settings: RuleCheckerSettings
      isStarted: boolean
      isSaved: boolean
    }
  | { kind: typeof SaveKind.FolderUnknown }
  | { kind: typeof SaveKind.FileUnreadable; path: string; problem: FileProblem }

const DEFAULTS: RuleCheckerSettings = {
  enabled: false,
  model: RuleCheckerModel.Haiku,
  skills: [
    'todo-md',
    'implement',
    'wall-of-shame',
    'writing-style',
    'hygiene',
    'engineering-principles',
    'code-writing',
  ],
}

// The key of the settings of the checker in the settings file of the session.
const SETTINGS_KEY = 'ruleChecker'

const active = atom({ plugin: 'workflow-skills', key: 'ruleCheckerSettings' } as const, DEFAULTS)

type Stored = { kind: typeof LoadKind.Loaded; settings: RuleCheckerSettings } | LoadProblem

const isSettings = (value: Json): value is RuleCheckerSettings =>
  isRecord(value) &&
  typeof value.enabled === 'boolean' &&
  MODELS.some(model => model === value.model) &&
  Array.isArray(value.skills) &&
  value.skills.every(skill => typeof skill === 'string')

export function activeSettings($: EngineInterface): Promise<RuleCheckerSettings> {
  return read($, active)
}

export async function checkSkills(
  $: EngineInterface,
  names: readonly string[],
): Promise<SkillsCheck> {
  const available = await pluginSkills($)
  if (names.length === 0) return { kind: SkillsKind.Empty, available }
  const unknown = names.filter(name => !available.includes(name))

  return unknown.length === 0
    ? { kind: SkillsKind.Known, skills: [...new Set(names)] }
    : { kind: SkillsKind.Unknown, unknown, available }
}

// The settings stored for the session, the defaults where none are stored or the session has no
// folder.
async function storedSettings($: EngineInterface): Promise<Stored> {
  const session = await sessionFolder($)
  if (session.kind !== FolderKind.Known) return { kind: LoadKind.Loaded, settings: DEFAULTS }
  const section = await readSection($, session.path, SETTINGS_KEY, isSettings)
  switch (section.kind) {
    case SectionKind.Absent:
      return { kind: LoadKind.Loaded, settings: DEFAULTS }
    case SectionKind.FileUnreadable:
      return { kind: LoadKind.FileUnreadable, path: section.path, problem: section.problem }
    case SectionKind.Invalid:
      return { kind: LoadKind.Invalid, path: section.path }
    case SectionKind.Valid: {
      const skills = await checkSkills($, section.value.skills)
      return skills.kind === SkillsKind.Known
        ? { kind: LoadKind.Loaded, settings: { ...section.value, skills: skills.skills } }
        : { kind: LoadKind.SkillsRejected, path: section.path, skills }
    }
  }
}

// Puts in force the settings stored for the session and returns whether they switch the checker
// on. The defaults are in force while the file is read, so a read that fails leaves the checker
// off.
export async function loadSessionSettings($: EngineInterface): Promise<LoadResult> {
  const before = await read($, active)
  await update($, active, () => DEFAULTS)
  const stored = await storedSettings($)
  if (stored.kind !== LoadKind.Loaded) return stored
  await update($, active, () => stored.settings)

  return { kind: LoadKind.Loaded, isStarted: !before.enabled && stored.settings.enabled }
}

// Applies one change to the settings in force and saves them in the settings file of the session.
// A session without a transcript has no file, so its settings are only put in force.
export async function saveSettings(
  $: EngineInterface,
  change: SettingsChange,
): Promise<SaveResult> {
  const session = await sessionFolder($)
  if (session.kind === FolderKind.Unknown) return { kind: SaveKind.FolderUnknown }
  const before = await read($, active)
  const settings = { ...before, ...change }
  const isSaved = session.kind === FolderKind.Known
  if (isSaved) {
    const written = await writeSection($, session.path, SETTINGS_KEY, settings)
    if (written.kind === WriteKind.FileUnreadable) {
      return { kind: SaveKind.FileUnreadable, path: written.path, problem: written.problem }
    }
  }
  await update($, active, () => settings)

  return {
    kind: SaveKind.Applied,
    settings,
    isStarted: !before.enabled && settings.enabled,
    isSaved,
  }
}
