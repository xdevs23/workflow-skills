import type {
  ElementTable,
  EngineInterface,
  MatchedHook,
  ResolveInput,
  UiOpenResult,
} from 'claude-code'

import type { Board, Goal } from '../../types'
import { runOnScreen, showFailure } from '../screenWork'
import { drawsInputFields } from '../surfaces'
import type { SurfaceWithInputFields } from '../surfaces'
import { Outcome, isGoalOpen, nextGoalNumberOf, openGoalsOf } from './board'
import { addGoalToSession, clearGoalOfSession, loadBoardShowingFailure } from './goalActions'
import { GOALS_PANE } from './goalNames'
import {
  dropGoalToClear,
  endSaving,
  readBoardInState,
  readGoalToClear,
  setGoalToClear,
  startSaving,
} from './goalState'
import {
  ADD_LABEL,
  BOARD_LOADING,
  CLEAR_LABEL,
  COMMANDS_IN_PLACE_OF_FIELD,
  KEEP_LABEL,
  NEW_GOAL_PLACEHOLDER,
  PANE_TITLE,
  YES_CLEAR_LABEL,
  describeClearQuestion,
  describeNoLongerOpen,
  describeNotAdded,
  describeNotCleared,
  describeNotRead,
  describeTodo,
} from './goalTexts'

/** The elements every surface draws, which the rows of the goals use. */
type GoalElements = Pick<ElementTable, 'Box' | 'Button' | 'Text'>

export function openGoalsPane($: EngineInterface): Promise<UiOpenResult> {
  return $.ui.open({ id: GOALS_PANE, title: PANE_TITLE, focus: true })
}

export const drawGoalsPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof GOALS_PANE }
> = async ($, e) => {
  const [inState, goalToClear] = await Promise.all([readBoardInState($), readGoalToClear($)])
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  if (inState === null) {
    return <Text dimColor>{BOARD_LOADING}</Text>
  }
  if (inState.outcome === Outcome.Failed) {
    return <Text color="warning">{describeNotRead(inState.failure)}</Text>
  }
  const { sessionId, board } = inState

  return (
    <Box flexDirection="column">
      {openGoalsOf(board).map(goal =>
        drawGoal($, elements, sessionId, goal, goal.id === goalToClear),
      )}
      {drawsInputFields(e) ? (
        drawNewGoalField($, e, sessionId, board)
      ) : (
        <Text color="suggestion">{COMMANDS_IN_PLACE_OF_FIELD}</Text>
      )}
    </Box>
  )
}

/** The row of one open goal, with its Clear, or with the question of its clear. */
function drawGoal(
  $: EngineInterface,
  { Box, Button, Text }: GoalElements,
  sessionId: string,
  goal: Goal,
  isWaitingForYes: boolean,
) {
  return (
    <Box
      key={`goal-${goal.number}`}
      borderStyle="round"
      borderColor={isWaitingForYes ? 'warning' : 'subtle'}
      paddingX={1}
      columnGap={1}
    >
      <Text bold color="claude">{`${goal.number}`}</Text>
      <Box flexDirection="column" flexGrow={1} flexShrink={1}>
        <Text bold>{goal.text}</Text>
        {isWaitingForYes && (
          <Box columnGap={1} flexWrap="wrap">
            <Text color="warning">{describeClearQuestion(goal)}</Text>
            <Button
              key={`confirm-clear-${goal.number}`}
              label={YES_CLEAR_LABEL}
              variant="primary"
              onPress={() =>
                runOnScreen($, () => saveOnce($, () => clearOnScreen($, sessionId, goal)))
              }
            />
            <Button
              key={`keep-${goal.number}`}
              label={KEEP_LABEL}
              onPress={() => runOnScreen($, () => dropGoalToClear($, goal.id))}
            />
          </Box>
        )}
        {goal.todos.map(todo => (
          <Text dimColor>{describeTodo(todo)}</Text>
        ))}
      </Box>
      {!isWaitingForYes && (
        <Button
          key={`clear-${goal.number}`}
          label={CLEAR_LABEL}
          dimColor
          onPress={() => runOnScreen($, () => askToClear($, sessionId, goal))}
        />
      )}
    </Box>
  )
}

function drawNewGoalField(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithInputFields>,
  sessionId: string,
  board: Board,
) {
  const { Input } = $.ui.resolve(e)

  return (
    <Input
      key={newGoalFieldKeyOf(board)}
      placeholder={NEW_GOAL_PLACEHOLDER}
      submitLabel={ADD_LABEL}
      autoFocus
      onSubmit={text => runOnScreen($, () => saveOnce($, () => addOnScreen($, sessionId, text)))}
    />
  )
}

/**
 * The key of the field that adds the next goal. A goal added from anywhere changes the key, so the
 * pane draws an empty field, while a failed add leaves the typed text in the field.
 */
function newGoalFieldKeyOf(board: Board): string {
  return `new-goal-${nextGoalNumberOf(board)}`
}

/**
 * Runs `save` unless another save of the pane runs. Button and Input have no disabled state, so a
 * press or an entry that arrives meanwhile is ignored.
 */
async function saveOnce($: EngineInterface, save: () => Promise<void>): Promise<void> {
  if (!(await startSaving($))) {
    return
  }
  try {
    await save()
  } finally {
    await endSaving($)
  }
}

/**
 * Shows the yes and the keep of a clear in place of the Clear of the goal, unless the goal is no
 * longer open on the board of the session `sessionId` in the store.
 */
async function askToClear($: EngineInterface, sessionId: string, goal: Goal): Promise<void> {
  const loaded = await loadBoardShowingFailure($, sessionId)
  if (loaded.outcome === Outcome.Failed) {
    return
  }
  if (isGoalOpen(loaded.board, goal.id)) {
    await setGoalToClear($, sessionId, goal.id)
  } else {
    $.ui.toast(describeNoLongerOpen(goal))
  }
}

/**
 * Clears the goal on the board of the session `sessionId`, where the number matches only that
 * goal. A failed clear still shows the yes and the keep, so the person can press yes again.
 */
async function clearOnScreen($: EngineInterface, sessionId: string, goal: Goal): Promise<void> {
  const cleared = await clearGoalOfSession($, sessionId, goal.number)
  switch (cleared.outcome) {
    case Outcome.Failed:
      showFailure($, describeNotCleared(cleared))

      return
    case Outcome.Refused:
      $.ui.toast(describeNoLongerOpen(goal))
      break
    case Outcome.Changed:
      break
  }
  await dropGoalToClear($, goal.id)
}

async function addOnScreen($: EngineInterface, sessionId: string, text: string): Promise<void> {
  const added = await addGoalToSession($, sessionId, text)
  switch (added.outcome) {
    case Outcome.Changed:
      await focusNewGoalField($)
      break
    case Outcome.Refused:
      break
    case Outcome.Failed:
      showFailure($, describeNotAdded(added))
      break
  }
}

// $.ui.focus fails for a pane that does not have the keys by now, and the focus is then still where
// the person put it.
async function focusNewGoalField($: EngineInterface): Promise<void> {
  const inState = await readBoardInState($)
  if (inState?.outcome === Outcome.Read) {
    await $.ui.focus({ requestId: GOALS_PANE, key: newGoalFieldKeyOf(inState.board) })
  }
}
