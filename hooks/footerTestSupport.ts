import type { Engine } from 'claude-code/testing'
import type { On, RenderPropsOf, RenderSurface, RenderViewport } from 'claude-code'

import { PLUGIN } from './names'

// The prompt footer as the engine draws it, shared by the tests for the footer and for its buttons.

export const MODES = ['focus', 'memory paused']
export const MODES_AS_DRAWN = 'focus & memory paused'
export const HINT = 'claude-fable-5-1 (high)'
/** The widest footer row tried by the tests that search for the narrowest row drawing a button. */
export const WIDEST_ROW_SEARCHED = 300
/** A footer row as wide as the widest row searched, which fits every button found by the search. */
export const WIDE_ENOUGH = { columns: WIDEST_ROW_SEARCHED, rows: 40 }

/**
 * Draws the footer beneath the plugin as the engine does: the hint line dim, and the mode labels
 * dim, joined by ` & `. Returns the number of times the engine has drawn the mode labels, counted
 * as it draws them.
 */
export function drawFooterAsEngine(on: On): { modesDrawn: number } {
  const drawings = { modesDrawn: 0 }
  on('ui.render', { component: 'PromptHint' }, ($, e) => ({
    type: 'Text',
    props: { dimColor: true },
    children: [e.props.hint],
  }))
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    drawings.modesDrawn += 1

    return { type: 'Text', props: { dimColor: true }, children: [e.props.modes.join(' & ')] }
  })

  return drawings
}

export function hintOf(hint: string, tail?: string): RenderPropsOf['PromptHint'] {
  const props = { isDraft: false, isWorking: false, hint }

  return tail === undefined ? props : { ...props, tail }
}

/** Mounts the hint line of the terminal footer, drawing `hint`, in a viewport `viewport` wide. */
export function mountHintLine(
  $: Engine,
  hint: RenderPropsOf['PromptHint'],
  viewport: RenderViewport,
) {
  return $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'PromptHint',
    props: hint,
    viewport,
  })
}

/** Mounts the mode labels `modes` of the footer of `surface`, in `viewport` when given. */
export function mountModes(
  $: Engine,
  options: { surface: RenderSurface; modes: readonly string[]; viewport?: RenderViewport },
) {
  const target = {
    plugin: PLUGIN,
    surface: options.surface,
    component: 'SessionMode' as const,
    props: { modes: options.modes },
  }

  return $.ui.mount(
    options.viewport === undefined ? target : { ...target, viewport: options.viewport },
  )
}

/** Mounts the mode labels of the terminal footer beside a hint line HINT in `viewport`. */
export async function mountFooterModes($: Engine, viewport: RenderViewport = WIDE_ENOUGH) {
  await mountHintLine($, hintOf(HINT), viewport)

  return mountModes($, { surface: 'terminal', modes: MODES, viewport })
}
