import type { EngineInterface, MatchedHook, On, ToolSpec } from 'claude-code'

import { EVERY_EVENT } from './everyEvent'
import type { EveryEvent } from './everyEvent'
import { isToolOfPlugin, toolName } from './names'
import type { PluginToolName } from './names'

/** The specs of the tools declared by one feature, which registerDeclaredTools registers. */
export type DeclaredToolSpecs = { readonly declaredSpecs: readonly ToolSpec[] }

/** The tools of this plugin, declared by each feature while `register` runs. */
export type PluginTools = {
  /** Declares `specs` as tools of this plugin, for registerDeclaredTools to register. */
  declare: (specs: readonly ToolSpec[]) => DeclaredToolSpecs
}

// The engine still lists in the tool pool of the session every tool that an earlier load of the
// plugin registered, also after a reload whose module no longer registers it, and no hook handles
// its calls. Every feature declares its tools before any event, so the pool lacks the others from
// its first listing on.
class DeclaredTools {
  readonly #names = new Set<PluginToolName>()

  declare(specs: readonly ToolSpec[]): DeclaredToolSpecs {
    for (const spec of specs) {
      this.#names.add(toolName(spec.name))
    }

    return { declaredSpecs: specs }
  }

  has(name: PluginToolName): boolean {
    return this.#names.has(name)
  }
}

type ListTools = MatchedHook<'tool.list', EveryEvent>

/** Leaves out of the pool every tool of this plugin that `tools` does not contain. */
async function keepDeclaredTools(
  tools: DeclaredTools,
  e: Parameters<ListTools>[1],
  next: Parameters<ListTools>[2],
): Promise<Awaited<ReturnType<ListTools>>> {
  const listed = await next(e)

  return listed.value === undefined
    ? listed
    : { value: listed.value.filter(tool => !isToolOfPlugin(tool.name) || tools.has(tool.name)) }
}

// The engine passes `$` only to a function declared at the top of a file or imported, so the tools
// are registered by this function and not by one that `declare` returns.
/** Registers the tools `declared`, from a `session.start` hook of the feature declaring them. */
export async function registerDeclaredTools(
  $: EngineInterface,
  declared: DeclaredToolSpecs,
): Promise<void> {
  await Promise.all(declared.declaredSpecs.map(spec => $.tool.register(spec)))
}

/** Creates the record of the tools of this plugin, for the features to declare tools in. */
export function createPluginTools(): DeclaredTools {
  return new DeclaredTools()
}

/** Registers the hook that lists only the tools declared in `tools`, from `createPluginTools`. */
export function registerPluginTools(on: On, tools: DeclaredTools): void {
  on('tool.list', EVERY_EVENT, ($, e, next) => keepDeclaredTools(tools, e, next))
}
