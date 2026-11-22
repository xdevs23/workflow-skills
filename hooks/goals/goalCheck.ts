import type {
  EngineInterface,
  Frozen,
  Next,
  TurnCompleteInput,
  TurnCompleteResult,
} from 'claude-code'

import type { Board, DefaultBranch, Goal, GoalCheck, ListedGoal } from '../../types'
import { showFailure } from '../failureToast'
import { GOAL_CHECKER_AGENT } from '../names'
import { submitAddedText } from '../pendingTexts'
import type { PendingTextSource } from '../pendingTexts'
import { sendOrRestore } from '../sendToModel'
import { Outcome, Refusal, openGoalsByPriorityOf } from './board'
import type { GoalsMarked } from './board'
import { describeStoreFailure } from './boardStore'
import type { Failed } from './boardStore'
import { MarkSetter, doneMarkOf, userRemovedMarkOf } from './doneMark'
import { markGoalsDoneInSession } from './goalActions'
import {
  GOAL_CHECK_DESCRIPTION,
  VERDICTS_NOT_READ_TOAST,
  describeCheckerNotStarted,
  describeEvidenceRefused,
  describeGoalsNotJudged,
  describeMarksNotSaved,
  describeVerdictsNotReported,
  writeGoalCheckPrompt,
} from './goalCheckTexts'
import { readBoardToRemind } from './goalReminderBoard'
import { readGoalCheck, updateGoalCheck, updatePendingMissingWork } from './goalState'
import { readCheckerAnswer, sortJudgedGoals } from './goalVerdicts'
import type { GivenVerdict, SortedVerdicts, WaitingWork } from './goalVerdicts'

// Only the goal checker judges the goals. It gives its verdicts as its final answer, which the end
// of its turn applies, since the tool calls of an agent spawned by a hook do not reach the
// tool.call hooks of its plugin.

/** How far a goal check got. */
export enum GoalCheckPhase {
  /** The goal checker starts or runs. */
  Running = 'running',
  /** The goal checker ended its run. */
  Reported = 'reported',
}

/**
 * The refs under which the default branch of the project is looked up, in this order: a product
 * choice, the branch the remote names as its head, else a local main or master.
 */
const DEFAULT_BRANCH_REFS = ['refs/remotes/origin/HEAD', 'refs/heads/main', 'refs/heads/master']

/** The idle stretch of a session in which a goal check starts, by its id. */
export type CheckedStretch = Pick<GoalCheck, 'sessionId' | 'stretchId'>

/**
 * Starts the goal checker on the goals of goalsToCheckOf, in the stretch `stretch`. Starts
 * nothing when the last check applied verdicts on each of these goals, as this check lists them,
 * on the same head of the default branch. A start that is refused shows in a toast.
 */
export async function startGoalCheck($: EngineInterface, stretch: CheckedStretch): Promise<void> {
  const board = await readBoardToRemind($, stretch.sessionId)
  const goals = board === undefined ? [] : goalsToCheckOf(board).map(listedGoalOf)
  if (goals.length === 0) {
    return
  }
  const defaultBranch = await readDefaultBranch($)
  const check: GoalCheck = {
    sessionId: stretch.sessionId,
    stretchId: stretch.stretchId,
    phase: GoalCheckPhase.Running,
    goals,
    ...(defaultBranch === undefined ? {} : { defaultBranch }),
  }
  if (!(await recordGoalCheck($, check))) {
    return
  }
  const started = await sendOrRestore(
    () =>
      $.agent.spawn({
        subagentType: GOAL_CHECKER_AGENT,
        name: checkerNameOf(check),
        description: GOAL_CHECK_DESCRIPTION,
        prompt: writeGoalCheckPrompt(goals, defaultBranch),
      }),
    spawned => spawned.agentId !== undefined,
    () => dropGoalCheck($, check),
  )
  if (started.agentId === undefined) {
    showFailure($, describeCheckerNotStarted(started.deny))
  }
}

/**
 * The name the goal checker of `check` is spawned under. The check knows it before the spawn
 * returns, which can come after the end of the run of the checker.
 */
function checkerNameOf(check: CheckedStretch): string {
  return `goal-checker-${check.stretchId}`
}

