import type { ElementTable, EngineInterface, MatchedHook, ResolveInput } from 'claude-code'

import type { Question } from '../types'
import { recordAnswerAndDeliver } from './delivery'
import { answerUsage } from './inputs'
import { ALL_CLOSED, describeChoices } from './modelText'
import { ANSWER_COMMAND, PANE } from './names'
import { sortedByNumber } from './numbered'
import { openQuestionsOf } from './questions'
import { sessionForUse } from './questionSession'
import { toastStoreFailure } from './questionStore'
import { loadQuestionsFromStore, readQuestionsInState } from './sessionState'
import { drawsFields } from './surfaces'
import type { SurfaceWithFields } from './surfaces'

export const drawQuestionBand: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  const open = await readOpenQuestions($)
  if (e.props.hasSurvey || open.length === 0) {
    return next(e)
  }
  const { Box, Button, Text } = $.ui.resolve(e)

  return (
    <Box>
      <Text>{open.length === 1 ? '1 open question ' : `${open.length} open questions `}</Text>
      <Button
        key="answer"
        label="Answer"
        onPress={() => toastStoreFailure($, () => showPane($))}
      />
    </Box>
  )
}

export const drawQuestionPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof PANE }
> = async ($, e) => {
  const open = sortedByNumber(await readOpenQuestions($))
  const { Box, Text } = $.ui.resolve(e)
  if (open.length === 0) {
    return <Text dimColor>{ALL_CLOSED}</Text>
  }

  return (
    <Box flexDirection="column">
      {open.map(question => (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{`#${question.number} ${question.text}`}</Text>
          {drawsFields(e)
            ? drawAnswerFields($, e, question)
            : drawAnswerCommand({ Box, Text }, question)}
        </Box>
      ))}
    </Box>
  )
}

/** The list of the choices and the field for a typed answer, which answer the question. */
function drawAnswerFields(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
  question: Question,
) {
  const { Box, Input, Select } = $.ui.resolve(e)
  const answer = (text: string) => toastStoreFailure($, () => answerOnScreen($, question, text))

  return (
    <Box flexDirection="column">
      {question.choices.length > 0 && (
        <Select
          key={`pick-${question.number}`}
          options={question.choices.map(choice => ({ value: choice }))}
          onSelect={answer}
        />
      )}
      <Input
        key={`answer-${question.number}`}
        placeholder={question.choices.length > 0 ? 'Or type another answer' : 'Type your answer'}
        submitLabel="answer"
        onSubmit={answer}
      />
    </Box>
  )
}

/** The /answer command for the question, with its choices, where no field can answer it. */
function drawAnswerCommand(
  { Box, Text }: Pick<ElementTable, 'Box' | 'Text'>,
  question: Question,
) {
  const choices = describeChoices(question)

  return (
    <Box flexDirection="column">
      <Text dimColor>{`Answer with ${answerUsage(question.number)}`}</Text>
      {choices !== undefined && <Text dimColor>{choices}</Text>}
    </Box>
  )
}

/** The open questions in the state of the session that runs, which a drawing cannot load. */
async function readOpenQuestions($: EngineInterface): Promise<Question[]> {
  return openQuestionsOf((await readQuestionsInState($))?.questions ?? [])
}

async function showPane($: EngineInterface): Promise<void> {
  await loadQuestionsFromStore($, await sessionForUse($))
  const opened = await $.ui.open({ id: PANE, title: 'Questions', focus: true })
  if (!opened.isPlaced) {
    $.ui.toast(
      `The pane of the questions could not open: ${opened.reason}. ` +
        `Answer with ${answerUsage()}, or list them with /${ANSWER_COMMAND}.`,
    )
  }
}

async function answerOnScreen($: EngineInterface, question: Question, text: string): Promise<void> {
  if (text.trim() === '') {
    return
  }
  const sessionId = await sessionForUse($)
  // The answer is stored for the question with the id that the pane drew. Ids differ across
  // sessions, so an answer given after a switch to another session cannot reach its questions.
  const isOpen = await recordAnswerAndDeliver(
    $,
    sessionId,
    open => open.id === question.id,
    text.trim(),
  )
  if (!isOpen) {
    $.ui.toast(`Question #${question.number} is no longer open.`)
  }
}
