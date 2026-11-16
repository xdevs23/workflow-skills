import type { ClientElements, RenderElement, RenderSurface } from 'claude-code'

import { FieldEventKind, eventsAfter } from './paneFields'
import type { FieldEvent, PaneField, TypedTexts, UnnumberedFieldEvent } from './paneFields'
import type { FocusAsk, PanePost } from './paneModule'
import { isRecord } from './pluginStore'
import { UnreadablePost } from './unreadablePost'

// The text fields drawn by the hooks module as Input above the surface module of a pane, and the
// field events sent to the module about them (paneFields.tsx).

/** Where the surface module of a pane draws: the surface, and the session the pane was drawn in. */
export type FieldsAt = { surface: RenderSurface; sessionId: string }

/**
 * The text fields drawn above the surface module of a pane at a place, as the module last posted
 * them there, the field events not yet applied by the module, in order, how many events were
 * recorded there, which numbers the next one, and the id of the last ask for the keyboard handled
 * there, null before the first.
 */
export type ModuleFields = FieldsAt & {
  posted: readonly PaneField[]
  events: readonly FieldEvent[]
  eventCount: number
  focused: string | null
}

function isAt(fields: FieldsAt, at: FieldsAt): boolean {
  return fields.surface === at.surface && fields.sessionId === at.sessionId
}

/** The text fields of `all` drawn at `at`, if any. */
export function moduleFieldsAt(
  all: readonly ModuleFields[],
  at: FieldsAt,
): ModuleFields | undefined {
  return all.find(fields => isAt(fields, at))
}

/** The text fields of `all` drawn at `at`, or none before the first post there. */
function shownFieldsAt(all: readonly ModuleFields[], at: FieldsAt): ModuleFields {
  return moduleFieldsAt(all, at) ?? { ...at, posted: [], events: [], eventCount: 0, focused: null }
}

/** `all` with `fields` at its place, without the entries of other sessions. */
function withModuleFields(
  all: readonly ModuleFields[],
  fields: ModuleFields,
): readonly ModuleFields[] {
  const others = all.filter(
    each => each.sessionId === fields.sessionId && each.surface !== fields.surface,
  )

  return [...others, fields]
}

/** `fields` with `events` recorded after its events, numbered in order. */
function withEvents(
  fields: ModuleFields,
  events: readonly UnnumberedFieldEvent[],
): ModuleFields {
  return {
    ...fields,
    events: [
      ...fields.events,
      ...events.map((event, index) => ({ ...event, number: fields.eventCount + index })),
    ],
    eventCount: fields.eventCount + events.length,
  }
}

/**
 * `all` with the text fields of `post` posted at `at`. The events applied by the post are left
 * out, and each press waiting in it gets an event with `typed`, the texts typed by the time the
 * post was read, unless the press has one already.
 */
export function withPostedFields(
  all: readonly ModuleFields[],
  at: FieldsAt,
  post: Pick<PanePost<never>, 'fields' | 'waitingPresses' | 'appliedFieldEvent' | 'focus'>,
  typed: TypedTexts,
): readonly ModuleFields[] {
  const shown = shownFieldsAt(all, at)
  const recorded = new Set(shown.events.map(({ eventId }) => eventId))
  const answered = post.waitingPresses
    .filter(pressId => !recorded.has(pressId))
    .map((eventId): UnnumberedFieldEvent => ({ kind: FieldEventKind.Press, eventId, typed }))

  const unapplied = eventsAfter(shown.events, post.appliedFieldEvent)

  return withModuleFields(all, {
    ...withEvents({ ...shown, events: unapplied }, answered),
    posted: post.fields,
    focused: post.focus?.askId ?? shown.focused,
  })
}

/** `all` with Enter in the text field `field` drawn at `at`, with its whole text and `typed`. */
export function withSubmit(
  all: readonly ModuleFields[],
  at: FieldsAt,
  { field, text, typed }: { field: string; text: string; typed: TypedTexts },
): readonly ModuleFields[] {
  const event: UnnumberedFieldEvent = {
    kind: FieldEventKind.Submit,
    eventId: crypto.randomUUID(),
    field,
    text,
    typed,
  }

  return withModuleFields(all, withEvents(shownFieldsAt(all, at), [event]))
}

/** What the text fields drawn above a surface module run: on a change of a text, and on Enter. */
export type FieldHandlers = {
  type: (field: string, text: string) => Promise<void>
  submit: (field: string, text: string) => Promise<void>
}

/**
 * `client`, the surface module of a pane, with `fields` above it as Input. Claude Code 2.1.325,
 * checked live in the terminal on 2026-11-16: a click on a Button of the module leaves the keyboard
 * in the field that has it, and the pane scrolls that field into view whenever the field moves.
 * Above the module, a press that changes the height of the module does not move the fields. A press
 * that opens or closes a field moves the module by the height of that field. The desktop surface
 * draws these fields too, and was not checked live.
 */
export function drawFieldsAbove(
  { Box, Input }: Pick<ClientElements, 'Box' | 'Input'>,
  client: RenderElement,
  fields: readonly PaneField[],
  { type, submit }: FieldHandlers,
): RenderElement {
  return (
    <Box flexDirection="column">
      {fields.map(field => (
        <Input
          {...field}
          onInput={text => type(field.key, text)}
          onSubmit={text => submit(field.key, text)}
        />
      ))}
      {client}
    </Box>
  )
}

/** The text fields of a post of a pane module, which arrive unchecked. */
export function readPostedFields(posted: unknown): readonly PaneField[] | UnreadablePost {
  if (!Array.isArray(posted)) {
    return new UnreadablePost('the post does not contain a list of text fields')
  }
  const fields: PaneField[] = []
  for (const field of posted.values()) {
    const read = readPostedField(field)
    if (read instanceof UnreadablePost) {
      return read
    }
    fields.push(read)
  }

  return fields
}

/** A text field of a post. A label, placeholder, value or autoFocus of another type is left out. */
function readPostedField(field: unknown): PaneField | UnreadablePost {
  if (!isRecord(field)) {
    return new UnreadablePost('a text field of the post is not an object')
  }
  const { key, submitLabel, label, placeholder, value, autoFocus } = field
  if (typeof key !== 'string' || typeof submitLabel !== 'string') {
    return new UnreadablePost('a text field of the post does not contain a key or a submit label')
  }

  return {
    key,
    submitLabel,
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof placeholder === 'string' ? { placeholder } : {}),
    ...(typeof value === 'string' ? { value } : {}),
    ...(autoFocus === true ? { autoFocus } : {}),
  }
}

/** The ask for the keyboard in a post of a pane module, which arrives unchecked. */
export function readFocusAsk(posted: unknown): FocusAsk | null | UnreadablePost {
  if (posted === null) {
    return null
  }
  if (!isRecord(posted) || typeof posted.askId !== 'string' || typeof posted.field !== 'string') {
    return new UnreadablePost('the ask for the keyboard does not contain an id or a field')
  }

  return { askId: posted.askId, field: posted.field }
}