/**
 * Applies the verdicts in the final answer of the goal checker of the running check, which ends its
 * run with the turn `e`, once: marks the goals judged done, and hands the goals judged open to
 * `missingWork`. A run ended without an answer shows in a toast.
 */
export async function applyGoalCheckerAnswer(
  $: EngineInterface,
  e: Frozen<TurnCompleteInput>,
  next: Next<'turn.complete'>,
  missingWork: PendingTextSource,
): Promise<TurnCompleteResult> {
  const completed = await next(e)
  const check = e.agentId === undefined ? null : await takeRunningCheck($, e.agentId)
  if (check === null) {
    return completed
  }
  if (e.reason !== 'answer') {
    showFailure($, describeVerdictsNotReported(e.reason))
    return completed
  }
  const read = readCheckerAnswer(e.answer)
  if (read.isRead) {
    await applyVerdicts($, check, read.model, missingWork)
  } else {
    showFailure($, VERDICTS_NOT_READ_TOAST)
  }

  return completed
}

/**
 * Applies `given`, the verdicts of the goal checker of `check`: marks the goals judged done, and
 * hands the goals judged open to `missingWork`.
 */
async function applyVerdicts(
  $: EngineInterface,
  check: GoalCheck,
  given: readonly GivenVerdict[],
  missingWork: PendingTextSource,
): Promise<void> {
  const { sessionId } = check
  const board = await readBoardToRemind($, sessionId)
  if (board === undefined) {
    return
  }
  const sorted = sortJudgedGoals(board, check.goals, given)
  const marked = await markGoalsDoneInSession($, sessionId, sorted.done)
  const waiting = settleMarks($, marked)
  if (sorted.missing.length > 0) {
    const pending = { sessionId, board, missing: sorted.missing, waiting }
    await updatePendingMissingWork($, sessionId, () => pending)
    submitAddedText($, missingWork)
  }
  if (sorted.notJudged.length > 0) {
    showFailure($, describeGoalsNotJudged(sorted.notJudged.map(goal => goal.number)))
  }
  await recordJudgedGoals($, check, judgedGoalsOf(sorted, marked, waiting))
}

/**
 * The open goals of `board` without a done mark set by the goal checker, by priority. A mark set by
 * the model on an older board was never checked.
 */
function goalsToCheckOf(board: Board): Goal[] {
  return openGoalsByPriorityOf(board).filter(
    goal => doneMarkOf(goal)?.setBy !== MarkSetter.GoalChecker,
  )
}

function listedGoalOf(goal: Goal): ListedGoal {
  const listed = { goal: goal.number, text: goal.text }
  const removed = userRemovedMarkOf(goal)
  if (removed === undefined) {
    return listed
  }
  const { mark, removal } = removed
  const removedAt = new Date(removal.removedAt).toISOString()

  return {
    ...listed,
    removedMark: {
      evidence: mark.evidence,
      removedAt,
      ...(removal.reason === undefined ? {} : { reason: removal.reason }),
    },
  }
}

