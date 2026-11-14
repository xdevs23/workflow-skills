import type { ClientElements, RenderChildren, RenderElement } from 'claude-code'

import { editedBy } from './fieldText'
import { ControlKind, markedIn, shownValueOf, withFocusAt, withMarked } from './paneKeyboard'
import type { KeyboardStore, PaneKeyboard, TabStop } from './paneKeyboard'
import { paneElementsOf } from './paneElements'
import type { DropdownProps, PaneButtonProps, PaneElements, TextInputProps } from './paneElements'
import { DROPDOWN_CLOSED_MARK, DROPDOWN_OPEN_MARK, describeEnterHint } from './paneTexts'
import { KeyName, keyNameOf } from './surfaceKeys'

// Claude Code 2.1.321, checked live in the terminal on 2026-11-13: inside the region of a surface
// module, the surface never sends a key to Input or Select, and Buttons are not in the Tab order.
// After a click on the region outside its Buttons, every key but Escape is sent to the onKey
// listener of the module. A click on a Button runs the Button and leaves the keys where they were.
// So the module draws its text inputs and dropdowns from Buttons and Text. Escape sends the keys
// to the prompt again without telling the module, so the module still draws its focus after it.
// The desktop surface draws these controls too, and was not checked live. Remove this file and
// paneKeyboard.ts once Claude Code sends keys to Input and Select inside a Client and puts its
// Buttons in the Tab order.

/** What a control drawn by a pane module draws with, and how it joins the Tab order. */
type ControlContext = {
  elements: ClientElements
  store: KeyboardStore
  /** The keyboard as the pane is drawn. */
  drawnWith: PaneKeyboard
  /** Adds `stop` to the end of the Tab order. */
  joinTabOrder: (stop: TabStop) => JoinedControl
}

/**
 * A control in the Tab order: whether the focus is on it, whether it is drawn as focused, which
 * needs the keys in the pane too, and how a press moves the focus onto it.
 */
type JoinedControl = { hasFocus: boolean; isFocused: boolean; focusOn: () => void }

/**
 * The elements of a pane drawn by its surface module from the elements of `surface`, with the
 * controls drawn by the module, and the Tab order of those controls. A control joins the Tab order
 * when the pane calls it, so a pane calls its controls in the order it draws them.
 */
export function drawnControlsOf(
  surface: ClientElements,
  store: KeyboardStore,
): { elements: PaneElements; tabOrder: readonly TabStop[] } {
  const drawnWith = store.read()
  const tabOrder: TabStop[] = []
  const context: ControlContext = {
    elements: surface,
    store,
    drawnWith,
    joinTabOrder: stop => {
      const index = tabOrder.length
      tabOrder.push(stop)
      const focusOn = () => store.update(keyboard => withFocusAt(keyboard, tabOrder, index))

      const hasFocus = drawnWith.focus?.key === stop.key

      return { hasFocus, isFocused: drawnWith.hasKeys && hasFocus, focusOn }
    },
  }

  return {
    elements: {
      ...paneElementsOf(surface),
      Button: button => drawButton(context, button),
      TextInput: input => drawTextInput(context, input),
      Dropdown: dropdown => drawDropdown(context, dropdown),
    },
    tabOrder,
  }
}

function drawButton(
  context: ControlContext,
  { onPress, children, autoFocus, ...props }: PaneButtonProps,
) {
  const { Button, Text } = context.elements
  const { isFocused, focusOn } = context.joinTabOrder({
    key: props.key,
    kind: ControlKind.Button,
    autoFocus: autoFocus === true,
    onKey: event => {
      const name = keyNameOf(event)
      if (name === KeyName.Return || name === KeyName.Space) {
        return onPress()
      }
    },
  })
  const press = () => {
    focusOn()
    return onPress()
  }

  return (
    <Button {...props} {...(isFocused ? { plain: true } : {})} onPress={press}>
      {isFocused ? <Text inverse>{focusedLabelOf(props, children)}</Text> : children}
    </Button>
  )
}

/**
 * What a focused Button draws in inverse: its children, or its label where it has none, in the
 * brackets the terminal draws around a Button that is not plain. The focused Button is drawn
 * plain, so its width does not change.
 */
function focusedLabelOf(
  { label, plain }: Omit<PaneButtonProps, 'onPress'>,
  children: RenderChildren,
): RenderChildren {
  const content = drawsNothing(children) ? label : children

  return plain === true ? content : inTerminalBrackets(content)
}

/** `content` in the brackets the terminal draws around a Button (`ButtonProps`, 2.1.321). */
function inTerminalBrackets(content: RenderChildren): RenderChildren {
  return ['[ ', content, ' ]']
}

