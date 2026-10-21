import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  InstructionFileKind,
  ModelTextBlock,
  PromptContextInput,
  PromptContextResult,
} from 'claude-code'

import type { RuleCheckerInstructionFile } from '../types'

type Rules = { source: string; text: string }

const instructions = atom(
  { plugin: 'workflow-skills', key: 'ruleCheckerInstructions' } as const,
  [],
)

const nestedInstructions = atom(
  { plugin: 'workflow-skills', key: 'ruleCheckerNestedInstructions' } as const,
  [],
)

// The instruction files of the organization and of the user change less often than the files of
// the project, of the machine and of memory, so they come first in the system prompt.
const STABLE_KINDS: readonly string[] = ['managed', 'user'] satisfies InstructionFileKind[]

// Stores the instruction files the main agent reads, as the engine resolved them for the
// conversation. Where a hook above rewrote their text, the files are unknown, and that text is
// stored in their place. The engine resolves them again for a new or compacted conversation,
// which starts without the nested instruction files of the one before.
export async function storeInstructions(
  $: EngineInterface,
  e: PromptContextInput,
  below: PromptContextResult,
): Promise<void> {
  const files = below.instructionFiles ?? e.instructionFiles
  const text = below.blocks.find(block => block.name === 'claudeMd')?.text ?? ''
  const stored: RuleCheckerInstructionFile[] =
    files?.map(({ kind, path, content }) => ({ kind, path, content })) ??
    (text === '' ? [] : [{ kind: 'project', path: 'the instruction text', content: text }])
  await update($, instructions, () => stored)
  await update($, nestedInstructions, () => [])
}

// Stores the text of an instruction file the engine loads during the conversation, when the main
// agent works in a directory that contains one. The attachment carries no path, so an edited file
// stays in the list beside its earlier text until the conversation starts again.
export function storeNestedInstructions($: EngineInterface, text: string) {
  return update($, nestedInstructions, known => (known.includes(text) ? known : [...known, text]))
}

// Every Markdown file under `dir`, relative to it, in name order.
async function markdownFiles($: EngineInterface, dir: string): Promise<string[]> {
  const entries = [...(await $.fs.list(dir))].sort((a, b) => (a.name < b.name ? -1 : 1))
  const nested = await Promise.all(
    entries.map(async entry => {
      if (entry.kind === 'dir') {
        const inside = await markdownFiles($, `${dir}/${entry.name}`)
        return inside.map(name => `${entry.name}/${name}`)
      }
      return entry.kind === 'file' && entry.name.endsWith('.md') ? [entry.name] : []
    }),
  )

  return nested.flat()
}

async function skillRules($: EngineInterface, skill: string): Promise<Rules[]> {
  const dir = `${$.plugin.root}/skills/${skill}`
  const name = `${$.plugin.name}:${skill}`

  return Promise.all(
    (await markdownFiles($, dir)).map(async file => ({
      source: file === 'SKILL.md' ? name : `${name} ${file}`,
      text: await $.fs.read(`${dir}/${file}`),
    })),
  )
}

// The part of the system prompt that stays the same while the plugin is loaded: the instructions
// of the checker and the rules of the binding skills, marked for the prompt cache.
export async function fixedSystem(
  $: EngineInterface,
  skills: readonly string[],
): Promise<ModelTextBlock[]> {
  const rules = await Promise.all(skills.map(skill => skillRules($, skill)))

  return [
    { text: await $.fs.read(`${$.plugin.root}/hooks/rule-checker-prompt.md`) },
    { text: JSON.stringify(rules.flat()), cache: true },
  ]
}

// The system prompt of a check, most stable first, with a cache mark after each part that can
// change apart from the others. A request takes four cache marks, and TODO.md takes the last one,
// so the nested instruction files share the mark of the project files.
export async function systemOf(
  $: EngineInterface,
  fixed: readonly ModelTextBlock[],
): Promise<ModelTextBlock[]> {
  const files = await read($, instructions)
  const nested = await read($, nestedInstructions)
  const isStable = (file: RuleCheckerInstructionFile) => STABLE_KINDS.includes(file.kind)
  const rulesOf = (group: RuleCheckerInstructionFile[]): Rules[] =>
    group.map(file => ({ source: `${file.kind} ${file.path}`, text: file.content }))
  const groups = [
    rulesOf(files.filter(isStable)),
    [
      ...rulesOf(files.filter(file => !isStable(file))),
      ...nested.map(text => ({ source: 'nested instruction file', text })),
    ],
  ]

  return [
    ...fixed,
    ...groups
      .filter(group => group.length > 0)
      .map(group => ({ text: JSON.stringify(group), cache: true as const })),
  ]
}