/** The default branch of the project as git finds it under DEFAULT_BRANCH_REFS, if it finds one. */
async function readDefaultBranch($: EngineInterface): Promise<DefaultBranch | undefined> {
  for (const ref of DEFAULT_BRANCH_REFS) {
    const read = await $.process.run(['git', 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`])
    if (read.exitCode === 0) {
      return { ref, head: read.stdout.trim() }
    }
  }

  return undefined
}

/**
 * Records `check` as the goal check of its session, unless the last check applied verdicts on each
 * goal of `check` as `check` lists it, on the same head of the default branch. Returns whether it
 * did.
 */
async function recordGoalCheck($: EngineInterface, check: GoalCheck): Promise<boolean> {
  let isRecorded = false
  await updateGoalCheck($, check.sessionId, last => {
    // A retried write runs this again, and the later run overwrites what the earlier one set.
    isRecorded = last === null || !isJudgedBy(check, last)

    return isRecorded ? check : last
  })

  return isRecorded
}

/**
 * Whether the verdicts of `last` were applied on each goal of `check`, as listed in it, on the head
 * of the default branch that `check` has. Without a default branch, a check cannot tell.
 */
function isJudgedBy(check: GoalCheck, last: GoalCheck): boolean {
  const head = check.defaultBranch?.head
  const judged = new Set(last.goals.map(listingKeyOf))

  return (
    last.phase === GoalCheckPhase.Reported &&
    head !== undefined &&
    last.defaultBranch?.head === head &&
    check.goals.every(goal => judged.has(listingKeyOf(goal)))
  )
}

/** One text for each listing of a goal, equal for equal listings. */
function listingKeyOf(goal: ListedGoal): string {
  return JSON.stringify(goal)
}

/**
 * Takes from the state the running check of the goal checker `agentId`, if it has one, so its
 * verdicts apply once.
 */
async function takeRunningCheck($: EngineInterface, agentId: string): Promise<GoalCheck | null> {
  const sessionId = await $.session.id()
  // The end of every turn of every agent calls this, so the agents are listed and the state is
  // written only while a check runs.
  if ((await readGoalCheck($, sessionId))?.phase !== GoalCheckPhase.Running) {
    return null
  }
  const agentName = (await $.agent.list()).find(agent => agent.id === agentId)?.name
  if (agentName === undefined) {
    return null
  }
  let taken: GoalCheck | null = null
  await updateGoalCheck($, sessionId, check => {
    // A retried write runs this again, and the later run overwrites what the earlier one set.
    taken = isRunBy(check, agentName) ? check : null

    return taken === null ? check : { ...taken, phase: GoalCheckPhase.Reported, goals: [] }
  })

  return taken
}

/** Removes `check` from the state while it runs there. */
async function dropGoalCheck($: EngineInterface, check: GoalCheck): Promise<void> {
  await updateGoalCheck($, check.sessionId, inState =>
    isSameCheck(inState, check) ? null : inState,
  )
}

function isRunBy(check: GoalCheck | null, agentName: string): check is GoalCheck {
  return check?.phase === GoalCheckPhase.Running && checkerNameOf(check) === agentName
}

function isSameCheck(inState: GoalCheck | null, check: GoalCheck): inState is GoalCheck {
  return inState?.phase === GoalCheckPhase.Running && inState.stretchId === check.stretchId
}

/**
 * Shows in a toast each done mark of `marked` that was not set, and returns the goals whose marks
 * wait for a goal not marked as done.
 */
function settleMarks($: EngineInterface, marked: GoalsMarked | Failed): WaitingWork[] {
  if (marked.outcome === Outcome.Failed) {
    showFailure($, describeMarksNotSaved(describeStoreFailure(marked)))
    return []
  }

  return marked.results.flatMap(({ goal, marked: result }) => {
    if (result.outcome !== Outcome.Refused) {
      return []
    }
    switch (result.refusal) {
      case Refusal.DependencyNotDone:
        return [{ goal, dependsOn: result.dependsOn }]
      case Refusal.BlankEvidence:
      case Refusal.EvidenceNotOneLine:
      case Refusal.EvidenceTooLong:
        showFailure($, describeEvidenceRefused(goal.number, result.refusal))
        return []
      // A goal cleared during the check needs no mark.
      case Refusal.GoalNotOpen:
        return []
    }
  })
}

/**
 * The numbers of the goals whose verdicts were applied: marked as done, waiting for a goal not
 * marked as done, or sent as open.
 */
function judgedGoalsOf(
  sorted: SortedVerdicts,
  marked: GoalsMarked | Failed,
  waiting: readonly WaitingWork[],
): Set<number> {
  const setMarks =
    marked.outcome === Outcome.Failed
      ? []
      : marked.results.filter(({ marked: result }) => result.outcome !== Outcome.Refused)

  return new Set([...setMarks, ...waiting, ...sorted.missing].map(({ goal }) => goal.number))
}

/** Records the goals numbered `judged` as the goals whose verdicts `check` applied. */
async function recordJudgedGoals(
  $: EngineInterface,
  check: GoalCheck,
  judged: ReadonlySet<number>,
): Promise<void> {
  await updateGoalCheck($, check.sessionId, inState =>
    inState?.phase === GoalCheckPhase.Reported && inState.stretchId === check.stretchId
      ? { ...inState, goals: check.goals.filter(goal => judged.has(goal.goal)) }
      : inState,
  )
}
