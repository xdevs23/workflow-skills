import type { Matcher } from './matcher'
import { regExpLiteralOf } from '../regExpLiteral'

/**
 * The options that may precede a subcommand of git: `-C <path>`, `-c <key=value>` and
 * `--<name>[=<value>]`.
 */
const GIT_GLOBAL_OPTIONS = String.raw`(?:\s+(?:-[Cc]\s+\S+|--[\w-]+(?:=\S+)?))*`

/**
 * Matches a Bash call whose command text runs one of `commands`, each given as its words, such as
 * `git commit`. Any white space separates the words, and the command may follow another, as in
 * `cd app && git commit`, but a word may not run on, as `commit` does in `git commit-tree`. Options
 * of git may precede its subcommand, as in `git -C app commit`. A call that its tool reports as
 * read-only, such as `grep -rn "git commit" skills`, does not run a command.
 */
export function runsCommand(...commands: readonly string[]): Matcher {
  const expressions = commands.map(commandExpressionOf)

  return ({ call: { tool, input, isReadOnly } }) => {
    const { command } = input

    return (
      tool === 'Bash' &&
      !isReadOnly &&
      typeof command === 'string' &&
      expressions.some(expression => expression.test(command))
    )
  }
}

function commandExpressionOf(command: string): RegExp {
  const words = command
    .split(' ')
    .map(word => regExpLiteralOf(word) + (word === 'git' ? GIT_GLOBAL_OPTIONS : ''))
    .join(String.raw`\s+`)

  return new RegExp(String.raw`(?<![\w-])${words}(?![\w-])`, 'u')
}
