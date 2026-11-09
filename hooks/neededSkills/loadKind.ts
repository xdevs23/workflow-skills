import { AND_LIST } from '../listFormat'
import type { QualifiedSkill } from '../names'
import type { PluginFilePath } from './pluginFilePath'

export enum LoadKind {
  /** A skill loaded by the Skill tool, listed by its qualified name. */
  Skill = 'skill',
  /** A file of the plugin read by the Read tool, listed by its path inside the plugin. */
  File = 'file',
}

export type Load =
  | { kind: LoadKind.Skill; name: QualifiedSkill }
  | { kind: LoadKind.File; name: PluginFilePath }

/** The step the model takes to make the loads of one kind, listed by `names`. */
export const LOAD_STEPS: Record<
  LoadKind,
  (names: readonly string[], pluginRoot: string) => string
> = {
  [LoadKind.Skill]: skills => `load ${AND_LIST.format(skills)} with the Skill tool`,
  [LoadKind.File]: (files, pluginRoot) =>
    `read ${AND_LIST.format(files.map(file => `${pluginRoot}/${file}`))}`,
}