function drawTextInput(context: ControlContext, input: TextInputProps) {
  const { key, label, placeholder, submitLabel } = input
  const { Box, Text } = context.elements
  const drawn = input.value ?? ''
  const textOf = (keyboard: PaneKeyboard) => shownValueOf(keyboard.typed[key], drawn)
  const { hasFocus, isFocused, focusOn } = context.joinTabOrder({
    key,
    kind: ControlKind.TextInput,
    autoFocus: input.autoFocus === true,
    onKey: event => {
      const text = textOf(context.store.read())
      if (keyNameOf(event) === KeyName.Return) {
        return input.onSubmit(text)
      }
      const edited = editedBy(text, event)
      if (edited === undefined || edited === text) {
        return
      }
      context.store.update(keyboard => ({
        ...keyboard,
        typed: { ...keyboard.typed, [key]: { value: edited, drawnOver: drawn } },
      }))
      return input.onInput?.(edited)
    },
  })
  const text = textOf(context.drawnWith)
  const shownText =
    text === '' && placeholder !== undefined
      ? <Text dimColor>{placeholder}</Text>
      : <Text>{text}</Text>
  if (!hasFocus) {
    return drawPlainControl(context, { key, label, onPress: focusOn }, [shownText])
  }

  // The field with the focus is drawn without a Button, so a click on it sends the keys to the
  // pane.
  return (
    <Box key={key}>
      {label !== undefined && drawLabel(context, label, isFocused ? 'suggestion' : 'subtle')}
      {shownText}
      {isFocused && <Text dimColor>{`  ${describeEnterHint(submitLabel)}`}</Text>}
    </Box>
  )
}

function drawDropdown(context: ControlContext, dropdown: DropdownProps) {
  const { key, label, options, value } = dropdown
  const { Box, Button, Text } = context.elements
  const shownOf = (keyboard: PaneKeyboard) => shownValueOf(keyboard.picked[key], value)
  const openedAt = (keyboard: PaneKeyboard) => {
    const shown = shownOf(keyboard)

    return options.some(option => option.value === shown) ? shown : options[0]?.value
  }
  // The list can be marked on an option that a later drawing no longer offers.
  const pick = (picked: string) => {
    const shown = shownOf(context.store.read())
    const isOffered = options.some(option => option.value === picked)
    context.store.update(keyboard => {
      const closed = withMarked(keyboard, key, null)

      return isOffered
        ? { ...closed, picked: { ...closed.picked, [key]: { value: picked, drawnOver: value } } }
        : closed
    })
    if (isOffered && picked !== shown) {
      return dropdown.onSelect(picked)
    }
  }
  const mark = (marked: string | undefined) => {
    if (marked !== undefined) {
      context.store.update(keyboard => withMarked(keyboard, key, marked))
    }
  }
  const optionNextTo = (marked: string, step: number) => {
    const at = options.findIndex(option => option.value === marked) + step

    return options[Math.min(Math.max(at, 0), options.length - 1)]?.value
  }
  const { isFocused, focusOn } = context.joinTabOrder({
    key,
    kind: ControlKind.Dropdown,
    autoFocus: dropdown.autoFocus === true,
    onKey: event => {
      const marked = markedIn(context.store.read(), key)
      const name = keyNameOf(event)
      if (marked === null) {
        if (name === KeyName.Return || name === KeyName.Up || name === KeyName.Down) {
          mark(openedAt(context.store.read()))
        }
        return
      }
      switch (name) {
        case KeyName.Return:
          return pick(marked)
        case KeyName.Up:
          mark(optionNextTo(marked, -1))
          return
        case KeyName.Down:
          mark(optionNextTo(marked, 1))
          return
      }
    },
  })
  const marked = markedIn(context.drawnWith, key)
  const shownValue = shownOf(context.drawnWith)
  const shown = options.find(option => option.value === shownValue)
  const head = drawPlainControl(
    context,
    {
      key,
      label,
      onPress: () => {
        focusOn()
        context.store.update(keyboard => {
          const isOpen = markedIn(keyboard, key) !== null

          return withMarked(keyboard, key, isOpen ? null : (openedAt(keyboard) ?? null))
        })
      },
    },
    [
      <Text inverse={isFocused}>
        {` ${shown === undefined ? '' : optionTextOf(shown)} ${
          marked === null ? DROPDOWN_CLOSED_MARK : DROPDOWN_OPEN_MARK
        } `}
      </Text>,
    ],
  )
  if (marked === null) {
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
          <Text inverse={option.value === marked} bold={option.value === shownValue}>
            {`  ${optionTextOf(option)}`}
          </Text>
        </Button>
      ))}
    </Box>
  )
}

/** Whether `children` draws nothing, such as the empty list JSX passes a tag without children. */
function drawsNothing(children: RenderChildren): boolean {
  return isChildList(children)
    ? children.every(drawsNothing)
    : children === undefined ||
        children === null ||
        typeof children === 'boolean' ||
        children === ''
}

function isChildList(children: RenderChildren): children is readonly RenderChildren[] {
  return Array.isArray(children)
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
  context: ControlContext,
  { key, label, onPress }: { key: string; label: string | undefined; onPress: () => void },
  body: readonly RenderElement[],
) {
  const { Button } = context.elements

  return (
    <Button key={key} plain {...(label === undefined ? {} : { label })} onPress={onPress}>
      {[...(label === undefined ? [] : [drawLabel(context, label, 'subtle')]), ...body]}
    </Button>
  )
}

/** The label of a control in `color`, with the space that parts it from the control. */
function drawLabel(
  { elements: { Text } }: ControlContext,
  label: string,
  color: 'suggestion' | 'subtle',
) {
  return <Text color={color}>{`${label} `}</Text>
}
