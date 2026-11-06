import { NON_BLANK, NUMBER_RULE } from '../inputs'
import type { ToolArguments } from '../inputs'
import { isPositiveInteger } from '../positiveInteger'
import { LINE_BREAKING_CHARACTERS, MAX_EVIDENCE_LENGTH } from './board'
import { EVIDENCE_BLANK, EVIDENCE_EXAMPLES } from './goalToolTexts'

// A product choice: a heading in TODO.md is one short line, and every list of the goals read by the
// model repeats each entry attached to a goal.
const MAX_TODO_LENGTH = 200

const GOAL_SCHEMA = {
  type: 'integer',
  minimum: 1,
  description: `The number of the goal, as ${NUMBER_RULE}.`,
}

/**
 * One line that is not blank, with white space around it: a character other than white space, and
 * no character that breaks the line between the first and the last of those.
 */
const ONE_LINE_NOT_BLANK =
  `^\\s*[^\\s${LINE_BREAKING_CHARACTERS}](?:[^${LINE_BREAKING_CHARACTERS}]*` +
  `[^\\s${LINE_BREAKING_CHARACTERS}])?\\s*$`

export const MARK_GOAL_DONE_SCHEMA = {
  type: 'object',
  properties: {
    goal: GOAL_SCHEMA,
    evidence: {
      type: 'string',
      pattern: ONE_LINE_NOT_BLANK,
      maxLength: MAX_EVIDENCE_LENGTH,
      description: EVIDENCE_EXAMPLES,
    },
  },
  required: ['goal', 'evidence'],
  additionalProperties: false,
}

export const UNMARK_GOAL_DONE_SCHEMA = {
  type: 'object',
  properties: { goal: GOAL_SCHEMA },
  required: ['goal'],
  additionalProperties: false,
}

/** The input of a tool that changes the TODO entries of a goal, with the entry as described. */
function todoChangeSchema(todoDescription: string) {
  return {
    type: 'object',
    properties: {
      goal: GOAL_SCHEMA,
      todo: {
        type: 'string',
        pattern: NON_BLANK.source,
        maxLength: MAX_TODO_LENGTH,
        description: todoDescription,
      },
    },
    required: ['goal', 'todo'],
    additionalProperties: false,
  }
}

export const ATTACH_TODO_SCHEMA = todoChangeSchema(
  'The TODO entry with its number and title on one line, as its heading in TODO.md shows it.',
)

export const DETACH_TODO_SCHEMA = todoChangeSchema(
  'The TODO entry by its number, such as #12 or #12.3. Every entry in TODO.md has a number.',
)

/** Whether the input of a goal tool follows its rules. */
export enum InputOutcome {
  Valid = 'valid',
  Invalid = 'invalid',
}

/** The input of a goal tool read into `Input`, or what the model is told of the rule it breaks. */
export type ToolInput<Input> =
  | { outcome: InputOutcome.Valid; input: Input }
  | { outcome: InputOutcome.Invalid; problem: string }

/** The input of a tool that changes the TODO entries of a goal. */
export type TodoInput<Todo> = { goal: number; todo: Todo }

/** The input of the tool that marks a goal as done. */
export type MarkInput = { goal: number; evidence: string }

/** The input of a tool that needs only the number of a goal. */
export type GoalInput = { goal: number }

enum TodoProblem {
  TodoBlank = 'todo-blank',
  TodoTooLong = 'todo-too-long',
  TodoNotInForm = 'todo-not-in-form',
}

export const GOAL_PROBLEM = `Give the number of the goal as ${NUMBER_RULE}.`
const TOO_LONG_PROBLEM = `Give the TODO entry in at most ${MAX_TODO_LENGTH} characters.`

/** What the model is told when its TODO entry for the attaching tool breaks a rule. */
export const ATTACH_PROBLEMS: Record<TodoProblem, string> = {
  [TodoProblem.TodoBlank]:
    'The TODO entry is blank. Give it with its number and title, as its heading in TODO.md ' +
    'shows it.',
  [TodoProblem.TodoTooLong]: TOO_LONG_PROBLEM,
  [TodoProblem.TodoNotInForm]:
    'Give the TODO entry on one line in the form #<number> - <title>, as its heading in TODO.md ' +
    'shows it.',
}

/** What the model is told when its TODO entry for the detaching tool breaks a rule. */
export const DETACH_PROBLEMS: Record<TodoProblem, string> = {
  [TodoProblem.TodoBlank]:
    'The TODO entry is blank. Give it by its number, such as #12 or #12.3.',
  [TodoProblem.TodoTooLong]: TOO_LONG_PROBLEM,
  [TodoProblem.TodoNotInForm]:
    'Give the TODO entry by its number alone, such as #12 or #12.3.',
}

/**
 * Reads the number of the goal in the input of the model to a goal tool, which arrives
 * unchecked.
 */
export function readGoalInput(input: ToolArguments): ToolInput<GoalInput> {
  const { goal } = input

  return isPositiveInteger(goal)
    ? { outcome: InputOutcome.Valid, input: { goal } }
    : invalid(GOAL_PROBLEM)
}

/**
 * Reads the input of the model to the tool that marks a goal as done, which arrives unchecked.
 * An evidence that breaks a rule is refused by the board rules, so only its type is read here,
 * and a missing evidence gets the reply to a blank one.
 */
export function readMarkInput(input: ToolArguments): ToolInput<MarkInput> {
  const read = readGoalInput(input)
  if (read.outcome !== InputOutcome.Valid) {
    return read
  }
  const { evidence } = input

  return typeof evidence === 'string'
    ? { outcome: InputOutcome.Valid, input: { goal: read.input.goal, evidence } }
    : invalid(EVIDENCE_BLANK)
}

/**
 * Reads the input of the model to a tool that changes the TODO entries of a goal, which arrives
 * unchecked, with the entry read from its text by `readTodo` and the problems of the entry told
 * as `problems` writes them.
 */
export function readTodoInput<Todo>(
  input: ToolArguments,
  readTodo: (text: string) => Todo | undefined,
  problems: Record<TodoProblem, string>,
): ToolInput<TodoInput<Todo>> {
  const read = readGoalInput(input)
  if (read.outcome !== InputOutcome.Valid) {
    return read
  }
  const { todo } = input
  if (typeof todo !== 'string' || !NON_BLANK.test(todo)) {
    return invalid(problems[TodoProblem.TodoBlank])
  }
  // The schema counts the length in code points, as the spread does.
  if ([...todo].length > MAX_TODO_LENGTH) {
    return invalid(problems[TodoProblem.TodoTooLong])
  }
  const entry = readTodo(todo)

  return entry === undefined
    ? invalid(problems[TodoProblem.TodoNotInForm])
    : { outcome: InputOutcome.Valid, input: { goal: read.input.goal, todo: entry } }
}

function invalid(problem: string): { outcome: InputOutcome.Invalid; problem: string } {
  return { outcome: InputOutcome.Invalid, problem }
}
