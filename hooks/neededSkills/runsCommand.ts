import type { Matcher } from './matcher'
import { regExpLiteralOf } from './regExpLiteral'

/**
 * Matches a Bash call whose command text runs one of `commands`, each given as its words, such as
 * `git commit`. Any white space separates the words, and the command may follow another, as in
 * `cd app && git commit`, but a word may not run on, as `commit` does in `git commit-tree`.
 */
export function runsCommand(...commands: readonly string[]): Matcher {
  const expressions = commands.map(commandExpressionOf)

  return ({ call: { tool, input } }) => {
    const { command } = input

    return (
      tool === 'Bash' &&
      typeof command === 'string' &&
      expressions.some(expression => expression.test(command))
    )
  }
}

function commandExpressionOf(command: string): RegExp {
  const words = command.split(' ').map(regExpLiteralOf).join(String.raw`\s+`)

  return new RegExp(String.raw`(?<![\w-])${words}(?![\w-])`, 'u')
}
