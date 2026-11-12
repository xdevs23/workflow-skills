import type { RenderElement, RenderNode } from 'claude-code'

// Where the panes draw the fields of a card, read from the tree a pane draws, shared by the tests
// for the Goals pane and for the Reminders pane. The find and findAll of a mounted pane search the
// whole tree and hand over the children of an element untyped, so they cannot say which element
// holds a card, what is drawn beside it, and what is drawn inside it.

/**
 * A card, the Box keyed by it, and the element that holds it, by which it is drawn beside others.
 */
type CardInTree = { card: RenderElement; holder: RenderElement }

/** The elements and strings drawn directly in `element`. */
function childrenOf(element: RenderElement): readonly RenderNode[] {
  return 'children' in element ? (element.children ?? []) : []
}

/** The elements drawn directly in `element`, without its strings. */
function elementsIn(element: RenderElement): RenderElement[] {
  return childrenOf(element).filter(child => typeof child !== 'string')
}

/**
 * The Box keyed `key` in `element` or beneath it, first in document order, with the element that
 * holds it. Throws when the pane does not draw that Box.
 */
export function cardKeyedIn(element: RenderElement, key: string): CardInTree {
  const found = findCardKeyed(element, key)
  if (found === undefined) {
    throw new Error(`The pane does not draw a Box keyed ${key}.`)
  }

  return found
}

function findCardKeyed(holder: RenderElement, key: string): CardInTree | undefined {
  const card = elementsIn(holder).find(child => child.type === 'Box' && child.props?.key === key)

  return card === undefined
    ? elementsIn(holder)
        .map(child => findCardKeyed(child, key))
        .find(found => found !== undefined)
    : { card, holder }
}

/** What `node` and the elements beneath it show: their strings, and the label of each Button. */
export function shownTextsIn(node: RenderNode): string[] {
  if (typeof node === 'string') {
    return [node]
  }

  return [
    ...(node.type === 'Button' ? [node.props.label] : []),
    ...childrenOf(node).flatMap(shownTextsIn),
  ]
}
