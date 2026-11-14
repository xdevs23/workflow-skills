import { sortedByNumber } from '../numbered'
import type { PaneElements } from '../paneElements'
import { closesLoopAmong } from './dependency'
import { PaneElement, rowElementKeyOf } from './goalKeys'
import { GoalPaneActionKind } from './goalPaneMessages'
import type { GoalPaneAction, PaneGoal } from './goalPaneMessages'
import { DEPENDENCY_LABEL, NO_CHOICE_LABEL, PRIORITY_LABEL, nameGoal } from './goalPaneTexts'
import type { GoalsPaneControls } from './goalRowState'
import { PRIORITIES, describePriority } from './priority'
import type { Priority } from './priority'

/** A choice of a picker: the value that names it in the Select, its text, and what a pick saves. */
type Choice = { value: string; label: string; save: GoalPaneAction }

/** A picker of a setting of a goal: its key, its label, its choices and the value selected. */
type Picker = { key: string; label: string; choices: readonly Choice[]; selected: string }

/** The value of the choice that removes a setting. Every other value is a number, as text. */
const NONE = 'none'

/**
 * The open goals of the board, and the goal that each of them depends on, by its number, built once
 * for every picker of a drawing.
 */
export type OpenGoals = {
  goals: readonly PaneGoal[]
  dependedOf: (number: number) => number | undefined
}

export function openGoalsOf(goals: readonly PaneGoal[]): OpenGoals {
  const dependsOnByNumber = new Map(goals.map(each => [each.number, each.dependsOn]))

  return { goals, dependedOf: number => dependsOnByNumber.get(number) }
}

/**
 * Draws the pickers of the priority and the dependency of `goal`, one of the open goals `open`,
 * side by side on one line. The dependency picker offers the open goals by number, without the
 * goals that close a loop.
 */
export function drawGoalPickers(
  elements: PaneElements,
  pane: GoalsPaneControls,
  goal: PaneGoal,
  open: OpenGoals,
) {
  const { Box } = elements

  return (
    <Box columnGap={2} flexWrap="wrap">
      {drawPicker(elements, pane, priorityPickerOf(goal))}
      {drawPicker(elements, pane, dependencyPickerOf(goal, open))}
    </Box>
  )
}

function priorityPickerOf(goal: PaneGoal): Picker {
  const choiceOf = (priority: Priority | undefined): Choice => ({
    value: priority === undefined ? NONE : String(priority),
    label: priority === undefined ? NO_CHOICE_LABEL : describePriority(priority),
    save: {
      kind: GoalPaneActionKind.Prioritize,
      goal: goal.number,
      ...(priority === undefined ? {} : { priority }),
    },
  })

  return {
    key: rowElementKeyOf(goal, PaneElement.Priority),
    label: PRIORITY_LABEL,
    choices: [undefined, ...PRIORITIES].map(choiceOf),
    selected: choiceOf(goal.priority).value,
  }
}

function dependencyPickerOf(goal: PaneGoal, { goals, dependedOf }: OpenGoals): Picker {
  const candidates = goals.filter(
    candidate => !closesLoopAmong(dependedOf, goal.number, candidate.number),
  )
  const choiceOf = (dependsOn: number | undefined): Choice => ({
    value: dependsOn === undefined ? NONE : String(dependsOn),
    label: dependsOn === undefined ? NO_CHOICE_LABEL : nameGoal(dependsOn),
    save: {
      kind: GoalPaneActionKind.Depend,
      goal: goal.number,
      ...(dependsOn === undefined ? {} : { dependsOn }),
    },
  })

  return {
    key: rowElementKeyOf(goal, PaneElement.Dependency),
    label: DEPENDENCY_LABEL,
    choices: [undefined, ...sortedByNumber(candidates).map(({ number }) => number)].map(choiceOf),
    selected: choiceOf(goal.dependsOn).value,
  }
}

/** Draws `picker` as a Select, which saves the choice picked in it. */
function drawPicker(
  { Dropdown }: PaneElements,
  pane: GoalsPaneControls,
  { key, label, choices, selected }: Picker,
) {
  return (
    <Dropdown
      key={key}
      label={label}
      options={choices.map(choice => ({ value: choice.value, label: choice.label }))}
      value={selected}
      onSelect={picked => pane.act(() => ({ save: pickedChoiceOf(choices, picked).save }))}
    />
  )
}

/** The choice among `choices` with the value `picked`, which a Select takes from its options. */
function pickedChoiceOf(choices: readonly Choice[], picked: string): Choice {
  const choice = choices.find(each => each.value === picked)
  if (choice === undefined) {
    throw new Error(`No choice of the picker has the value ${picked}.`)
  }

  return choice
}
