import type { EngineInterface, MatchedHook } from 'claude-code'

import type { Question } from '../types'
import { recordAnswerAndDeliver } from './delivery'
import { messageOf } from './errorMessage'
import { answerUsage } from './inputs'
import { ALL_CLOSED } from './modelText'
import { ANSWER_COMMAND, PANE } from './names'
import { openQuestionsOf, sortedByNumber } from './questions'
import { scopeForUse } from './questionScope'
import { readQuestions, refreshQuestions } from './sessionState'

export const drawQuestionBand: MatchedHook<'ui.render', { component: 'AbovePrompt' }> = async (
  $,
  e,
  next,
) => {
  const open = openQuestionsOf(await readQuestions($))
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
        onPress={() => runOnScreen($, () => showPane($))}
      />
    </Box>
  )
}

export const drawQuestionPane: MatchedHook<
  'ui.render',
  { component: 'Pane'; requestId: typeof PANE }
> = async ($, e) => {
  const open = sortedByNumber(openQuestionsOf(await readQuestions($)))
  const elements = $.ui.resolve(e)
  const { Box, Text } = elements
  if (open.length === 0) {
    return <Text dimColor>{ALL_CLOSED}</Text>
  }
  const answer = (question: Question, text: string) =>
    runOnScreen($, () => answerOnScreen($, question, text))
  // The mobile surface does not draw input fields or choice lists, so the pane shows the
  // command instead.
  const drawAnswerFields =
    'Input' in elements && 'Select' in elements
      ? (question: Question) => {
          const { Input, Select } = elements

          return (
            <Box flexDirection="column">
              {question.choices.length > 0 && (
                <Select
                  key={`pick-${question.number}`}
                  options={question.choices.map(choice => ({ value: choice }))}
                  onSelect={choice => answer(question, choice)}
                />
              )}
              <Input
                key={`answer-${question.number}`}
                placeholder={
                  question.choices.length > 0 ? 'Or type another answer' : 'Type your answer'
                }
                submitLabel="answer"
                onSubmit={text => answer(question, text)}
              />
            </Box>
          )
        }
      : (question: Question) => (
          <Text dimColor>{`Answer with ${answerUsage(question.number)}`}</Text>
        )

  return (
    <Box flexDirection="column">
      {open.map(question => (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>{`#${question.number} ${question.text}`}</Text>
          {drawAnswerFields(question)}
        </Box>
      ))}
    </Box>
  )
}

async function showPane($: EngineInterface): Promise<void> {
  await refreshQuestions($, await scopeForUse($))
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
  const scope = await scopeForUse($)
  const isOpen = await recordAnswerAndDeliver($, scope, question.number, text.trim())
  if (!isOpen) {
    $.ui.toast(`Question #${question.number} is no longer open.`)
  }
}

/** Runs the work of a press or an entry on the screen, and shows its failure as a toast. */
function runOnScreen($: EngineInterface, work: () => Promise<void>): void {
  work().catch((error: unknown) => {
    const text = messageOf(error)
    $.ui.log(text, { to: 'debug' })
    $.ui.toast(text)
  })
}
