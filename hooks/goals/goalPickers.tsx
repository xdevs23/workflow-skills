import type { EngineInterface, ResolveInput } from 'claude-code'

import type { Goal } from '../../types'
import { sortedByNumber } from '../numbered'
import type { SurfaceWithFields } from '../surfaces'
import { dependedGoalOf, dependencyChoicesOf } from './dependency'
import type { OpenGoals } from './dependency'
import { RowElement, rowElementKeyOf } from './goalKeys'
import { prioritizeOnScreen, saveOnce, setDependencyOnScreen } from './goalPresses'
import { DEPENDENCY_LABEL, NO_CHOICE_LABEL, PRIORITY_LABEL, nameGoal } from './goalTexts'
import { PRIORITIES, describePriority, priorityOf } from './priority'
import type { Priority } from './priority'

/** A choice of a picker: the value that names it in the Select, its text, and what a pick saves. */
type Choice = { value: string; label: string; save: () => Promise<void> }

/** A picker of a setting of a goal: its key, its label, its choices and the value selected. */
type Picker = { key: string; label: string; choices: readonly Choice[]; selected: string }

/** The value of the choice that removes a setting. A goal id is a UUID, so no goal has it. */
const NONE = 'none'

/**
 * Draws the pickers of the priority and the dependency of `goal`, side by side on one line. The
 * dependency picker offers the open goals `open` by number, without the goals that close a loop.
 */
export function drawGoalPickers(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
  sessionId: string,
  open: OpenGoals,
  goal: Goal,
) {
  const { Box } = $.ui.resolve(e)

  return (
    <Box columnGap={2} flexWrap="wrap">
      {drawPicker($, e, priorityPickerOf($, sessionId, goal))}
      {drawPicker($, e, dependencyPickerOf($, sessionId, open, goal))}
    </Box>
  )
}

function priorityPickerOf($: EngineInterface, sessionId: string, goal: Goal): Picker {
  const choiceOf = (priority: Priority | undefined): Choice => ({
    value: priority === undefined ? NONE : String(priority),
    label: priority === undefined ? NO_CHOICE_LABEL : describePriority(priority),
    save: () => prioritizeOnScreen($, sessionId, goal, priority),
  })

  return {
    key: rowElementKeyOf(goal, RowElement.Priority),
    label: PRIORITY_LABEL,
    choices: [undefined, ...PRIORITIES].map(choiceOf),
    selected: choiceOf(priorityOf(goal)).value,
  }
}

function dependencyPickerOf(
  $: EngineInterface,
  sessionId: string,
  open: OpenGoals,
  goal: Goal,
): Picker {
  const choiceOf = (dependsOn: Goal | undefined): Choice => ({
    value: dependsOn?.id ?? NONE,
    label: dependsOn === undefined ? NO_CHOICE_LABEL : nameGoal(dependsOn.number),
    save: () => setDependencyOnScreen($, sessionId, goal, dependsOn),
  })

  return {
    key: rowElementKeyOf(goal, RowElement.Dependency),
    label: DEPENDENCY_LABEL,
    choices: [undefined, ...sortedByNumber(dependencyChoicesOf(open, goal))].map(choiceOf),
    selected: choiceOf(dependedGoalOf(open, goal)).value,
  }
}

/** Draws `picker` as a Select, which saves the choice picked in it. */
function drawPicker(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
  { key, label, choices, selected }: Picker,
) {
  const { Select } = $.ui.resolve(e)

  return (
    <Select
      key={key}
      label={label}
      options={choices.map(choice => ({ value: choice.value, label: choice.label }))}
      value={selected}
      onSelect={picked => saveOnce($, pickedChoiceOf(choices, picked).save)}
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
