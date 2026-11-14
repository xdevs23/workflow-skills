import type { RenderElement } from 'claude-code'

import type { PaneElements, TextInputProps } from './paneElements'

// Claude Code 2.1.316 sizes a text field to the width of the whole pane body, less only the label
// and the hint of the field. A field inside a card, or beside another element, is wider than the
// room left there for it. Its text is cut, and its cursor goes out of sight. A field alone on a
// line of the pane wraps its text and keeps the cursor in sight. Remove this drawer once Claude
// Code gives a field the width of the Box it sits in.

/** A field drawn under a card, with the text that names it as its `label`. */
export type FieldUnderCard = TextInputProps & { label: string }

/** Fields under a card, with the warning about what was typed into them while one is shown. */
export type FieldsWithWarning = { fields: readonly FieldUnderCard[]; warning: string | undefined }

/**
 * `card` with the fields of `groups` under it, each drawn alone on a line at the full pane width,
 * and the warning of each group on the line after its fields.
 */
export function drawCardWithFields(
  { Box, TextInput, Text }: Pick<PaneElements, 'Box' | 'TextInput' | 'Text'>,
  card: RenderElement,
  groups: readonly FieldsWithWarning[],
) {
  return (
    <Box flexDirection="column">
      {card}
      {groups.flatMap(({ fields, warning }) => [
        ...fields.map(field => <TextInput {...field} />),
        ...(warning === undefined ? [] : [<Text color="warning">{warning}</Text>]),
      ])}
    </Box>
  )
}
