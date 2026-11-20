import type { EngineInterface, MatchedHook, RenderElement, ResolveInput } from 'claude-code'

import { drawsFields } from '../surfaces'
import type { SurfaceWithFields } from '../surfaces'
import { sendRoast } from './roastDelivery'
import { ROAST_PANE_SITE, SEND_KEY } from './roastNames'
import { RoastAttempt, RoastShown, readRoastInState, recordComment } from './roastState'
import type { RoastRun, WrittenRoast } from './roastState'
import {
  COMMENT_LABEL,
  COMMENT_PLACEHOLDER,
  COMMENT_SUBMIT_LABEL,
  NO_ROAST,
  ROAST_REFUSED_NOTICE,
  SECOND_ATTEMPT_LABEL,
  SENDING_ROAST_NOTICE,
  SEND_LABEL,
  describeOutputTokens,
  describeRoastNotWritten,
  describeWriting,
  describeWritingAgain,
} from './roastTexts'

export const drawRoastPane: MatchedHook<'ui.render', typeof ROAST_PANE_SITE> = async ($, e) => {
  const { Text } = $.ui.resolve(e)
  const inState = await readRoastInState($)
  if (inState === null) {
    return <Text dimColor>{NO_ROAST}</Text>
  }
  const { roast, secondsWriting, attempt, ...run } = inState
  switch (roast.shown) {
    case RoastShown.Writing:
      return drawWritingNotice($, e, attempt, describeWriting(secondsWriting))
    case RoastShown.WritingAgain:
      return drawWritingNotice($, e, attempt, describeWritingAgain(roast, secondsWriting))
    case RoastShown.NotWritten:
      return <Text color="warning">{describeRoastNotWritten(roast.failure)}</Text>
    case RoastShown.Written:
      return drawWrittenRoast($, e, run, roast)
    case RoastShown.Refused:
      return drawRefusedRoast($, e, roast.reason)
    case RoastShown.Sent:
      return <Text dimColor>{SENDING_ROAST_NOTICE}</Text>
  }
}

/** Draws `notice` dimmed, with SECOND_ATTEMPT_LABEL before it where `attempt` is the second. */
function drawWritingNotice(
  $: EngineInterface,
  e: ResolveInput<'Pane'>,
  attempt: RoastAttempt,
  notice: string,
): RenderElement {
  const { Text } = $.ui.resolve(e)

  return (
    <Text>
      {attempt === RoastAttempt.Second && <Text color="success">{SECOND_ATTEMPT_LABEL} </Text>}
      <Text dimColor>{notice}</Text>
    </Text>
  )
}

/**
 * Draws the roast, with a Send button that has the keyboard and the count of tokens generated
 * beside it, and after it the comment field.
 */
function drawWrittenRoast(
  $: EngineInterface,
  e: ResolveInput<'Pane'>,
  run: RoastRun,
  roast: WrittenRoast,
): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column" rowGap={1}>
      <Text>{roast.text}</Text>
      <Box columnGap={2}>
        <Button
          key={SEND_KEY}
          label={SEND_LABEL}
          variant="primary"
          autoFocus
          onPress={() => sendRoast($, run)}
        />
        <Text dimColor>{describeOutputTokens(roast.outputTokens)}</Text>
      </Box>
      {drawsFields(e) && drawCommentField($, e, run, roast.comment)}
    </Box>
  )
}

/** Draws the notice that you cannot send the roast, and after it `reason`, given by the fork. */
function drawRefusedRoast(
  $: EngineInterface,
  e: ResolveInput<'Pane'>,
  reason: string,
): RenderElement {
  const { Box, Text } = $.ui.resolve(e)

  return (
    <Box flexDirection="column" rowGap={1}>
      <Text color="warning">{ROAST_REFUSED_NOTICE}</Text>
      {reason !== '' && <Text>{reason}</Text>}
    </Box>
  )
}

function drawCommentField(
  $: EngineInterface,
  e: ResolveInput<'Pane', SurfaceWithFields>,
  run: RoastRun,
  comment: string,
): RenderElement {
  const { Input } = $.ui.resolve(e)

  return (
    <Input
      key="roast-comment"
      label={COMMENT_LABEL}
      placeholder={COMMENT_PLACEHOLDER}
      submitLabel={COMMENT_SUBMIT_LABEL}
      value={comment}
      onInput={text => recordComment($, run, text)}
      onSubmit={() => sendRoast($, run)}
    />
  )
}
