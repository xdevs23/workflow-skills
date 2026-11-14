import type { RenderElement } from 'claude-code'

import { describeGoalBadges } from '../goals/goalPaneTexts'
import { paneModuleOf } from '../paneModule'
import type { PaneControls, PaneMachine, PaneSurface } from '../paneModule'
import type { PaneElements } from '../paneElements'
import { ImportKind, ImportOutcome, SessionsShown } from './importPaneMessages'
import type {
  ImportAction,
  ImportInPane,
  ImportPaneView,
  ImportResult,
  PaneSession,
} from './importPaneMessages'
import {
  BACK_LABEL,
  FOLDER_UNKNOWN,
  SESSIONS_HEADING,
  TICKED_MARK,
  UNTICKED_MARK,
  describeImportLabel,
  describeImporting,
  describeNotListed,
  describeNothingToImport,
  describePickedSession,
  describeReminderBadges,
  describeSessionLine,
} from './importPaneTexts'

// An import pane, drawn on the drawing thread. A press on a session or on a row changes the pane
// at once, and the import is the one save of the pane.

type ImportPaneControls = PaneControls<ImportInPane | null, ImportAction>

/**
 * What an import pane draws with, the kind of what it imports, and the length of the start of a
 * session id that tells the sessions listed apart.
 */
type DrawnPane = {
  elements: PaneElements
  pane: ImportPaneControls
  kind: ImportKind
  idLength: number
}

/** A goal or a reminder as a row of an import pane draws it, before its badges. */
type PaneRow = { id: string; number: number; text: string }

function drawImportPane(
  view: ImportPaneView,
  pane: ImportPaneControls,
  { elements }: PaneSurface,
): RenderElement {
  const { Text } = elements
  switch (view.shown) {
    case SessionsShown.NotListed:
      return <Text dimColor>{describeNotListed(view.kind)}</Text>
    case SessionsShown.NotRead:
      return <Text color="warning">{view.failure}</Text>
    case SessionsShown.Read:
      break
  }
  const context = { elements, pane, kind: view.kind, idLength: view.idLength }
  switch (view.kind) {
    case ImportKind.Goals:
      return drawPicking(context, view.sessions, view.unreadable, describeGoalBadges)
    case ImportKind.Reminders:
      return drawPicking(context, view.sessions, view.unreadable, describeReminderBadges)
  }
}

/** The sessions to pick from, or the rows of the session pressed, with `badgesOf` each row. */
function drawPicking<Row extends PaneRow>(
  context: DrawnPane,
  sessions: readonly PaneSession<Row>[],
  unreadable: readonly string[],
  badgesOf: (row: Row) => string[],
) {
  const { local } = context.pane
  const picked = sessions.find(session => session.sessionId === local?.sessionId)

  return local === null || picked === undefined
    ? drawSessions(context, sessions, unreadable)
    : drawRows(context, picked, local.pickedIds, badgesOf)
}

/**
 * The sessions with a start record, newest first, then under a heading the sessions without one,
 * which may belong to another project.
 */
function drawSessions(
  context: DrawnPane,
  sessions: readonly PaneSession<PaneRow>[],
  unreadable: readonly string[],
) {
  const { Box, Text } = context.elements
  const recorded = sessions.filter(session => session.startedAt !== undefined)
  const unrecorded = sessions.filter(session => session.startedAt === undefined)

  return (
    <Box flexDirection="column">
      {unreadable.map(text => (
        <Text color="warning">{text}</Text>
      ))}
      {sessions.length === 0 ? (
        <Text dimColor>{describeNothingToImport(context.kind)}</Text>
      ) : (
        <Text bold>{SESSIONS_HEADING}</Text>
      )}
      {recorded.map(session => drawSession(context, session))}
      {unrecorded.length > 0 && <Text bold>{FOLDER_UNKNOWN}</Text>}
      {unrecorded.map(session => drawSession(context, session))}
    </Box>
  )
}

