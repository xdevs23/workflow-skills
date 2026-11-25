import { VISUAL_DECISIONS_SKILL, skillName } from '../names'
import type { QualifiedSkill } from '../names'
import { allOf } from './allOf'
import type { Matcher } from './matcher'
import { pluginFilePath } from './pluginFilePath'
import type { PluginFilePath } from './pluginFilePath'
import { runsCommand } from './runsCommand'
import { writesFile } from './writesFile'

/** A row of the rule table: the tool calls it matches and what they need loaded before they run. */
export type SkillRule = {
  when: Matcher
  skills: readonly QualifiedSkill[]
  /** Files inside the plugin that the matched calls need read, such as rules for product text. */
  files: readonly PluginFilePath[]
}

const WRITING_CODE = skillName('writing-code')
const WRITES_HTML = writesFile({ names: ['*.html'] })

function codeIn(languageSkill: QualifiedSkill, ...names: readonly string[]): SkillRule {
  return { when: writesFile({ names }), skills: [WRITING_CODE, languageSkill], files: [] }
}

/** The rule table. Every row that matches a tool call applies to it. */
export const SKILL_RULES: readonly SkillRule[] = [
  codeIn(skillName('writing-kotlin'), '*.kt', '*.kts'),
  codeIn(skillName('writing-rust'), '*.rs'),
  codeIn(skillName('writing-typescript'), '*.ts', '*.tsx'),
  codeIn(skillName('writing-python'), '*.py'),
  codeIn(skillName('writing-go'), '*.go'),
  codeIn(skillName('writing-c-cpp'), '*.c', '*.h', '*.cpp', '*.hpp'),
  codeIn(skillName('writing-nix'), '*.nix'),
  { when: runsCommand('git commit', 'git add'), skills: [skillName('commit-messages')], files: [] },
  { when: writesFile({ names: ['TODO.md'] }), skills: [skillName('todo-md')], files: [] },
  {
    when: writesFile({
      names: ['strings.xml'],
      folders: ['i18n', 'l10n', 'locales', 'translations'],
    }),
    skills: [skillName('copywriting')],
    files: [pluginFilePath('skills/copywriting/product-text.md')],
  },
  {
    when: writesFile({ names: ['*.test.*', '*_test.*', '*Test.kt'], folders: ['tests'] }),
    skills: [skillName('writing-tests')],
    files: [],
  },
  {
    when: writesFile({
      names: ['flake.nix', 'package.json', 'Cargo.toml', 'build.gradle*', 'Dockerfile'],
    }),
    skills: [skillName('changing-the-build')],
    files: [],
  },
  {
    when: allOf(WRITES_HTML, writesFile({ folders: ['specs'] })),
    skills: [VISUAL_DECISIONS_SKILL],
    files: [],
  },
  {
    when: allOf(WRITES_HTML, writesFile({ folders: ['drafts'] })),
    skills: [skillName('design-drafts')],
    files: [],
  },
  {
    when: runsCommand('gh pr create', 'gh pr edit'),
    skills: [skillName('pull-request')],
    files: [],
  },
  {
    when: runsCommand('gh pr comment', 'gh issue comment'),
    skills: [skillName('pr-comment-replies')],
    files: [],
  },
  { when: runsCommand('git push'), skills: [skillName('hygiene')], files: [] },
]
