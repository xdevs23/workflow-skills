import { NON_BLANK, NUMBER_RULE } from '../inputs'
import type { ToolArguments } from '../inputs'
import { isPositiveInteger } from '../positiveInteger'

// A product choice: a heading in TODO.md is one short line, and every list of the goals read by the
// model repeats each entry attached to a goal.
const MAX_TODO_LENGTH = 200

const GOAL_SCHEMA = {
  type: 'integer',
  minimum: 1,
  description: `The number of the goal, as ${NUMBER_RULE}.`,
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

export enum TodoInputOutcome {
  Valid = 'valid',
  GoalInvalid = 'goal-invalid',
  TodoBlank = 'todo-blank',
  TodoTooLong = 'todo-too-long',
  TodoNotInForm = 'todo-not-in-form',
}

export type TodoInputProblem = Exclude<TodoInputOutcome, TodoInputOutcome.Valid>

export type TodoInput<Todo> =
  | { outcome: TodoInputOutcome.Valid; goal: number; todo: Todo }
  | { outcome: TodoInputProblem }

const GOAL_PROBLEM = `Give the number of the goal as ${NUMBER_RULE}.`
const TOO_LONG_PROBLEM = `Give the TODO entry in at most ${MAX_TODO_LENGTH} characters.`

/** What the model is told when its input to the attaching tool breaks a rule. */
export const ATTACH_PROBLEMS: Record<TodoInputProblem, string> = {
  [TodoInputOutcome.GoalInvalid]: GOAL_PROBLEM,
  [TodoInputOutcome.TodoBlank]:
    'The TODO entry is blank. Give it with its number and title, as its heading in TODO.md ' +
    'shows it.',
  [TodoInputOutcome.TodoTooLong]: TOO_LONG_PROBLEM,
  [TodoInputOutcome.TodoNotInForm]:
    'Give the TODO entry on one line in the form #<number> - <title>, as its heading in TODO.md ' +
    'shows it.',
}

/** What the model is told when its input to the detaching tool breaks a rule. */
export const DETACH_PROBLEMS: Record<TodoInputProblem, string> = {
  [TodoInputOutcome.GoalInvalid]: GOAL_PROBLEM,
  [TodoInputOutcome.TodoBlank]:
    'The TODO entry is blank. Give it by its number, such as #12 or #12.3.',
  [TodoInputOutcome.TodoTooLong]: TOO_LONG_PROBLEM,
  [TodoInputOutcome.TodoNotInForm]:
    'Give the TODO entry by its number alone, such as #12 or #12.3.',
}

/**
 * Reads the input of the model to a tool that changes the TODO entries of a goal, which arrives
 * unchecked, with the entry read from its text by `readTodo`.
 */
export function readTodoInput<Todo>(
  input: ToolArguments,
  readTodo: (text: string) => Todo | undefined,
): TodoInput<Todo> {
  const { goal, todo } = input
  if (!isPositiveInteger(goal)) {
    return { outcome: TodoInputOutcome.GoalInvalid }
  }
  if (typeof todo !== 'string' || !NON_BLANK.test(todo)) {
    return { outcome: TodoInputOutcome.TodoBlank }
  }
  // The schema counts the length in code points, as the spread does.
  if ([...todo].length > MAX_TODO_LENGTH) {
    return { outcome: TodoInputOutcome.TodoTooLong }
  }
  const read = readTodo(todo)

  return read === undefined
    ? { outcome: TodoInputOutcome.TodoNotInForm }
    : { outcome: TodoInputOutcome.Valid, goal, todo: read }
}
