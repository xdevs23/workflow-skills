import type { ClientElements, RenderElement } from 'claude-code'

import { shownValueOf, withListToggled, withListsClosed } from './paneDropdowns'
import type { DropdownStore, PaneDropdowns } from './paneDropdowns'
import { paneElementsOf } from './paneElements'
import type { DropdownProps, PaneButtonProps, PaneElements } from './paneElements'
import { DROPDOWN_CLOSED_MARK, DROPDOWN_OPEN_MARK } from './paneTexts'

// Claude Code 2.1.321, checked live in the terminal on 2026-11-13: inside the region of a surface
// module, the surface never sends a key to Input or Select. So the module draws its dropdowns from
// Buttons and Text, and its text inputs are drawn by the hooks module above it (paneFields.tsx).
// Claude Code 2.1.325, checked live in the terminal on 2026-11-16: in the region of a module with a
// key listener, a drag over text selects nothing, and a press on a Button runs the Button. Without
// a key listener, the same drag selects the text. So the module does not set a key listener. The
// checks ran in the terminal only, and the desktop surface draws these controls too. Remove this
// file and paneDropdowns.ts once Claude Code draws Select inside a Client.

/** What a control drawn by a pane module draws with. */
type ControlContext = {
  elements: ClientElements
  store: DropdownStore
  /** The dropdowns as the pane is drawn. */
  drawnWith: PaneDropdowns
  /** The keys of the dropdowns drawn so far, to which each dropdown adds its own. */
  dropdownsDrawn: string[]
}

/**
 * The elements of a pane drawn by its surface module from the elements of `surface`, with the
 * controls drawn by the module, and the keys of the dropdowns drawn once the pane is drawn.
 */
export function drawnControlsOf(
  surface: ClientElements,
  store: DropdownStore,
): { elements: PaneElements; dropdownsDrawn: readonly string[] } {
  const context: ControlContext = {
    elements: surface,
    store,
    drawnWith: store.read(),
    dropdownsDrawn: [],
  }

  return {
    elements: {
      ...paneElementsOf(surface),
      Button: button => drawButton(context, button),
      Dropdown: dropdown => drawDropdown(context, dropdown),
    },
    dropdownsDrawn: context.dropdownsDrawn,
  }
}

function drawButton({ elements: { Button }, store }: ControlContext, button: PaneButtonProps) {
  const { onPress, children, ...props } = button
  // Only the hooks module draws a pane Button with its autoFocus (paneWorker.ts).
  delete props.autoFocus
  const press = () => {
    store.update(withListsClosed)
    return onPress()
  }

  return (
    <Button {...props} onPress={press}>
      {children}
    </Button>
  )
}

function drawDropdown(context: ControlContext, dropdown: DropdownProps) {
  const { key, label, options, value } = dropdown
  const {
    elements: { Box, Button, Text },
    store,
    drawnWith,
  } = context
  context.dropdownsDrawn.push(key)
  const pick = (picked: string) => {
    const shown = shownValueOf(store.read().picked[key], value)
    store.update(dropdowns => ({
      openDropdown: null,
      picked: { ...dropdowns.picked, [key]: { value: picked, drawnOver: value } },
    }))
    if (picked !== shown) {
      return dropdown.onSelect(picked)
    }
  }
  const isOpen = drawnWith.openDropdown === key
  const shownValue = shownValueOf(drawnWith.picked[key], value)
  const shown = options.find(option => option.value === shownValue)
  const head = drawPlainControl(
    context,
    { key, label, onPress: () => store.update(dropdowns => withListToggled(dropdowns, key)) },
    [
      <Text>
        {` ${shown === undefined ? '' : optionTextOf(shown)} ${
          isOpen ? DROPDOWN_OPEN_MARK : DROPDOWN_CLOSED_MARK
        } `}
      </Text>,
    ],
  )
  if (!isOpen) {
    return head
  }

  return (
    <Box flexDirection="column">
      {head}
      {options.map(option => (
        <Button
          key={optionKeyOf({ dropdownKey: key, value: option.value })}
          plain
          label={optionTextOf(option)}
          onPress={() => pick(option.value)}
        >
          <Text bold={option.value === shownValue}>{`  ${optionTextOf(option)}`}</Text>
        </Button>
      ))}
    </Box>
  )
}

/** The text that shows `option` of a dropdown: its label, or its value where it has none. */
function optionTextOf(option: DropdownProps['options'][number]): string {
  return option.label ?? option.value
}

/** The key of the option `value` in the open list of the dropdown keyed `dropdownKey`. */
function optionKeyOf({ dropdownKey, value }: { dropdownKey: string; value: string }): string {
  return `${dropdownKey}-${value}`
}

/** A plain Button keyed `key` that draws `label`, where given, before `body`. */
function drawPlainControl(
  { elements: { Button, Text } }: ControlContext,
  { key, label, onPress }: { key: string; label: string | undefined; onPress: () => void },
  body: readonly RenderElement[],
) {
  return (
    <Button key={key} plain {...(label === undefined ? {} : { label })} onPress={onPress}>
      {[...(label === undefined ? [] : [<Text color="subtle">{`${label} `}</Text>]), ...body]}
    </Button>
  )
}
