import type { Board, Goal, ListedGoal } from '../../types'
import { readNonBlank } from '../inputs'
import { readJsonText } from '../jsonText'
import type { JsonTextRead } from '../jsonText'
import { isRecord } from '../pluginStore'
import { isPositiveInteger } from '../positiveInteger'
import { openGoalsOf } from './board'
import type { AskedMark } from './board'

/** The verdicts that the goal checker gives a goal. */
export enum GoalVerdict {
  /** The project shows every part of the goal done. */
  Done = 'done',
  Open = 'open',
}

/** A verdict of the goal checker, with the facts behind it. */
type Judgment =
  | { verdict: GoalVerdict.Done; evidence: string }
  | { verdict: GoalVerdict.Open; missing: string }

/** A verdict as the goal checker gave it on the goal numbered `goal`; undefined when malformed. */
export type GivenVerdict = { goal: number; judgment: Judgment | undefined }

/** A goal judged open by the goal checker, with what the checker found missing. */
export type MissingWork = { goal: Goal; missing: string }

/** A goal judged done that waits for the goal numbered `dependsOn`, which is not marked as done. */
export type WaitingWork = { goal: Goal; dependsOn: number }

/**
 * The goals judged by the goal checker, sorted by verdict, and the goals without exactly one
 * well-formed verdict.
 */
export type SortedVerdicts = { done: AskedMark[]; missing: MissingWork[]; notJudged: Goal[] }

/**
 * Reads the verdicts in `answer`, the final answer of the goal checker, which the prompt asks to be
 * one JSON object with a list of verdicts under `goals`. An entry without a goal number is left
 * out, and an entry malformed otherwise has no judgment. The board checks the evidence before it
 * sets a mark.
 */
export function readCheckerAnswer(answer: string): JsonTextRead<GivenVerdict[]> {
  return readJsonText(answer, value =>
    isRecord(value) && Array.isArray(value.goals)
      ? value.goals.flatMap((entry: unknown) =>
          isRecord(entry) && isPositiveInteger(entry.goal)
            ? [{ goal: entry.goal, judgment: readJudgment(entry) }]
            : [],
        )
      : undefined,
  )
}

function readJudgment({
  verdict,
  evidence,
  missing,
}: Record<string, unknown>): Judgment | undefined {
  if (verdict === GoalVerdict.Done && typeof evidence === 'string') {
    return { verdict, evidence }
  }
  const missingWork = readNonBlank(missing)
  if (verdict === GoalVerdict.Open && missingWork !== undefined) {
    return { verdict, missing: missingWork }
  }

  return undefined
}

/**
 * Sorts the goals of `listed` by the verdicts of `given`, each goal as `board` has it. A goal
 * cleared or edited during the check was judged as it no longer is, so it is left out. A goal with
 * no verdict, a malformed one or several is not judged.
 */
export function sortJudgedGoals(
  board: Board,
  listed: readonly ListedGoal[],
  given: readonly GivenVerdict[],
): SortedVerdicts {
  const open = openGoalsOf(board)
  const sorted: SortedVerdicts = { done: [], missing: [], notJudged: [] }
  for (const { goal: number, text } of listed) {
    const goal = open.find(each => each.number === number && each.text === text)
    if (goal === undefined) {
      continue
    }
    const [verdict, ...others] = given.filter(each => each.goal === number)
    const judgment = others.length === 0 ? verdict?.judgment : undefined
    switch (judgment?.verdict) {
      case undefined:
        sorted.notJudged.push(goal)
        break
      case GoalVerdict.Done:
        sorted.done.push({ goal, evidence: judgment.evidence })
        break
      case GoalVerdict.Open:
        sorted.missing.push({ goal, missing: judgment.missing })
        break
    }
  }

  return sorted
}
