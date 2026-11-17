import type { EngineInterface, MatchedHook, RenderElement, ResolveInput } from 'claude-code'

import { drawsFields } from '../surfaces'
import type { SurfaceWithFields } from '../surfaces'
import { sendRoast } from './roastActions'
import { ROAST_PANE_SITE, SEND_KEY } from './roastNames'
import { RoastShown, readRoastInState, recordComment } from './roastState'
import type { RoastRun, WrittenRoast } from './roastState'
import {
  COMMENT_LABEL,
  COMMENT_PLACEHOLDER,
  COMMENT_SUBMIT_LABEL,
  NO_ROAST,
  SENDING_ROAST_NOTICE,
  SEND_LABEL,
  WRITING_ROAST_NOTICE,
  describeRoastNotWritten,
  describeWritingAgain,
} from './roastTexts'

export const drawRoastPane: MatchedHook<'ui.render', typeof ROAST_PANE_SITE> = async ($, e) => {
  const { Text } = $.ui.resolve(e)
  const inState = await readRoastInState($)
  if (inState === null) {
    return <Text dimColor>{NO_ROAST}</Text>
  }
  const { roast, ...run } = inState
  switch (roast.shown) {
    case RoastShown.Writing:
      return <Text dimColor>{WRITING_ROAST_NOTICE}</Text>
    case RoastShown.WritingAgain:
      return <Text dimColor>{describeWritingAgain(roast)}</Text>
    case RoastShown.NotWritten:
      return <Text color="warning">{describeRoastNotWritten(roast.failure)}</Text>
    case RoastShown.Written:
      return drawWrittenRoast($, e, run, roast)
    case RoastShown.Sent:
      return <Text dimColor>{SENDING_ROAST_NOTICE}</Text>
  }
}

/** Draws the roast, with a Send button that has the keyboard, and after it the comment field. */
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
      <Box>
        <Button
          key={SEND_KEY}
          label={SEND_LABEL}
          variant="primary"
          autoFocus
          onPress={() => sendRoast($, run)}
        />
      </Box>
      {drawsFields(e) && drawCommentField($, e, run, roast.comment)}
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