/** The line of `session`, which a press opens, and its first prompt below it. */
function drawSession({ elements, pane, idLength }: DrawnPane, session: PaneSession<PaneRow>) {
  const { Box, Button, Text } = elements
  const { sessionId, firstPrompt } = session

  return (
    <Box key={`session-${sessionId}`} flexDirection="column">
      <Button
        key={`open-${sessionId}`}
        plain
        onPress={() => pane.act(() => ({ local: { sessionId, pickedIds: [] } }))}
      >
        {describeSessionLine(session, idLength)}
      </Button>
      {firstPrompt !== undefined && (
        <Text dimColor wrap="truncate-end">{`  "${firstPrompt}"`}</Text>
      )}
    </Box>
  )
}

/**
 * The rows of `session` with a mark each, which a press ticks or unticks, with `badgesOf` each row
 * before its text, and the button that imports the rows ticked, `pickedIds`, beside Back.
 */
function drawRows<Row extends PaneRow>(
  context: DrawnPane,
  session: PaneSession<Row>,
  pickedIds: readonly string[],
  badgesOf: (row: Row) => string[],
) {
  const { elements, pane, kind, idLength } = context
  const { Box, Button, Text } = elements
  const picked = session.rows.filter(row => pickedIds.includes(row.id)).map(row => row.id)
  const importing = pane.saves[0]

  return (
    <Box flexDirection="column">
      <Text bold>{describePickedSession(session, idLength)}</Text>
      {session.rows.map(row => (
        <Button
          key={`row-${row.id}`}
          plain
          onPress={() => pane.act(local => ({ local: toggledRow(local, row.id) }))}
        >
          {`${pickedIds.includes(row.id) ? TICKED_MARK : UNTICKED_MARK} ${row.number} `}
          {badgesOf(row).map(badge => (
            <Text color="suggestion">{`${badge}  `}</Text>
          ))}
          {row.text}
        </Button>
      ))}
      <Box columnGap={2} marginTop={1}>
        {importing === undefined ? (
          drawButtons(context, session.sessionId, picked)
        ) : (
          <Text dimColor>{describeImporting(kind, importing.pickedIds.length)}</Text>
        )}
      </Box>
    </Box>
  )
}

/**
 * The button that imports the rows `picked` of `fromSessionId`, while one is ticked, and Back,
 * made in the order drawn, since a control joins the Tab order when it is made.
 */
function drawButtons(
  { elements, pane, kind }: DrawnPane,
  fromSessionId: string,
  picked: readonly string[],
) {
  const { Button } = elements

  return [
    ...(picked.length === 0
      ? []
      : [
          <Button
            key="import"
            label={describeImportLabel(kind, picked.length)}
            variant="primary"
            onPress={() => pane.act(() => ({ save: { fromSessionId, pickedIds: picked } }))}
          />,
        ]),
    <Button key="back" label={BACK_LABEL} onPress={() => pane.act(() => ({ local: null }))} />,
  ]
}

/** `local` with the row `id` ticked when it was not, and unticked when it was. */
function toggledRow(local: ImportInPane | null, id: string): ImportInPane | null {
  if (local === null) {
    return null
  }
  const { pickedIds } = local

  return {
    ...local,
    pickedIds: pickedIds.includes(id) ? pickedIds.filter(each => each !== id) : [...pickedIds, id],
  }
}

/** An import that ended goes back to the sessions. A failed one leaves the rows ticked. */
function settleImport(
  local: ImportInPane | null,
  _action: ImportAction,
  result: ImportResult,
): ImportInPane | null {
  return result.outcome === ImportOutcome.Imported ? null : local
}

export const IMPORT_PANE_MACHINE: PaneMachine<
  ImportPaneView,
  ImportInPane | null,
  ImportAction,
  ImportResult
> = { initial: null, settle: settleImport, draw: drawImportPane }

export default paneModuleOf(IMPORT_PANE_MACHINE)
